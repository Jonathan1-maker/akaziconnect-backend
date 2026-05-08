const express = require('express');
const router = express.Router();
const { register, login, sendResetOTP, resetPassword, changePassword, getMe, getUserById } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', sendResetOTP);
router.post('/reset-password', resetPassword);
router.put('/change-password', protect, changePassword);
router.get('/me', protect, getMe);
router.get('/user/:id', protect, getUserById);

module.exports = router;
