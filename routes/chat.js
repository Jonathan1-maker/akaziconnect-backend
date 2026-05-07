const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getConversation, getConversationList } = require('../controllers/chatController');

router.get('/', protect, getConversationList);
router.get('/:userId', protect, getConversation);

module.exports = router;
