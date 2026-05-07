const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  initiateBookingFee, createBooking, approveBookingFee, rejectBookingFee,
  getMyBookings, getWorkerBookings, acceptBooking, rejectBooking,
  completeBooking, cancelBooking, getAllBookings,
} = require('../controllers/bookingController');

router.post('/fee/initiate', protect, initiateBookingFee);
router.post('/', protect, createBooking);
router.put('/:id/approve-fee', protect, adminOnly, approveBookingFee);
router.put('/:id/reject-fee', protect, adminOnly, rejectBookingFee);
router.get('/my', protect, getMyBookings);
router.get('/worker', protect, getWorkerBookings);
router.put('/:id/accept', protect, acceptBooking);
router.put('/:id/reject', protect, rejectBooking);
router.put('/:id/complete', protect, completeBooking);
router.put('/:id/cancel', protect, cancelBooking);
router.get('/all', protect, adminOnly, getAllBookings);

module.exports = router;
