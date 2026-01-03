const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const User = require('../models/User');

// Get all chat rooms for a user
const getChatRooms = async (req, res, next) => {
  try {
    const { empId, role } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Convert empId to string for consistent matching (rooms store empId as string)
    const empIdStr = String(empId);
    
    // Query: Show rooms where current user's empId OR loginId is in participants array
    // First, check if user exists and get their actual empId and loginId
    // Try to find user by both empId and loginId to handle cases where loginId is passed as empId
    const currentUser = await User.findOne({ 
      $or: [
        { empId: empIdStr },
        { loginId: empIdStr }
      ]
    }).select('empId loginId');
    
    // Build array of identifiers to search for
    // Always include the provided empIdStr (could be actual empId or loginId)
    const userIdentifiers = [empIdStr];
    
    if (currentUser) {
      // Add actual empId if different (this handles case where loginId was passed)
      if (currentUser.empId && String(currentUser.empId) !== empIdStr) {
        userIdentifiers.push(String(currentUser.empId));
      }
      // Add loginId if different (this handles case where empId was passed)
      if (currentUser.loginId && String(currentUser.loginId) !== empIdStr) {
        userIdentifiers.push(String(currentUser.loginId));
      }
    } else {
      // User doesn't exist in chat system yet - still search with the provided empId
      // This handles cases where rooms were created before user was synced
      console.log('DEBUG: User not found in chat system, searching with provided empId:', empIdStr);
      
      // Also try to find if there are any users with this as loginId or empId
      // and search for rooms with both identifiers
      const allUsersWithThisId = await User.find({
        $or: [
          { empId: empIdStr },
          { loginId: empIdStr }
        ]
      }).select('empId loginId');
      
      if (allUsersWithThisId.length > 0) {
        console.log('DEBUG: Found users with matching identifiers:', allUsersWithThisId.map(u => ({ empId: u.empId, loginId: u.loginId })));
        // Add all identifiers from found users
        allUsersWithThisId.forEach(user => {
          if (user.empId && !userIdentifiers.includes(String(user.empId))) {
            userIdentifiers.push(String(user.empId));
          }
          if (user.loginId && !userIdentifiers.includes(String(user.loginId))) {
            userIdentifiers.push(String(user.loginId));
          }
        });
      }
    }
    
    // Query: Show rooms where any of the user's identifiers is in participants array
    // Everyone is an employee - use participants array only
    const query = {
      participants: { $in: userIdentifiers }
    };
    
    console.log('DEBUG: getChatRooms - empId:', empId, 'empIdStr:', empIdStr, 'role:', role);
    console.log('DEBUG: Current user found:', currentUser ? `Yes (empId: ${currentUser.empId}, loginId: ${currentUser.loginId})` : 'No');
    console.log('DEBUG: User identifiers to search:', userIdentifiers);
    console.log('DEBUG: Query:', JSON.stringify(query));
    
    // Additional debug: Check if there are any rooms with these identifiers
    const testQuery = { participants: { $in: userIdentifiers } };
    const testCount = await ChatRoom.countDocuments(testQuery);
    console.log('DEBUG: Number of rooms matching query:', testCount);

    const rooms = await ChatRoom.find(query)
      .populate('lastMessage.messageId')
      .sort({ 'lastMessage.sentAt': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    console.log('DEBUG: Found', rooms.length, 'rooms for empId:', empId, 'empIdStr:', empIdStr, 'role:', role);
    
    // Debug: Log room details
    if (rooms.length > 0) {
      console.log('DEBUG: Room details:');
      rooms.forEach((room, index) => {
        console.log(`  Room ${index + 1}:`, {
          id: room._id,
          type: room.type,
          name: room.name,
          participants: room.participants,
          hrEmpId: room.hrEmpId,
          lineWorkerEmpId: room.lineWorkerEmpId,
        });
      });
    } else {
      // Debug: Check if there are any rooms at all
      const totalRooms = await ChatRoom.countDocuments({});
      console.log('DEBUG: No rooms found. Total rooms in database:', totalRooms);
      if (totalRooms > 0) {
        // Sample a few rooms to see their structure
        const sampleRooms = await ChatRoom.find({}).limit(3).select('type participants hrEmpId lineWorkerEmpId name');
        console.log('DEBUG: Sample rooms in database:', JSON.stringify(sampleRooms, null, 2));
      }
    }

    // Get user details for each room
    const roomsWithUsers = await Promise.all(
      rooms.map(async (room) => {
        // Handle group chats differently
        if (room.type === 'group') {
          // For group chats, get online status for all participants (excluding current user)
          const participantsStr = room.participants.map(p => String(p));
          const currentEmpIdStr = String(empId);
          const participantsStatus = {};
          let onlineCount = 0;
          
          for (const participantId of participantsStr) {
            const participantIdStr = String(participantId);
            
            // Skip current user - don't count self as online
            if (participantIdStr === currentEmpIdStr) {
              continue;
            }
            
            const participant = await User.findOne({
              $or: [
                { empId: participantIdStr },
                { loginId: participantIdStr }
              ]
            }).select('empId loginId name isOnline').lean();
            
            if (participant) {
              const isOnline = participant.isOnline || false;
              participantsStatus[participantIdStr] = {
                empId: String(participant.empId),
                name: participant.name,
                isOnline: isOnline
              };
              if (isOnline) {
                onlineCount++;
              }
            }
          }
          
          // Total count excludes current user
          const totalCountExcludingSelf = participantsStr.length - 1;
          
          const participantsOnlineStatus = {
            participants: participantsStatus,
            onlineCount: onlineCount,
            totalCount: totalCountExcludingSelf
          };
          
          // For group chats, return room info with participantsOnlineStatus
          return {
            ...room.toObject(),
            otherUser: null, // Groups don't have a single "other user"
            participantsOnlineStatus: participantsOnlineStatus,
          };
        }

        // Handle direct chats - find other user from participants array
        // Everyone is an employee, no HR/lineWorker distinction
        let otherEmpId;
        let unreadCount = 0;
        
        // Convert to string for comparison
        const currentEmpIdStr = String(empId);
        
        // Convert participants to strings for comparison
        const participantsStr = room.participants.map(p => String(p));
        
        console.log('DEBUG: Room matching - currentEmpId:', currentEmpIdStr, 'participants:', participantsStr);
        
        // Find the participant that is NOT the current user
        const otherParticipantFromArray = participantsStr.find(p => p !== currentEmpIdStr);
        
        if (otherParticipantFromArray) {
          // Use the other participant from the array
          otherEmpId = otherParticipantFromArray;
          console.log('DEBUG: Using participants array, other user is:', otherEmpId);
          
          // Get unread count for current user using new Map-based structure
          if (room.unreadCount && typeof room.unreadCount.get === 'function') {
            // New Map-based structure
            unreadCount = room.getUnreadCount(currentEmpIdStr);
          } else if (room.unreadCount && typeof room.unreadCount === 'object') {
            // Legacy structure (hr/lineWorker) - try to get from Map or object
            unreadCount = room.unreadCount[currentEmpIdStr] || 0;
          } else {
            unreadCount = 0;
          }
        } else {
          console.log('ERROR: Could not find other participant in room');
          // Skip this room or return error
          return null;
        }
        
        // IMPORTANT: The otherEmpId we found might be a loginId, not the actual empId
        // We need to find the User record to get the actual empId and user details
        // This ensures we get the correct user name and details
        
        // Find otherUser - try by empId first, then by loginId
        // This handles cases where login ID and empId are different but refer to same user
        let otherUser = await User.findOne({ 
          $or: [
            { empId: otherEmpId },
            { loginId: otherEmpId }
          ]
        }).select('empId loginId name profilePicture department position isOnline lastSeen');
        
        console.log('DEBUG: Found otherUser:', otherUser ? `${otherUser.name} (empId: ${otherUser.empId}, loginId: ${otherUser.loginId})` : 'null', 'for query empId:', otherEmpId);
        
        // CRITICAL FIX: Check if the found user is actually the current user
        // This handles cases where empId/loginId confusion causes wrong user lookup
        if (otherUser) {
          const foundUserIsCurrentUser = String(otherUser.empId) === currentEmpIdStr || 
                                         String(otherUser.loginId || '') === currentEmpIdStr;
          
          if (foundUserIsCurrentUser) {
            console.log('ERROR: Found user matches current user! Finding alternative from participants...');
            console.log('ERROR: Current empId:', currentEmpIdStr, 'Found user empId:', otherUser.empId, 'loginId:', otherUser.loginId);
            
            // Find ALL other participants (excluding current user)
            const alternativeEmpIds = participantsStr.filter(p => p !== currentEmpIdStr);
            console.log('ERROR: Alternative empIds from participants:', alternativeEmpIds);
            
            // Try each alternative until we find one that's not the current user
            otherUser = null;
            for (const altEmpId of alternativeEmpIds) {
              if (altEmpId !== currentEmpIdStr && altEmpId !== String(otherUser?.empId || '')) {
                const alternativeUser = await User.findOne({ 
                  $or: [
                    { empId: altEmpId },
                    { loginId: altEmpId }
                  ]
                }).select('empId loginId name profilePicture department position isOnline lastSeen');
                
                if (alternativeUser) {
                  // Verify this user is NOT the current user
                  const isNotCurrentUser = String(alternativeUser.empId) !== currentEmpIdStr && 
                                          String(alternativeUser.loginId || '') !== currentEmpIdStr;
                  if (isNotCurrentUser) {
                    console.log('DEBUG: Using alternative user:', alternativeUser.name, 'empId:', alternativeUser.empId);
                    otherUser = alternativeUser;
                    otherEmpId = alternativeUser.empId;
                    break;
                  }
                }
              }
            }
          }
        }
        
        // If otherUser not found, try finding by any participant that's not the current user
        if (!otherUser && otherParticipantFromArray) {
          console.log('DEBUG: otherUser not found with otherEmpId, trying alternative lookup...');
          // Try to find user by any participant ID (check both empId and loginId)
          for (const participantId of participantsStr) {
            if (participantId !== currentEmpIdStr) {
              const altUser = await User.findOne({ 
                $or: [
                  { empId: participantId },
                  { loginId: participantId }
                ]
              }).select('empId loginId name profilePicture department position isOnline lastSeen');
              if (altUser) {
                // Verify this is NOT the current user
                const isNotCurrentUser = String(altUser.empId) !== currentEmpIdStr && 
                                        String(altUser.loginId || '') !== currentEmpIdStr;
                if (isNotCurrentUser) {
                  console.log('DEBUG: Found alternative otherUser:', altUser.name, 'empId:', altUser.empId, 'loginId:', altUser.loginId);
                  otherUser = altUser;
                  otherEmpId = altUser.empId; // Use the actual empId, not the participant ID
                  break;
                }
              }
            }
          }
        }
        
        // CRITICAL SAFETY CHECK: Ensure otherUser is not the current user
        // Check both empId and loginId to be thorough
        if (otherUser && (String(otherUser.empId) === currentEmpIdStr || String(otherUser.loginId || '') === currentEmpIdStr)) {
          console.log('ERROR: otherUser matches current user! Finding alternative from participants array...');
          console.log('ERROR: Current empId:', currentEmpIdStr, 'Found otherUser empId:', otherUser.empId);
          console.log('ERROR: Participants array:', participantsStr);
          
          // Find ALL other participants (excluding current user)
          const alternativeEmpIds = participantsStr.filter(p => p !== currentEmpIdStr);
          console.log('ERROR: Alternative empIds from participants:', alternativeEmpIds);
          
          // Try each alternative until we find one that's not the current user
          for (const altEmpId of alternativeEmpIds) {
            if (altEmpId !== currentEmpIdStr && altEmpId !== otherEmpId) {
              const alternativeUser = await User.findOne({ 
                $or: [
                  { empId: altEmpId },
                  { loginId: altEmpId }
                ]
              }).select('empId loginId name profilePicture department position isOnline lastSeen');
              console.log('DEBUG: Trying alternative user:', alternativeUser ? `${alternativeUser.name} (empId: ${alternativeUser.empId}, loginId: ${alternativeUser.loginId})` : 'null');
              // Check both empId and loginId to ensure it's not the current user
              if (alternativeUser && 
                  String(alternativeUser.empId) !== currentEmpIdStr && 
                  String(alternativeUser.loginId || '') !== currentEmpIdStr) {
                console.log('DEBUG: Using alternative user:', alternativeUser.name, 'empId:', alternativeUser.empId);
                return {
                  ...room.toObject(),
                  otherUser: alternativeUser,
                  unreadCount: unreadCount
                };
              }
            }
          }
          // If we still can't find a valid otherUser, return null for otherUser
          console.log('WARNING: Could not find valid otherUser, returning null for otherUser');
          otherUser = null; // Set to null so it's not returned
        }

        return {
          ...room.toObject(),
          otherUser,
          unreadCount: unreadCount
        };
      })
    );

    const total = await ChatRoom.countDocuments(query);

    res.json({
      success: true,
      rooms: roomsWithUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get chat room by ID
const getChatRoomById = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { empId } = req.query;

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Verify user is a participant
    if (!room.participants.includes(empId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const currentEmpIdStr = String(empId);
    const participantsStr = room.participants.map(p => String(p));
    
    let otherUser = null;
    let participantsOnlineStatus = null;
    
    if (room.type === 'direct') {
      // For direct chats, get other user details
      const otherEmpId = participantsStr.find(p => p !== currentEmpIdStr);
      
      if (!otherEmpId) {
        return res.status(400).json({
          success: false,
          message: 'Could not determine other user'
        });
      }
      
      otherUser = await User.findOne({ 
        $or: [
          { empId: otherEmpId },
          { loginId: otherEmpId }
        ]
      }).select('empId loginId name profilePicture department position isOnline lastSeen');
    } else if (room.type === 'group') {
      // For group chats, get online status for all participants
      const participantsStatus = {};
      let onlineCount = 0;
      
      for (const participantId of participantsStr) {
        const participantIdStr = String(participantId);
        const participant = await User.findOne({
          $or: [
            { empId: participantIdStr },
            { loginId: participantIdStr }
          ]
        }).select('empId loginId name isOnline').lean();
        
        if (participant) {
          const isOnline = participant.isOnline || false;
          participantsStatus[participantIdStr] = {
            empId: String(participant.empId),
            name: participant.name,
            isOnline: isOnline
          };
          if (isOnline) {
            onlineCount++;
          }
        }
      }
      
      participantsOnlineStatus = {
        participants: participantsStatus,
        onlineCount: onlineCount,
        totalCount: participantsStr.length
      };
    }

    res.json({
      success: true,
      room: {
        ...room.toObject(),
        otherUser,
        participantsOnlineStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create new chat room (supports both direct and group chats)
const createChatRoom = async (req, res, next) => {
  try {
    const { type, hrEmpId, lineWorkerEmpId, participants, name, description, createdBy } = req.body;

    // Handle group chat creation
    if (type === 'group') {
      if (!participants || !Array.isArray(participants) || participants.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Group chat must have at least 2 participants'
        });
      }

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Group name is required'
        });
      }

      if (!createdBy) {
        return res.status(400).json({
          success: false,
          message: 'createdBy is required'
        });
      }

      // Verify all participants exist and get their actual empIds
      // If a user doesn't exist, we'll need to fetch their info from the main HR system
      // For now, we'll create a basic user record if they don't exist
      const participantUsers = [];
      for (const participantId of participants) {
        let user = await User.findOne({ 
          $or: [
            { empId: participantId },
            { loginId: participantId }
          ]
        });
        
        // If user doesn't exist, create a basic user record
        if (!user) {
          console.log(`User ${participantId} not found in chat system, creating basic user record...`);
          // Create a minimal user record - the full sync should happen on login
          // But for now, we'll create one with the participantId as empId
          try {
            user = await User.create({
              empId: participantId,
              userId: participantId,
              name: `User ${participantId}`, // Placeholder name
              role: 'employee', // Default role
            });
            console.log(`Created basic user record for ${participantId}`);
          } catch (createError) {
            console.error(`Error creating user ${participantId}:`, createError);
            // If creation fails (e.g., duplicate), try to find again
            user = await User.findOne({ 
              $or: [
                { empId: participantId },
                { loginId: participantId }
              ]
            });
            if (!user) {
              return res.status(500).json({
                success: false,
                message: `Failed to create user: ${participantId}. Please ensure the user is synced to the chat system first.`
              });
            }
          }
        }
        participantUsers.push(user);
      }

      // Ensure creator is in participants - create if doesn't exist
      let creatorUser = await User.findOne({ 
        $or: [
          { empId: createdBy },
          { loginId: createdBy }
        ]
      });
      
      if (!creatorUser) {
        console.log(`Creator user ${createdBy} not found in chat system, creating basic user record...`);
        try {
          creatorUser = await User.create({
            empId: createdBy,
            userId: createdBy,
            name: `User ${createdBy}`, // Placeholder name
            role: 'hr', // Default to hr for creator
          });
          console.log(`Created basic user record for creator ${createdBy}`);
        } catch (createError) {
          console.error(`Error creating creator user ${createdBy}:`, createError);
          // If creation fails, try to find again
          creatorUser = await User.findOne({ 
            $or: [
              { empId: createdBy },
              { loginId: createdBy }
            ]
          });
          if (!creatorUser) {
            return res.status(500).json({
              success: false,
              message: `Failed to create creator user: ${createdBy}. Please ensure the user is synced to the chat system first.`
            });
          }
        }
      }

      // Get actual empIds from User records (this ensures we use the real empId, not loginId)
      const actualParticipantIds = participantUsers.map(u => String(u.empId || u.userId || ''));
      const actualCreatorId = String(creatorUser.empId || creatorUser.userId || createdBy);

      console.log('DEBUG: actualParticipantIds:', actualParticipantIds);
      console.log('DEBUG: actualCreatorId:', actualCreatorId);

      // Combine all participant IDs
      let allParticipantIds = [...actualParticipantIds];
      
      // ALWAYS ensure creator is in participants list (convert to string for comparison)
      const creatorIdStr = String(actualCreatorId);
      if (!allParticipantIds.some(id => String(id) === creatorIdStr)) {
        allParticipantIds.push(creatorIdStr);
        console.log('DEBUG: Added creator to participants:', creatorIdStr);
      } else {
        console.log('DEBUG: Creator already in participants');
      }
      
      // CRITICAL: Remove duplicates and ensure all participants are unique (as strings)
      // This handles cases where the same user was added with both empId and loginId
      const uniqueParticipantIds = [...new Set(allParticipantIds.map(id => String(id)))];
      
      // Verify we have at least 2 unique participants
      if (uniqueParticipantIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Group chat must have at least 2 unique participants. Some participants may be duplicates or refer to the same user.'
        });
      }
      
      console.log('DEBUG: Group chat participants - original:', participants);
      console.log('DEBUG: Group chat participants - actual empIds:', actualParticipantIds);
      console.log('DEBUG: Group chat participants - unique:', uniqueParticipantIds);

      // Check if group with same name and participants already exists
      const existingGroup = await ChatRoom.findOne({
        type: 'group',
        name: name.trim(),
        participants: { $all: uniqueParticipantIds, $size: uniqueParticipantIds.length }
      });

      if (existingGroup) {
        return res.json({
          success: true,
          message: 'Group chat already exists',
          room: existingGroup.toObject()
        });
      }

      // Create new group chat with unique participants
      const room = await ChatRoom.create({
        type: 'group',
        name: name.trim(),
        description: description || '',
        participants: uniqueParticipantIds,
        createdBy: actualCreatorId
      });

      return res.json({
        success: true,
        message: 'Group chat created successfully',
        room: room.toObject()
      });
    }

    // Handle direct chat creation (existing logic)
    if (!hrEmpId || !lineWorkerEmpId) {
      return res.status(400).json({
        success: false,
        message: 'hrEmpId and lineWorkerEmpId are required for direct chats'
      });
    }

    // Verify users exist (all are employees, no role distinction)
    // Find users by empId or loginId
    // If user doesn't exist, create a basic user record
    let user1 = await User.findOne({ 
      $or: [
        { empId: hrEmpId },
        { loginId: hrEmpId }
      ]
    });
    
    if (!user1) {
      console.log(`User ${hrEmpId} not found in chat system, creating basic user record...`);
      try {
        user1 = await User.create({
          empId: hrEmpId,
          userId: hrEmpId,
          name: `User ${hrEmpId}`, // Placeholder name
          role: 'employee', // Default role
        });
        console.log(`Created basic user record for ${hrEmpId}`);
      } catch (createError) {
        console.error(`Error creating user ${hrEmpId}:`, createError);
        // If creation fails, try to find again
        user1 = await User.findOne({ 
          $or: [
            { empId: hrEmpId },
            { loginId: hrEmpId }
          ]
        });
        if (!user1) {
          return res.status(500).json({
            success: false,
            message: `Failed to create user: ${hrEmpId}. Please ensure the user is synced to the chat system first.`
          });
        }
      }
    }
    
    let user2 = await User.findOne({ 
      $or: [
        { empId: lineWorkerEmpId },
        { loginId: lineWorkerEmpId }
      ]
    });
    
    if (!user2) {
      console.log(`User ${lineWorkerEmpId} not found in chat system, creating basic user record...`);
      try {
        user2 = await User.create({
          empId: lineWorkerEmpId,
          userId: lineWorkerEmpId,
          name: `User ${lineWorkerEmpId}`, // Placeholder name
          role: 'employee', // Default role
        });
        console.log(`Created basic user record for ${lineWorkerEmpId}`);
      } catch (createError) {
        console.error(`Error creating user ${lineWorkerEmpId}:`, createError);
        // If creation fails, try to find again
        user2 = await User.findOne({ 
          $or: [
            { empId: lineWorkerEmpId },
            { loginId: lineWorkerEmpId }
          ]
        });
        if (!user2) {
          return res.status(500).json({
            success: false,
            message: `Failed to create user: ${lineWorkerEmpId}. Please ensure the user is synced to the chat system first.`
          });
        }
      }
    }

    // Use actual empIds from User records
    const actualUser1EmpId = user1.empId;
    const actualUser2EmpId = user2.empId;
    
    // CRITICAL: Ensure both users are different
    if (actualUser1EmpId === actualUser2EmpId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create chat room: Both users are the same person'
      });
    }
    
    // Check if room already exists - use participants array (not hrEmpId/lineWorkerEmpId)
    // For direct chats, participants should be exactly 2 users
    const sortedParticipants = [actualUser1EmpId, actualUser2EmpId].sort();
    let room = await ChatRoom.findOne({
      type: 'direct',
      participants: { $all: sortedParticipants, $size: 2 }
    });

    if (room) {
      // Get other user details - find the user that's not the current user (hrEmpId)
      const currentUserEmpId = actualUser1EmpId; // The one who initiated
      const otherParticipant = room.participants.find(p => String(p) !== String(currentUserEmpId));
      const otherUser = await User.findOne({ 
        $or: [
          { empId: otherParticipant },
          { loginId: otherParticipant }
        ]
      }).select('empId loginId name profilePicture department position isOnline lastSeen');

      return res.json({
        success: true,
        message: 'Chat room already exists',
        room: {
          ...room.toObject(),
          otherUser
        }
      });
    }

    // Create new room using actual empIds from User records
    // Ensure participants array has unique values
    const uniqueParticipants = [...new Set([actualUser1EmpId, actualUser2EmpId])];
    
    if (uniqueParticipants.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create chat room: Participants must be two different users'
      });
    }
    
    // Use the first user as creator (typically the one who initiated)
    room = await ChatRoom.create({
      type: 'direct',
      participants: uniqueParticipants,
      createdBy: actualUser1EmpId
      // Note: Not setting hrEmpId/lineWorkerEmpId - using participants array only
    });
    
    console.log('DEBUG: Created direct chat room:', {
      roomId: room._id,
      participants: uniqueParticipants,
      createdBy: actualUser1EmpId
    });

    // Get other user details - find from participants array
    const otherParticipant = uniqueParticipants.find(p => String(p) !== String(actualUser1EmpId));
    const otherUser = await User.findOne({ 
      $or: [
        { empId: otherParticipant },
        { loginId: otherParticipant }
      ]
    }).select('empId loginId name profilePicture department position isOnline lastSeen');

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      room: {
        ...room.toObject(),
        otherUser
      }
    });
  } catch (error) {
    next(error);
  }
};

