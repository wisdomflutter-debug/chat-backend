const express = require('express');
const router = express.Router();
const {
  getMessages,
  sendMessage,
  markMessageAsRead
} = require('../controllers/messageController');
// Authentication removed - skip auth for now

// Get messages for a chat room
router.get('/rooms/:roomId/messages', getMessages);

// Send a message (REST fallback)
router.post('/', sendMessage);

// Mark message as read
router.put('/:messageId/read', markMessageAsRead);

module.exports = router;

