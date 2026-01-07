const Message = require('../models/Message');
const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const { sendMessageNotification } = require('./fcmService');

// Handle Socket.io connections and events
const setupSocketIO = (io) => {
  // Authentication removed - skip auth for now
  // Get empId from handshake auth or query params
  io.use((socket, next) => {
    // Try to get empId from auth or query
    const empId = socket.handshake.auth.empId || 
                  socket.handshake.query.empId ||
                  socket.handshake.headers['empid'];
    
    console.log('🔌 Socket connection attempt - empId from auth:', socket.handshake.auth.empId);
    console.log('🔌 Socket connection attempt - empId from query:', socket.handshake.query.empId);
    console.log('🔌 Socket connection attempt - empId from headers:', socket.handshake.headers['empid']);
    console.log('🔌 Socket connection attempt - Final empId:', empId);
    
    if (empId) {
      socket.empId = String(empId);
      socket.user = { empId: String(empId) }; // Set minimal user object
      console.log('✅ Socket connection authorized with empId:', socket.empId);
    } else {
      // Allow connection without empId for now, but log warning
      console.warn('⚠️ Socket connection without empId - headers:', socket.handshake.headers);
      socket.empId = null;
    }
    
    next();
  });

  io.on('connection', async (socket) => {
    console.log(`🔌 User connected: ${socket.empId || 'unknown'} (Socket ID: ${socket.id})`);

    // Update user online status if empId is available
    if (socket.empId) {
      try {
        const empIdStr = String(socket.empId);
        console.log(`🔍 Looking up user with empId/loginId: ${empIdStr}`);
        
        // Find user by empId or loginId
        const user = await User.findOne({ 
          $or: [
            { empId: empIdStr },
            { loginId: empIdStr }
          ]
        });
        
        if (user) {
          console.log(`✅ Found user: ${user.empId} (loginId: ${user.loginId}), current isOnline: ${user.isOnline}`);
          await user.setOnline(socket.id);
          console.log(`✅ User ${user.empId} marked as online with socket ${socket.id}`);
          
          // Notify connected clients that user is online (only if there are connected clients)
          const connectedSockets = Array.from(io.sockets.sockets.values());
          if (connectedSockets.length > 0) {
            const statusUpdate = {
              empId: String(user.empId),
              isOnline: true
            };
            io.emit('user-status', statusUpdate);
            console.log(`✅ User ${user.empId} status broadcasted to ${connectedSockets.length} connected client(s) - isOnline: true`);
          }
        } else {
          console.warn(`❌ User not found for empId/loginId: ${empIdStr}`);
          console.warn(`   Searching in database for any user with empId or loginId matching: ${empIdStr}`);
        }
      } catch (error) {
        console.error('❌ Error updating user online status:', error);
        console.error('   Stack:', error.stack);
      }
    } else {
      console.warn('⚠️ Socket connected without empId - cannot update online status');
    }

    // Join room
    socket.on('join-room', async (data) => {
      try {
        const { roomId } = data;
        const room = await ChatRoom.findById(roomId);
        
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Find user by empId or loginId to get actual empId
        const user = await User.findOne({ 
          $or: [
            { empId: socket.empId },
            { loginId: socket.empId }
          ]
        });
        
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        const actualEmpId = String(user.empId);
        const participantsStr = room.participants.map(p => String(p));
        
        // Check if user is a participant using actual empId
        if (participantsStr.includes(actualEmpId)) {
          socket.join(roomId);
          console.log(`User ${actualEmpId} joined room ${roomId}`);
          
          // Mark room as read when user joins
          await room.resetUnread(actualEmpId);
          
          // Mark all messages as read
          await Message.updateMany(
            {
              roomId,
              senderId: { $ne: actualEmpId },
              'readBy.empId': { $ne: actualEmpId }
            },
            {
              $push: {
                readBy: {
                  empId: actualEmpId,
                  readAt: new Date()
                }
              }
            }
          );
        } else {
          socket.emit('error', { message: 'Access denied - not a participant' });
        }
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('leave-room', (data) => {
      const { roomId } = data;
      socket.leave(roomId);
      console.log(`User ${socket.empId} left room ${roomId}`);
    });

    // Send message
    socket.on('send-message', async (data) => {
      try {
        const { roomId, text, type = 'text', fileUrl, fileName, fileSize, senderId: dataSenderId } = data;
        const senderId = dataSenderId || socket.empId;

        if (!roomId || !text || !senderId) {
          socket.emit('error', { message: 'roomId, text, and senderId are required' });
          return;
        }

        // Verify room exists
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Get sender details - find by empId or loginId
        const sender = await User.findOne({ 
          $or: [
            { empId: senderId },
            { loginId: senderId }
          ]
        });
        if (!sender) {
          socket.emit('error', { message: 'Sender not found' });
          return;
        }

        // Use actual empId from sender record
        const actualSenderId = String(sender.empId);
        
        // Verify sender is a participant (check both empId and loginId)
        const participantsStr = room.participants.map(p => String(p));
        const isParticipant = participantsStr.includes(actualSenderId) || 
                             participantsStr.includes(String(sender.loginId || ''));
        
        if (!isParticipant) {
          console.log('DEBUG: Access denied - senderId:', actualSenderId, 'not in participants:', participantsStr);
          socket.emit('error', { message: 'Access denied - not a participant' });
          return;
        }

        // Create message using actual sender empId
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
        for (const participantId of participantsStr) {
          if (participantId !== actualSenderId) {
            await room.incrementUnread(participantId);
          }
        }

        // Mark as delivered to sender
        await message.markAsDelivered(actualSenderId);

        // Convert message to plain object and emit to all users in the room (including sender)
        const messageData = {
          _id: String(message._id),
          id: String(message._id),
          roomId: String(message.roomId),
          senderId: String(message.senderId),
          senderName: message.senderName,
          senderRole: message.senderRole,
          text: message.text,
          type: message.type,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          readBy: message.readBy || [],
          deliveredTo: message.deliveredTo || [],
          createdAt: message.createdAt?.toISOString(),
          updatedAt: message.updatedAt?.toISOString(),
          deletedAt: message.deletedAt?.toISOString(),
          editedAt: message.editedAt?.toISOString(),
        };
        
        console.log('DEBUG Socket: Emitting new-message to room', roomId);
        console.log('DEBUG Socket: Message data:', JSON.stringify(messageData, null, 2));
        console.log('DEBUG Socket: Room participants:', participantsStr);
        console.log('DEBUG Socket: Sender actualEmpId:', actualSenderId);
        
        // Only emit to users who are actually connected (in the room)
        // This prevents unnecessary emissions to disconnected clients
        const roomSockets = await io.in(roomId).fetchSockets();
        if (roomSockets.length > 0) {
          io.to(roomId).emit('new-message', messageData);
          console.log(`✅ Emitted new-message to ${roomSockets.length} connected client(s) in room ${roomId}`);
        } else {
          console.log(`ℹ️ No connected clients in room ${roomId} - skipping socket emission (will use FCM)`);
        }

        // Emit room-updated event with latest room data (last message, unread counts)
        // This allows chat list to update immediately without API call
        try {
          // Reload room to get updated data (last message, unread counts)
          const updatedRoom = await ChatRoom.findById(roomId)
            .populate('lastMessage.messageId')
            .lean();
          
          if (updatedRoom) {
            // Get other user info for direct chats
            let otherUserData = null;
            let participantsOnlineStatus = null; // For group chats
            
            if (updatedRoom.type === 'direct' && updatedRoom.participants) {
              const otherParticipantId = updatedRoom.participants.find(p => String(p) !== actualSenderId);
              if (otherParticipantId) {
                const otherUser = await User.findOne({
                  $or: [
                    { empId: String(otherParticipantId) },
                    { loginId: String(otherParticipantId) }
                  ]
                }).select('empId loginId name profilePicture department position isOnline lastSeen').lean();
                
                if (otherUser) {
                  otherUserData = {
                    empId: String(otherUser.empId),
                    loginId: otherUser.loginId ? String(otherUser.loginId) : null,
                    name: otherUser.name,
                    profilePicture: otherUser.profilePicture,
                    department: otherUser.department,
                    position: otherUser.position,
                    isOnline: otherUser.isOnline || false,
                    lastSeen: otherUser.lastSeen
                  };
                }
              }
            } else if (updatedRoom.type === 'group' && updatedRoom.participants) {
              // For group chats, get online status for all participants (excluding sender)
              const participantsStatus = {};
              let onlineCount = 0;
              
              for (const participantId of updatedRoom.participants) {
                const participantIdStr = String(participantId);
                
                // Skip sender - don't count self as online
                if (participantIdStr === actualSenderId) {
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
              
              // Total count excludes sender
              const totalCountExcludingSelf = updatedRoom.participants.length - 1;
              
              participantsOnlineStatus = {
                participants: participantsStatus,
                onlineCount: onlineCount,
                totalCount: totalCountExcludingSelf
              };
            }

            // Convert unreadCount Map to object
            const unreadCountObj = {};
            if (updatedRoom.unreadCount && updatedRoom.unreadCount instanceof Map) {
              updatedRoom.unreadCount.forEach((value, key) => {
                unreadCountObj[String(key)] = value;
              });
            } else if (updatedRoom.unreadCount && typeof updatedRoom.unreadCount === 'object') {
              Object.assign(unreadCountObj, updatedRoom.unreadCount);
            }

            // Prepare room update data
            const roomUpdateData = {
              id: String(updatedRoom._id),
              type: updatedRoom.type,
              participants: updatedRoom.participants.map(p => String(p)),
              name: updatedRoom.name,
              description: updatedRoom.description,
              hrEmpId: updatedRoom.hrEmpId ? String(updatedRoom.hrEmpId) : null,
              lineWorkerEmpId: updatedRoom.lineWorkerEmpId ? String(updatedRoom.lineWorkerEmpId) : null,
              createdBy: String(updatedRoom.createdBy),
              otherUser: otherUserData,
              participantsOnlineStatus: participantsOnlineStatus, // For group chats
              lastMessage: updatedRoom.lastMessage ? {
                messageId: updatedRoom.lastMessage.messageId ? String(updatedRoom.lastMessage.messageId._id || updatedRoom.lastMessage.messageId) : null,
                text: updatedRoom.lastMessage.text || '',
                sentBy: updatedRoom.lastMessage.sentBy ? String(updatedRoom.lastMessage.sentBy) : null,
                sentAt: updatedRoom.lastMessage.sentAt ? updatedRoom.lastMessage.sentAt.toISOString() : null
              } : null,
              unreadCount: unreadCountObj,
              createdAt: updatedRoom.createdAt ? updatedRoom.createdAt.toISOString() : null,
              updatedAt: updatedRoom.updatedAt ? updatedRoom.updatedAt.toISOString() : null
            };

            // Emit room-updated only to connected participants (optimize to avoid unnecessary emissions)
            console.log('🔵 Emitting room-updated event for room', roomId);
            
            let emittedCount = 0;
            const allSockets = Array.from(io.sockets.sockets.values());
            
            // Only emit to participants who are actually connected
            for (const participantId of participantsStr) {
              const participantIdStr = String(participantId);
              const participantSockets = allSockets.filter(s => {
                const socketEmpId = s.empId ? String(s.empId) : null;
                return socketEmpId === participantIdStr;
              });
              
              if (participantSockets.length > 0) {
                participantSockets.forEach(socket => {
                  socket.emit('room-updated', roomUpdateData);
                });
                emittedCount += participantSockets.length;
              }
            }
            
            // Also emit to room for those who are actively in the room
            const roomSockets = await io.in(roomId).fetchSockets();
            if (roomSockets.length > 0) {
              io.to(roomId).emit('room-updated', roomUpdateData);
            }
            
            if (emittedCount > 0 || roomSockets.length > 0) {
              console.log(`✅ Room-updated emitted to ${emittedCount} participant socket(s) and ${roomSockets.length} room socket(s)`);
            } else {
              console.log(`ℹ️ No connected participants for room-updated - all users offline`);
            }
          }
        } catch (roomUpdateError) {
          console.error('❌ Error emitting room-updated event:', roomUpdateError);
          // Don't fail message sending if room update emission fails
        }

        // Send FCM notifications to offline recipients
        // For group chats, notify all offline participants except sender
        // For direct chats, notify the other participant if offline
        try {
          const offlineParticipants = participantsStr.filter(p => p !== actualSenderId);
          console.log(`📱 FCM Notification Check: Participants: ${participantsStr.join(', ')}, Sender: ${actualSenderId}, Offline participants to check: ${offlineParticipants.join(', ')}`);
          
          const sender = await User.findOne({ 
            $or: [
              { empId: actualSenderId },
              { loginId: actualSenderId }
            ]
          });
          
          if (!sender) {
            console.warn('⚠️  Sender not found for notification:', actualSenderId);
          } else {
            // Truncate message text for notification
            const notificationText = message.text.length > 100 
              ? message.text.substring(0, 100) + '...' 
              : message.text;
            
            // Send notification to each offline participant
            for (const participantId of offlineParticipants) {
              const recipient = await User.findOne({ 
                $or: [
                  { empId: participantId },
                  { loginId: participantId }
                ]
              });
              
              if (!recipient) {
                console.log(`⚠️  FCM: Recipient ${participantId} not found in database`);
                continue;
              }
              
              console.log(`📱 FCM Check for ${participantId}: isOnline=${recipient.isOnline}, hasFCMTokens=${recipient.fcmTokens && recipient.fcmTokens.length > 0 ? 'Yes' : 'No'}, tokenCount=${recipient.fcmTokens ? recipient.fcmTokens.length : 0}`);
              
              // Always send notifications to online users for in-app notifications
              // The Flutter app will display them as local notifications when in foreground
              const shouldSendNotification = recipient && recipient.fcmTokens && recipient.fcmTokens.length > 0;
              
              if (shouldSendNotification) {
                if (recipient.isOnline) {
                  console.log(`📱 Sending in-app notification to online user ${participantId} (will show as local notification in app)`);
                } else {
                  console.log(`📱 Sending push notification to offline user ${participantId}`);
                }
                // Get unread count for this recipient from room
                const recipientUnreadCount = room.getUnreadCountForUser ? 
                  room.getUnreadCountForUser(String(recipient.empId)) : 
                  (room.unreadCount && room.unreadCount.get ? room.unreadCount.get(String(recipient.empId)) : 0) || 0;
                
                // Create notification payload
                const notification = {
                  notification: {
                    title: room.type === 'group' ? `${sender.name} in ${room.name || 'Group'}` : sender.name,
                    body: notificationText
                  },
                  data: {
                    type: 'new_message',
                    roomId: room._id.toString(),
                    roomType: room.type || 'direct',
                    senderId: String(actualSenderId),
                    messageId: message._id.toString(),
                    senderName: sender.name
                  },
                  android: {
                    priority: 'high',
                    notification: {
                      sound: 'default',
                      channelId: 'chat_messages'
                    }
                  },
                  apns: {
                    payload: {
                      aps: {
                        sound: 'default',
                        badge: recipientUnreadCount
                      }
                    }
                  }
                };
                
                // Send to all FCM tokens for this recipient
                const { sendNotification } = require('./fcmService');
                console.log(`📱 Attempting to send FCM notification to ${recipient.empId} (${recipient.name || 'Unknown'})`);
                const result = await sendNotification(String(recipient.empId), notification);
                console.log(`📱 FCM notification sent to ${recipient.empId}:`, result.success ? '✅ Success' : '❌ Failed');
                if (!result.success) {
                  if (result.credentialError) {
                    console.log(`   ⚠️  CRITICAL: Firebase credentials are invalid!`);
                    console.log(`   Please regenerate service account key from Firebase Console`);
                  } else {
                    console.log(`   Reason: ${result.message || result.error || 'Unknown error'}`);
                  }
                }
              } else {
                if (recipient && (!recipient.fcmTokens || recipient.fcmTokens.length === 0)) {
                  console.log(`⚠️  FCM: Skipping notification to ${participantId} - no FCM tokens registered`);
                }
              }
            }
          }
        } catch (notificationError) {
          console.error('❌ Error sending FCM notifications:', notificationError);
          console.error('   Stack:', notificationError.stack);
          // Don't fail message sending if notification fails
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing start - per chat room
    socket.on('typing-start', async (data) => {
      try {
        const { roomId } = data;
        if (!roomId) {
          console.error('typing-start: roomId is required');
          return;
        }
        
        // Get actual empId from user record
        const user = await User.findOne({ 
          $or: [
            { empId: socket.empId },
            { loginId: socket.empId }
          ]
        });
        
        if (!user) {
          console.error('typing-start: User not found for', socket.empId);
          return;
        }
        
        const actualEmpId = String(user.empId);
        
        // Verify user is in the room
        const room = await ChatRoom.findById(roomId);
        if (room) {
          const participantsStr = room.participants.map(p => String(p));
          if (participantsStr.includes(actualEmpId)) {
            // Only emit if there are other users in the room (optimize)
            const roomSockets = await io.in(roomId).fetchSockets();
            if (roomSockets.length > 1) { // More than just the sender
              socket.to(roomId).emit('typing', {
                empId: actualEmpId,
                isTyping: true,
                roomId
              });
              console.log(`User ${actualEmpId} is typing in room ${roomId} (${roomSockets.length - 1} other user(s) notified)`);
            }
          }
        }
      } catch (error) {
        console.error('Error handling typing-start:', error);
      }
    });

    // Typing stop - per chat room
    socket.on('typing-stop', async (data) => {
      try {
        const { roomId } = data;
        if (!roomId) {
          console.error('typing-stop: roomId is required');
          return;
        }
        
        // Get actual empId from user record
        const user = await User.findOne({ 
          $or: [
            { empId: socket.empId },
            { loginId: socket.empId }
          ]
        });
        
        if (!user) {
          console.error('typing-stop: User not found for', socket.empId);
          return;
        }
        
        const actualEmpId = String(user.empId);
        
        // Verify user is in the room
        const room = await ChatRoom.findById(roomId);
        if (room) {
          const participantsStr = room.participants.map(p => String(p));
          if (participantsStr.includes(actualEmpId)) {
            // Only emit if there are other users in the room (optimize)
            const roomSockets = await io.in(roomId).fetchSockets();
            if (roomSockets.length > 1) { // More than just the sender
              socket.to(roomId).emit('typing', {
                empId: actualEmpId,
                senderName: user.name, // Include name for group chats
                isTyping: false,
                roomId
              });
              console.log(`User ${actualEmpId} (${user.name}) stopped typing in room ${roomId}`);
            }
          }
        }
      } catch (error) {
        console.error('Error handling typing-stop:', error);
      }
    });

    // Mark message as read
    socket.on('mark-read', async (data) => {
      try {
        const { roomId, messageId, empId } = data;
        const userEmpId = empId || socket.empId;
        
        if (!userEmpId) {
          socket.emit('error', { message: 'empId is required' });
          return;
        }

        if (messageId) {
          // Mark specific message as read
          const message = await Message.findById(messageId);
          if (message) {
            await message.markAsRead(userEmpId);
            io.to(roomId).emit('message-read', {
              messageId,
              empId: userEmpId
            });
          }
        } else if (roomId) {
          // Mark all messages in room as read
          const room = await ChatRoom.findById(roomId);
          if (room) {
            const participantsStr = room.participants.map(p => String(p));
            const userEmpIdStr = String(userEmpId);
            
            // Check if user is a participant (by empId or loginId)
            let isParticipant = participantsStr.includes(userEmpIdStr);
            if (!isParticipant) {
              const user = await User.findOne({ 
                $or: [
                  { empId: userEmpIdStr },
                  { loginId: userEmpIdStr }
                ]
              });
              if (user) {
                const actualEmpIdStr = String(user.empId);
                isParticipant = participantsStr.includes(actualEmpIdStr);
                if (isParticipant) {
                  userEmpId = actualEmpIdStr;
                }
              }
            }
            
            if (isParticipant) {
              const readAt = new Date();
              
              // Mark all unread messages sent by others as read in a single efficient operation
              const updateResult = await Message.updateMany(
                {
                  roomId,
                  senderId: { $ne: userEmpId },
                  'readBy.empId': { $ne: userEmpId }
                },
                {
                  $push: {
                    readBy: {
                      empId: userEmpId,
                      readAt: readAt
                    }
                  }
                }
              );
              
              const markedCount = updateResult.modifiedCount;
              
              // Reset unread count for the user
              await room.resetUnread(userEmpId);
              
              // Emit single bulk messages-read event (more efficient than individual events)
              // Frontend can update all messages in the room as read based on this event
              io.to(roomId).emit('messages-read', {
                roomId,
                empId: userEmpId,
                readAt: readAt.toISOString(),
                messageCount: markedCount
              });
              
              // Only log if messages were actually marked (avoid spam in logs)
              if (markedCount > 0) {
                console.log(`✅ Marked ${markedCount} messages as read for user ${userEmpId} in room ${roomId}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
        socket.emit('error', { message: 'Failed to mark message as read' });
      }
    });

    // Handle new chat/group notification
    socket.on('new-chat', async (data) => {
      try {
        const { roomId, type, participants, name } = data;
        
        if (!roomId || !type || !participants || !Array.isArray(participants)) {
          socket.emit('error', { message: 'roomId, type, and participants array are required' });
          return;
        }

        // Get the room to verify it exists
        const room = await ChatRoom.findById(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Find all online users who are participants
        const onlineUsers = await User.find({
          $or: participants.map(p => ({ empId: String(p) })).concat(
            participants.map(p => ({ loginId: String(p) }))
          ),
          isOnline: true
        });

        // Emit new-chat event to all online participants (except the sender)
        const senderEmpId = String(socket.empId);
        for (const user of onlineUsers) {
          const userEmpId = String(user.empId);
          if (userEmpId !== senderEmpId) {
            // Find the socket for this user
            const userSockets = Array.from(io.sockets.sockets.values()).filter(
              s => {
                const sEmpId = String(s.empId || '');
                return sEmpId === userEmpId || sEmpId === String(user.loginId || '');
              }
            );
            
            for (const userSocket of userSockets) {
              userSocket.emit('new-chat', {
                roomId,
                type,
                name: name || room.name,
                participants: participants.map(p => String(p)),
              });
            }
          }
        }

        console.log(`✅ New ${type} chat notification sent to ${onlineUsers.length} online participant(s)`);
      } catch (error) {
        console.error('Error handling new-chat event:', error);
        socket.emit('error', { message: 'Failed to notify new chat' });
      }
    });

    // User online status - called on login/connect
    socket.on('user-online', async (data) => {
      try {
        console.log(`📨 Received user-online event from socket ${socket.id}:`, data);
        const empId = (data && data.empId) || socket.empId;
        if (!empId) {
          console.warn('❌ user-online event missing empId');
          socket.emit('error', { message: 'empId is required' });
          return;
        }
        
        const empIdStr = String(empId);
        console.log(`🔍 Looking up user for user-online event with empId/loginId: ${empIdStr}`);
        
        // Find user by empId or loginId
        const user = await User.findOne({ 
          $or: [
            { empId: empIdStr },
            { loginId: empIdStr }
          ]
        });
        
        if (user) {
          console.log(`✅ Found user for user-online: ${user.empId} (loginId: ${user.loginId})`);
          await user.setOnline(socket.id);
          console.log(`✅ User ${user.empId} marked as online via user-online event`);
          
          // Notify connected clients that user is online (only if there are connected clients)
          const connectedSockets = Array.from(io.sockets.sockets.values());
          if (connectedSockets.length > 0) {
            const statusUpdate = {
              empId: String(user.empId),
              isOnline: true
            };
            io.emit('user-status', statusUpdate);
            console.log(`✅ User ${user.empId} status broadcasted to ${connectedSockets.length} connected client(s) - isOnline: true`);
            
            // Emit room-updated events for all group chats this user is in
            // This ensures chat list updates instantly when users go online/offline
            try {
              const userRooms = await ChatRoom.find({
                type: 'group',
                participants: { $in: [String(user.empId), user.loginId].filter(Boolean) }
              }).lean();
              
              for (const room of userRooms) {
                const participantsStr = room.participants.map(p => String(p));
                const participantsStatus = {};
                let onlineCount = 0;
                
                for (const participantId of participantsStr) {
                  const participantIdStr = String(participantId);
                  
                  // Skip current user - don't count self as online
                  if (participantIdStr === String(user.empId)) {
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
                
                const totalCountExcludingSelf = participantsStr.length - 1;
                const participantsOnlineStatus = {
                  participants: participantsStatus,
                  onlineCount: onlineCount,
                  totalCount: totalCountExcludingSelf
                };
                
                // Convert unreadCount Map to object
                const unreadCountObj = {};
                if (room.unreadCount && room.unreadCount instanceof Map) {
                  room.unreadCount.forEach((value, key) => {
                    unreadCountObj[String(key)] = value;
                  });
                } else if (room.unreadCount && typeof room.unreadCount === 'object') {
                  Object.assign(unreadCountObj, room.unreadCount);
                }
                
                const roomUpdateData = {
                  id: String(room._id),
                  type: room.type,
                  participants: participantsStr,
                  name: room.name,
                  description: room.description,
                  hrEmpId: room.hrEmpId ? String(room.hrEmpId) : null,
                  lineWorkerEmpId: room.lineWorkerEmpId ? String(room.lineWorkerEmpId) : null,
                  createdBy: String(room.createdBy),
                  otherUser: null,
                  participantsOnlineStatus: participantsOnlineStatus,
                  lastMessage: room.lastMessage ? {
                    messageId: room.lastMessage.messageId ? String(room.lastMessage.messageId._id || room.lastMessage.messageId) : null,
                    text: room.lastMessage.text || '',
                    sentBy: room.lastMessage.sentBy ? String(room.lastMessage.sentBy) : null,
                    sentAt: room.lastMessage.sentAt ? room.lastMessage.sentAt.toISOString() : null
                  } : null,
                  unreadCount: unreadCountObj,
                  createdAt: room.createdAt ? room.createdAt.toISOString() : null,
                  updatedAt: room.updatedAt ? room.updatedAt.toISOString() : null
                };
                
                // Emit to all participants of this group
                io.to(String(room._id)).emit('room-updated', roomUpdateData);
              }
              
              if (userRooms.length > 0) {
                console.log(`✅ Emitted room-updated for ${userRooms.length} group chat(s) after user ${user.empId} went online`);
              }
            } catch (roomUpdateError) {
              console.error('Error emitting room-updated for groups after user-online:', roomUpdateError);
            }
          }
        } else {
          console.warn(`❌ User not found for empId/loginId in user-online event: ${empIdStr}`);
        }
      } catch (error) {
        console.error('❌ Error updating online status from user-online event:', error);
        console.error('   Stack:', error.stack);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.empId || 'unknown'} (Socket ID: ${socket.id})`);
      
      if (socket.empId) {
        try {
          // Find user by empId or loginId
          const user = await User.findOne({ 
            $or: [
              { empId: socket.empId },
              { loginId: socket.empId }
            ]
          });
          if (user) {
            // Only set offline if this was the last socket connection
            // (In case user has multiple tabs/devices)
            if (user.socketId === socket.id) {
              await user.setOffline();
              // Notify connected clients that user is offline (only if there are connected clients)
              const connectedSockets = Array.from(io.sockets.sockets.values());
              if (connectedSockets.length > 0) {
                io.emit('user-status', {
                  empId: String(user.empId),
                  isOnline: false
                });
                console.log(`✅ User ${user.empId} status broadcasted to ${connectedSockets.length} connected client(s) - isOnline: false`);
                
                // Emit room-updated events for all group chats this user is in
                // This ensures chat list updates instantly when users go offline
                try {
                  const userRooms = await ChatRoom.find({
                    type: 'group',
                    participants: { $in: [String(user.empId), user.loginId].filter(Boolean) }
                  }).lean();
                  
                  for (const room of userRooms) {
                    const participantsStr = room.participants.map(p => String(p));
                    const participantsStatus = {};
                    let onlineCount = 0;
                    
                    for (const participantId of participantsStr) {
                      const participantIdStr = String(participantId);
                      
                      // Skip current user - don't count self as online
                      if (participantIdStr === String(user.empId)) {
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
                    
                    const totalCountExcludingSelf = participantsStr.length - 1;
                    const participantsOnlineStatus = {
                      participants: participantsStatus,
                      onlineCount: onlineCount,
                      totalCount: totalCountExcludingSelf
                    };
                    
                    // Convert unreadCount Map to object
                    const unreadCountObj = {};
                    if (room.unreadCount && room.unreadCount instanceof Map) {
                      room.unreadCount.forEach((value, key) => {
                        unreadCountObj[String(key)] = value;
                      });
                    } else if (room.unreadCount && typeof room.unreadCount === 'object') {
                      Object.assign(unreadCountObj, room.unreadCount);
                    }
                    
                    const roomUpdateData = {
                      id: String(room._id),
                      type: room.type,
                      participants: participantsStr,
                      name: room.name,
                      description: room.description,
                      hrEmpId: room.hrEmpId ? String(room.hrEmpId) : null,
                      lineWorkerEmpId: room.lineWorkerEmpId ? String(room.lineWorkerEmpId) : null,
                      createdBy: String(room.createdBy),
                      otherUser: null,
                      participantsOnlineStatus: participantsOnlineStatus,
                      lastMessage: room.lastMessage ? {
                        messageId: room.lastMessage.messageId ? String(room.lastMessage.messageId._id || room.lastMessage.messageId) : null,
                        text: room.lastMessage.text || '',
                        sentBy: room.lastMessage.sentBy ? String(room.lastMessage.sentBy) : null,
                        sentAt: room.lastMessage.sentAt ? room.lastMessage.sentAt.toISOString() : null
                      } : null,
                      unreadCount: unreadCountObj,
                      createdAt: room.createdAt ? room.createdAt.toISOString() : null,
                      updatedAt: room.updatedAt ? room.updatedAt.toISOString() : null
                    };
                    
                    // Emit to all participants of this group
                    io.to(String(room._id)).emit('room-updated', roomUpdateData);
                  }
                  
                  if (userRooms.length > 0) {
                    console.log(`✅ Emitted room-updated for ${userRooms.length} group chat(s) after user ${user.empId} went offline`);
                  }
                } catch (roomUpdateError) {
                  console.error('Error emitting room-updated for groups after user-offline:', roomUpdateError);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error updating offline status:', error);
        }
      }
    });
  });
};

module.exports = setupSocketIO;

