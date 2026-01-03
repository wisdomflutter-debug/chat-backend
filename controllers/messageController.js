const Message = require('../models/Message');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');

// Get messages for a chat room
const getMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    console.log('DEBUG: getMessages - roomId:', roomId, 'page:', page, 'limit:', limit);

    // Verify room exists
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      console.log('DEBUG: Room not found for roomId:', roomId);
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    console.log('DEBUG: Room found:', room._id, 'participants:', room.participants);

    // Get messages (excluding soft-deleted)
    // Convert roomId to ObjectId for proper matching
    const mongoose = require('mongoose');
    const roomObjectId = mongoose.Types.ObjectId.isValid(roomId) 
      ? new mongoose.Types.ObjectId(roomId) 
      : roomId;
    
    const query = {
      roomId: roomObjectId,
      deletedAt: null
    };

    console.log('DEBUG: Querying messages with roomId:', roomObjectId, 'query:', JSON.stringify(query));

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log('DEBUG: Found', messages.length, 'messages for roomId:', roomId);

    // Reverse to get chronological order
    messages.reverse();

    const total = await Message.countDocuments(query);

    console.log('DEBUG: Total messages:', total, 'for roomId:', roomId);

    res.json({
      success: true,
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total
      }
    });
  } catch (error) {
    console.error('ERROR: getMessages failed:', error);
    next(error);
  }
};

// Send a message (REST API - fallback for Socket.io)
const sendMessage = async (req, res, next) => {
  try {
    const { roomId, text, type = 'text', fileUrl, fileName, fileSize, senderId } = req.body;
    // Get senderId from body (auth removed)

    if (!roomId || !text || !senderId) {
      return res.status(400).json({
        success: false,
        message: 'roomId, text, and senderId are required'
      });
    }

    // Verify room exists and user is participant
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Convert senderId to string for comparison
    const senderIdStr = String(senderId);
    
    console.log('DEBUG: sendMessage - senderId:', senderIdStr, 'roomId:', roomId);
    console.log('DEBUG: Room participants:', room.participants);
    
    // Check if sender is a participant - try both empId and loginId
    const participantsStr = room.participants.map(p => String(p));
    console.log('DEBUG: Participants as strings:', participantsStr);
    const isParticipant = participantsStr.includes(senderIdStr);
    console.log('DEBUG: Is senderId in participants?', isParticipant);
    
    let actualSenderId = senderIdStr;
    let sender = null;
    
    // If not found by direct match, try finding user and checking their identifiers
    if (!isParticipant) {
      console.log('DEBUG: senderId not found directly, looking up user...');
      sender = await User.findOne({ 
        $or: [
          { empId: senderIdStr },
          { loginId: senderIdStr }
        ]
      });
      
      console.log('DEBUG: User lookup result:', sender ? `Found (empId: ${sender.empId}, loginId: ${sender.loginId})` : 'Not found');
      
      if (sender) {
        // Check if sender's empId or loginId is in participants
        const senderEmpIdStr = String(sender.empId || '');
        const senderLoginIdStr = String(sender.loginId || '');
        console.log('DEBUG: Checking if sender empId:', senderEmpIdStr, 'or loginId:', senderLoginIdStr, 'is in participants');
        const isParticipantByUser = participantsStr.includes(senderEmpIdStr) || participantsStr.includes(senderLoginIdStr);
        
        if (!isParticipantByUser) {
          console.log('DEBUG: Access denied - senderId:', senderIdStr, 'sender empId:', senderEmpIdStr, 'sender loginId:', senderLoginIdStr, 'not in participants:', participantsStr);
          return res.status(403).json({
            success: false,
            message: 'Access denied - User is not a participant in this room'
          });
        }
        // Use the actual empId from the user record
        actualSenderId = senderEmpIdStr;
        console.log('DEBUG: Using actual empId from user record:', actualSenderId);
      } else {
        console.log('DEBUG: Access denied - senderId:', senderIdStr, 'not in participants:', participantsStr, 'and user not found in database');
        return res.status(403).json({
          success: false,
          message: 'Access denied - User not found or not a participant'
        });
      }
    } else {
      // Direct match found, but still need to get user details
      console.log('DEBUG: Direct match found, getting user details...');
      sender = await User.findOne({ 
        $or: [
          { empId: senderIdStr },
          { loginId: senderIdStr }
        ]
      });
      
      if (sender) {
        actualSenderId = String(sender.empId || senderIdStr);
        console.log('DEBUG: User found, using empId:', actualSenderId);
      }
    }
    
    if (!sender) {
      console.log('DEBUG: Sender not found in database for senderId:', senderIdStr);
      return res.status(404).json({
        success: false,
        message: 'Sender not found - Please sync user first'
      });
    }

    // Create message
    const message = await Message.create({
      roomId,
      senderId: actualSenderId,
      senderName: sender.name,
      senderRole: sender.role,
      text,
      type,
      fileUrl,
      fileName,
      fileSize
    });

    // Update room's last message
    await room.updateLastMessage(message);

    // Increment unread count for all participants except sender
    // Use the new participants array-based approach (reuse participantsStr from above)
    for (const participantId of participantsStr) {
      if (participantId !== actualSenderId) {
        await room.incrementUnread(participantId);
      }
    }

    // Mark as delivered to sender
    await message.markAsDelivered(actualSenderId);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// Mark message as read
const markMessageAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { empId } = req.body;

    if (!empId) {
      return res.status(400).json({
        success: false,
        message: 'empId is required'
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Verify user is a participant in the room
    const room = await ChatRoom.findById(message.roomId);
    if (!room || !room.participants.includes(empId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await message.markAsRead(empId);

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessages,
  sendMessage,
  markMessageAsRead
};

