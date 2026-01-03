const User = require('../models/User');

// Sync user from existing HR system
const syncUser = async (req, res, next) => {
  try {
    const {
      empId,
      loginId, // Optional: login ID if different from empId
      name,
      firstName,
      lastName,
      email,
      role,
      rankType,
      profilePicture,
      department,
      position,
      resortId
    } = req.body;

    // Validate required fields
    if (!empId || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'empId, name, and role are required'
      });
    }

    // Determine if empId is actually a loginId (contains letters like "DR-")
    const isLoginIdFormat = /[A-Za-z]/.test(empId);
    
    // Find user by empId OR loginId
    let user = await User.findOne({ empId });
    if (!user && loginId) {
      user = await User.findOne({ loginId });
    }
    // Also check if loginId matches empId of existing user
    if (!user && loginId) {
      user = await User.findOne({ $or: [{ empId: loginId }, { loginId: empId }] });
    }
    // If empId is a loginId format, also search by loginId
    if (!user && isLoginIdFormat) {
      user = await User.findOne({ loginId: empId });
    }

    if (user) {
      // Update existing user - ensure empId is the primary identifier (numerical)
      // If the incoming empId is a loginId format, we need to handle it differently
      if (isLoginIdFormat) {
        // empId is actually a loginId - store it as loginId and keep existing empId
        if (!user.loginId) {
          user.loginId = empId; // Store the loginId
        }
        // Keep the existing numerical empId
      } else if (user.empId !== empId && !user.loginId) {
        // If user was created with loginId as empId, and now we have actual empId, update it
        user.loginId = user.empId; // Store old empId as loginId
        user.empId = empId; // Set new empId (numerical)
      } else if (loginId && loginId !== empId) {
        // Store loginId if provided and different from empId
        user.loginId = loginId;
      }
      user.name = name;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.email = email || user.email;
      user.role = role;
      user.rankType = rankType || user.rankType;
      user.profilePicture = profilePicture || user.profilePicture;
      user.department = department || user.department;
      user.position = position || user.position;
      user.resortId = resortId || user.resortId;
      await user.save();
    } else {
      // Create new user
      // If empId is a loginId format (contains letters), we need to handle it
      // For now, if empId is loginId format, store it as loginId and use a placeholder for empId
      // The actual empId should be resolved later or from another source
      if (isLoginIdFormat) {
        // empId is actually a loginId - store it as loginId
        // We'll need the actual numerical empId - for now, use loginId as empId
        // TODO: Resolve actual numerical empId from main HR system
        user = await User.create({
          empId: empId, // Store loginId as empId temporarily
          loginId: empId, // Also store as loginId
          userId: empId,
          name,
          firstName,
          lastName,
          email,
          role,
          rankType,
          profilePicture,
          department,
          position,
          resortId
        });
      } else {
        // empId is numerical - use it as-is
        user = await User.create({
          empId,
          loginId: loginId && loginId !== empId ? loginId : undefined,
          userId: empId,
          name,
          firstName,
          lastName,
          email,
          role,
          rankType,
          profilePicture,
          department,
          position,
          resortId
        });
      }
    }

    res.json({
      success: true,
      message: 'User synced successfully',
      user: {
        _id: user._id,
        empId: user.empId,
        name: user.name,
        role: user.role,
        rankType: user.rankType,
        profilePicture: user.profilePicture,
        department: user.department,
        position: user.position
      }
    });
  } catch (error) {
    next(error);
  }
};

// Register/Update FCM token
const registerFCMToken = async (req, res, next) => {
  try {
    const { empId, fcmToken } = req.body;

    console.log(`\n📱 ============================================`);
    console.log(`📱 FCM TOKEN REGISTRATION REQUEST`);
    console.log(`📱 ============================================`);
    console.log(`empId: ${empId}`);
    console.log(`fcmToken: ${fcmToken ? fcmToken.substring(0, 30) + '...' : 'MISSING'}`);

    if (!empId || !fcmToken) {
      console.log(`❌ Missing required fields`);
      return res.status(400).json({
        success: false,
        message: 'empId and fcmToken are required'
      });
    }

    // Try to find user by empId or loginId
    const user = await User.findOne({ 
      $or: [
        { empId: String(empId) },
        { loginId: String(empId) }
      ]
    });

    if (!user) {
      console.log(`❌ User not found for empId/loginId: ${empId}`);
      console.log(`📱 ============================================\n`);
      return res.status(404).json({
        success: false,
        message: 'User not found. Please sync user first.'
      });
    }

    console.log(`✅ User found: ${user.name} (empId: ${user.empId}, loginId: ${user.loginId})`);
    console.log(`Current FCM tokens count: ${user.fcmTokens ? user.fcmTokens.length : 0}`);

    await user.addFCMToken(fcmToken);

    // Reload user to get updated tokens
    const updatedUser = await User.findById(user._id);
    console.log(`✅ FCM token added. New tokens count: ${updatedUser.fcmTokens ? updatedUser.fcmTokens.length : 0}`);
    console.log(`📱 ============================================\n`);

    res.json({
      success: true,
      message: 'FCM token registered successfully',
      tokensCount: updatedUser.fcmTokens ? updatedUser.fcmTokens.length : 0
    });
  } catch (error) {
    console.error(`❌ FCM token registration error: ${error.message}`);
    console.log(`📱 ============================================\n`);
    next(error);
  }
};

module.exports = {
  syncUser,
  registerFCMToken
};

