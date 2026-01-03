const express = require('express');
const router = express.Router();
const {
  getChatRooms,
  getChatRoomById,
  createChatRoom,
  markRoomAsRead,
  removeMemberFromGroup,
  addMemberToGroup,
  updateGroup,
  deleteGroup
} = require('../controllers/roomController');
// Authentication removed - skip auth for now

// Get all chat rooms for user
router.get('/', getChatRooms);

// Get chat room by ID
router.get('/:roomId', getChatRoomById);

// Create new chat room
router.post('/', createChatRoom);

// Mark all messages in room as read
router.put('/:roomId/read', markRoomAsRead);

// Group management routes
router.put('/:roomId/remove-member', removeMemberFromGroup);
router.put('/:roomId/add-member', addMemberToGroup);
router.put('/:roomId', updateGroup);
router.delete('/:roomId', deleteGroup);

module.exports = router;

