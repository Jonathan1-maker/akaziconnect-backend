const express = require('express');
const router = express.Router();
const { register, login, changePassword, updateEmail, getMe, getUserById } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.put('/change-password', protect, changePassword);
router.put('/update-email', protect, updateEmail);
router.get('/me', protect, getMe);
router.get('/user/:id', protect, getUserById);

module.exports = router;