// Mark all messages in room as read
const markRoomAsRead = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { empId } = req.body;

    if (!empId) {
      return res.status(400).json({
        success: false,
        message: 'empId is required'
      });
    }

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Verify user is a participant
    if (!room.participants.includes(empId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Mark all unread messages as read
    await Message.updateMany(
      {
        roomId,
        senderId: { $ne: empId },
        'readBy.empId': { $ne: empId }
      },
      {
        $push: {
          readBy: {
            empId,
            readAt: new Date()
          }
        }
      }
    );

    // Reset unread count
    await room.resetUnread(empId);

    res.json({
      success: true,
      message: 'All messages marked as read'
    });
  } catch (error) {
    next(error);
  }
};

// Remove member from group
const removeMemberFromGroup = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { memberEmpId, removedBy } = req.body;

    if (!memberEmpId || !removedBy) {
      return res.status(400).json({
        success: false,
        message: 'memberEmpId and removedBy are required'
      });
    }

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    if (room.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This operation is only allowed for group chats'
      });
    }

    // Verify remover is a participant
    const removedByStr = String(removedBy);
    if (!room.participants.includes(removedByStr)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You must be a member of the group'
      });
    }

    // Verify member to remove is a participant
    const memberEmpIdStr = String(memberEmpId);
    if (!room.participants.includes(memberEmpIdStr)) {
      return res.status(400).json({
        success: false,
        message: 'Member is not in this group'
      });
    }

    // Prevent removing the last member
    if (room.participants.length <= 2) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove member: Group must have at least 2 members'
      });
    }

    // Remove member from participants
    room.participants = room.participants.filter(p => String(p) !== memberEmpIdStr);
    
    // Remove unread count for removed member
    if (room.unreadCount && room.unreadCount.has(memberEmpIdStr)) {
      room.unreadCount.delete(memberEmpIdStr);
    }

    await room.save();

    res.json({
      success: true,
      message: 'Member removed successfully',
      room: room.toObject()
    });
  } catch (error) {
    next(error);
  }
};

