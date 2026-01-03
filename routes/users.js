const express = require('express');
const router = express.Router();
const { getLineWorkers, getUserByEmpId, getOnlineUsers } = require('../controllers/userController');
// Authentication removed - skip auth for now

// Get all line workers
router.get('/line-workers', getLineWorkers);

// Get user by empId
router.get('/:empId', getUserByEmpId);

// Get online users
router.get('/online/list', getOnlineUsers);

module.exports = router;

