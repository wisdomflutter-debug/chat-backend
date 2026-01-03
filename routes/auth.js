const express = require('express');
const router = express.Router();
const { syncUser, registerFCMToken } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Sync user from existing HR system
router.post('/sync-user', syncUser);

// Register/Update FCM token
router.post('/register-fcm', registerFCMToken);

module.exports = router;