// Add member to group
const addMemberToGroup = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { memberEmpId, addedBy } = req.body;

    if (!memberEmpId || !addedBy) {
      return res.status(400).json({
        success: false,
        message: 'memberEmpId and addedBy are required'
      });
    }

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    if (room.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This operation is only allowed for group chats'
      });
    }

    // Verify adder is a participant
    const addedByStr = String(addedBy);
    if (!room.participants.includes(addedByStr)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You must be a member of the group'
      });
    }

    // Verify member to add exists
    const memberEmpIdStr = String(memberEmpId);
    let memberUser = await User.findOne({ 
      $or: [
        { empId: memberEmpIdStr },
        { loginId: memberEmpIdStr }
      ]
    });

    if (!memberUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please ensure the user is synced to the chat system.'
      });
    }

    // Get actual empId from User record
    const actualMemberEmpId = String(memberUser.empId || memberUser.userId || memberEmpIdStr);

    // Check if member is already in group
    if (room.participants.includes(actualMemberEmpId)) {
      return res.status(400).json({
        success: false,
        message: 'Member is already in this group'
      });
    }

    // Add member to participants
    room.participants.push(actualMemberEmpId);
    
    // Initialize unread count for new member
    if (!room.unreadCount) {
      room.unreadCount = new Map();
    }
    room.unreadCount.set(actualMemberEmpId, 0);

    await room.save();

    res.json({
      success: true,
      message: 'Member added successfully',
      room: room.toObject()
    });
  } catch (error) {
    next(error);
  }
};

