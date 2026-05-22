const Booking = require('../models/Booking');
const Worker = require('../models/Worker');
const crypto = require('crypto');
const { notify } = require('../config/notify');

const BOOKING_FEE = 1000;
const ADMIN_MTN = '0795222883';
const ADMIN_AIRTEL = '0738979382';
const MTN_USSD = `*182*1*1*${ADMIN_MTN}*${BOOKING_FEE}#`;
const AIRTEL_USSD = `*182*1*2*${ADMIN_AIRTEL}*${BOOKING_FEE}#`;

const initiateBookingFee = async (req, res) => {
  try {
    const { workerId } = req.body;
    if (!workerId) return res.status(400).json({ message: 'Worker ID required' });
    const worker = await Worker.findById(workerId);
    if (!worker || !worker.isApproved) return res.status(404).json({ message: 'Worker not found' });
    const reference = `BKF-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    res.json({ reference, amount: BOOKING_FEE, mtnUssd: MTN_USSD, airtelUssd: AIRTEL_USSD, adminMtn: ADMIN_MTN, adminAirtel: ADMIN_AIRTEL, currency: 'RWF' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to initiate booking fee' });
  }
};

const createBooking = async (req, res) => {
  try {
    const { workerId, date, time, description, bookingFeeReference } = req.body;
    if (!workerId || !date || !time) return res.status(400).json({ message: 'Worker, date and time are required' });
    if (!bookingFeeReference) return res.status(400).json({ message: 'Booking fee payment reference is required' });

    const worker = await Worker.findById(workerId);
    if (!worker || !worker.isApproved) return res.status(404).json({ message: 'Worker not found' });

    const conflict = await Booking.findOne({ worker: workerId, date: new Date(date), time, status: { $in: ['pending', 'accepted'] } });
    if (conflict) return res.status(400).json({ message: 'This time slot is already booked' });

    const booking = await Booking.create({
      worker: workerId, customer: req.user._id,
      date: new Date(date), time, description,
      bookingFeePaid: false, bookingFeeReference, status: 'awaiting_approval',
    });

    await booking.populate([{ path: 'worker', select: 'name location user', populate: { path: 'category', select: 'name icon' } }]);

    // notify customer their booking is submitted
    await notify(
      req.user._id, 'booking_new',
      '📅 Booking Submitted',
      `Your booking with ${worker.name} on ${new Date(date).toLocaleDateString()} at ${time} is awaiting payment confirmation.`,
      { bookingId: booking._id }
    );

    res.status(201).json({ message: 'Booking submitted. Waiting for admin to confirm your payment.', booking });
  } catch (err) {
    console.error('createBooking error:', err.message);
    res.status(500).json({ message: 'Failed to create booking', error: err.message });
  }
};

const approveBookingFee = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('worker', 'name user').populate('customer', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'awaiting_approval') return res.status(400).json({ message: 'Booking is not awaiting approval' });

    booking.status = 'pending';
    booking.bookingFeePaid = true;
    await booking.save();

    // notify customer
    await notify(
      booking.customer._id, 'booking_fee_approved',
      '✅ Payment Confirmed!',
      `Your booking with ${booking.worker?.name} has been confirmed and sent to the worker.`,
      { bookingId: booking._id }
    );

    // notify worker
    await notify(
      booking.worker?.user, 'booking_new',
      '📅 New Booking Request',
      `${booking.customer?.name} wants to book you on ${new Date(booking.date).toLocaleDateString()} at ${booking.time}.`,
      { bookingId: booking._id }
    );

    res.json({ message: 'Booking fee approved. Booking sent to worker.', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve booking fee' });
  }
};

const rejectBookingFee = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('worker', 'name').populate('customer', 'name');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.status = 'cancelled';
    booking.rejectionReason = 'Booking fee payment not confirmed by admin';
    await booking.save();

    // notify customer
    await notify(
      booking.customer?._id, 'booking_fee_rejected',
      '❌ Payment Not Confirmed',
      `Your booking fee for ${booking.worker?.name} was not confirmed. Your booking has been cancelled.`,
      { bookingId: booking._id }
    );

    res.json({ message: 'Booking fee rejected. Booking cancelled.', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject booking fee' });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user._id })
      .populate({ path: 'worker', select: 'name location user', populate: [{ path: 'category', select: 'name icon' }, { path: 'user', select: '_id name' }] })
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('getMyBookings error:', err.message);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
};

const getWorkerBookings = async (req, res) => {
  try {
    const worker = await Worker.findOne({ user: req.user._id });
    if (!worker) return res.status(404).json({ message: 'Worker profile not found' });
    const { status } = req.query;
    const filter = { worker: worker._id, status: { $ne: 'awaiting_approval' } };
    if (status) filter.status = status;
    const bookings = await Booking.find(filter).populate('customer', 'name phone').sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
};

const acceptBooking = async (req, res) => {
  try {
    const worker = await Worker.findOne({ user: req.user._id });
    if (!worker) return res.status(404).json({ message: 'Worker profile not found' });

    const booking = await Booking.findOne({ _id: req.params.id, worker: worker._id }).populate('customer', 'name _id');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'pending') return res.status(400).json({ message: 'Booking is no longer pending' });

    booking.status = 'accepted';
    await booking.save();

    await notify(
      booking.customer?._id, 'booking_accepted',
      '✅ Booking Accepted!',
      `${worker.name} accepted your booking on ${new Date(booking.date).toLocaleDateString()} at ${booking.time}.`,
      { bookingId: booking._id }
    );

    res.json({ message: 'Booking accepted', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to accept booking' });
  }
};

const rejectBooking = async (req, res) => {
  try {
    const worker = await Worker.findOne({ user: req.user._id });
    if (!worker) return res.status(404).json({ message: 'Worker profile not found' });

    const booking = await Booking.findOne({ _id: req.params.id, worker: worker._id }).populate('customer', 'name _id');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'pending') return res.status(400).json({ message: 'Booking is no longer pending' });

    booking.status = 'rejected';
    booking.rejectionReason = req.body.reason || '';
    await booking.save();

    await notify(
      booking.customer?._id, 'booking_rejected',
      '❌ Booking Rejected',
      `${worker.name} couldn't accept your booking on ${new Date(booking.date).toLocaleDateString()}${booking.rejectionReason ? `: ${booking.rejectionReason}` : '.'}`,
      { bookingId: booking._id }
    );

    res.json({ message: 'Booking rejected', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject booking' });
  }
};

const completeBooking = async (req, res) => {
  try {
    const worker = await Worker.findOne({ user: req.user._id });
    if (!worker) return res.status(404).json({ message: 'Worker profile not found' });

    const booking = await Booking.findOne({ _id: req.params.id, worker: worker._id }).populate('customer', 'name _id');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'accepted') return res.status(400).json({ message: 'Booking must be accepted first' });

    booking.status = 'completed';
    await booking.save();

    await notify(
      booking.customer?._id, 'booking_completed',
      '🏁 Job Completed!',
      `Your booking with ${worker.name} has been marked as completed. Leave a review!`,
      { bookingId: booking._id, workerId: worker._id }
    );

    res.json({ message: 'Booking marked as completed', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to complete booking' });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id }).populate('worker', 'name user');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!['pending', 'accepted', 'awaiting_approval'].includes(booking.status))
      return res.status(400).json({ message: 'Cannot cancel this booking' });

    booking.status = 'cancelled';
    await booking.save();

    // notify worker
    await notify(
      booking.worker?.user, 'booking_cancelled',
      '🚫 Booking Cancelled',
      `A customer cancelled their booking on ${new Date(booking.date).toLocaleDateString()} at ${booking.time}.`,
      { bookingId: booking._id }
    );

    res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking' });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('customer', 'name phone')
      .populate({ path: 'worker', select: 'name', populate: { path: 'category', select: 'name icon' } })
      .sort({ createdAt: -1 });

    const stats = {
      total: bookings.length,
      awaiting_approval: bookings.filter((b) => b.status === 'awaiting_approval').length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      accepted: bookings.filter((b) => b.status === 'accepted').length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      rejected: bookings.filter((b) => b.status === 'rejected').length,
    };

    res.json({ bookings, stats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
};

module.exports = {
  initiateBookingFee, createBooking, approveBookingFee, rejectBookingFee,
  getMyBookings, getWorkerBookings, acceptBooking, rejectBooking,
  completeBooking, cancelBooking, getAllBookings,
};
