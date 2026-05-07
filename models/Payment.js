const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestPhone: { type: String, trim: true, default: '' },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  amount: { type: Number, required: true, default: 500 },
  adminShare: { type: Number, default: 400 },
  workerShare: { type: Number, default: 100 },
  currency: { type: String, default: 'RWF' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  workerPaid: { type: Boolean, default: false },
  method: { type: String, enum: ['momo', 'airtel', 'simulated'], default: 'momo' },
  reference: { type: String, unique: true },
}, { timestamps: true });

paymentSchema.index({ worker: 1 });
paymentSchema.index({ guestPhone: 1, worker: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