// Update group (name, description)
const updateGroup = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { name, description, updatedBy } = req.body;

    if (!updatedBy) {
      return res.status(400).json({
        success: false,
        message: 'updatedBy is required'
      });
    }

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    if (room.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This operation is only allowed for group chats'
      });
    }

    // Verify updater is a participant
    const updatedByStr = String(updatedBy);
    if (!room.participants.includes(updatedByStr)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You must be a member of the group'
      });
    }

    // Update name if provided
    if (name !== undefined && name !== null) {
      if (name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Group name cannot be empty'
        });
      }
      room.name = name.trim();
    }

    // Update description if provided
    if (description !== undefined) {
      room.description = description || '';
    }

    await room.save();

    res.json({
      success: true,
      message: 'Group updated successfully',
      room: room.toObject()
    });
  } catch (error) {
    next(error);
  }
};

// Delete group
const deleteGroup = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { deletedBy } = req.body;

    if (!deletedBy) {
      return res.status(400).json({
        success: false,
        message: 'deletedBy is required'
      });
    }

    const room = await ChatRoom.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    if (room.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'This operation is only allowed for group chats'
      });
    }

    // Verify deleter is a participant (and ideally the creator)
    const deletedByStr = String(deletedBy);
    if (!room.participants.includes(deletedByStr)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You must be a member of the group'
      });
    }

    // Delete all messages in the room
    await Message.deleteMany({ roomId });

    // Delete the room
    await ChatRoom.findByIdAndDelete(roomId);

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatRooms,
  getChatRoomById,
  createChatRoom,
  markRoomAsRead,
  removeMemberFromGroup,
  addMemberToGroup,
  updateGroup,
  deleteGroup
};

