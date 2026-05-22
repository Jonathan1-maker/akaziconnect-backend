const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  checkAccess, initiatePayment, confirmPayment, getPaymentStatus,
  approvePayment, approveWorkerPayout, getWorkerEarnings, getAllPayments,
  initiateRegistrationFee, confirmRegistrationFee,
} = require('../controllers/paymentController');

const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const User = require('../models/User');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-__v');
    } catch {}
  }
  next();
};

router.get('/status/:paymentId', optionalAuth, getPaymentStatus);
router.get('/access/:workerId', optionalAuth, checkAccess);
router.post('/initiate', optionalAuth, initiatePayment);
router.put('/confirm/:paymentId', optionalAuth, confirmPayment);
router.put('/approve/:paymentId', protect, adminOnly, approvePayment);
router.put('/payout/:paymentId', protect, adminOnly, approveWorkerPayout);
router.get('/earnings', protect, getWorkerEarnings);
router.get('/all', protect, adminOnly, getAllPayments);
router.post('/registration/initiate', protect, initiateRegistrationFee);
router.put('/registration/confirm', protect, confirmRegistrationFee);

module.exports = router;
