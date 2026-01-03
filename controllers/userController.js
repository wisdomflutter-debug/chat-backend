const User = require('../models/User');

// Get all line workers
const getLineWorkers = async (req, res, next) => {
  try {
    const { resortId } = req.query;

    const query = {
      role: 'line_worker',
      rankType: 'line workers'
    };

    if (resortId) {
      query.resortId = parseInt(resortId);
    }

    const lineWorkers = await User.find(query)
      .select('empId name firstName lastName profilePicture department position isOnline lastSeen')
      .sort({ name: 1 });

    res.json({
      success: true,
      lineWorkers
    });
  } catch (error) {
    next(error);
  }
};

// Get user by empId
const getUserByEmpId = async (req, res, next) => {
  try {
    const { empId } = req.params;

    const user = await User.findOne({ empId })
      .select('-fcmTokens -fcmToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Get online users
const getOnlineUsers = async (req, res, next) => {
  try {
    const onlineUsers = await User.find({ isOnline: true })
      .select('empId name profilePicture isOnline lastSeen');

    res.json({
      success: true,
      onlineUsers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLineWorkers,
  getUserByEmpId,
  getOnlineUsers
};


