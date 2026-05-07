const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      // booking
      'booking_new', 'booking_accepted', 'booking_rejected',
      'booking_completed', 'booking_cancelled',
      'booking_fee_approved', 'booking_fee_rejected',
      // worker
      'worker_approved', 'worker_rejected', 'worker_verified',
      'registration_fee_submitted',
      // payment / contact unlock
      'contact_unlocked', 'payout_approved',
      // review
      'review_new', 'review_deleted',
      // admin
      'admin_added',
      // message
      'new_message',
    ],
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  read: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
