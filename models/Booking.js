const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingFeePaid: { type: Boolean, default: false },
  bookingFeeReference: { type: String, default: '' },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  description: { type: String, trim: true, maxlength: 300 },
  status: { type: String, enum: ['awaiting_approval', 'pending', 'accepted', 'rejected', 'completed', 'cancelled'], default: 'awaiting_approval' },
  rejectionReason: { type: String, trim: true, default: '' },
}, { timestamps: true });

bookingSchema.index({ worker: 1, status: 1 });
bookingSchema.index({ customer: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
