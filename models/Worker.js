const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  whatsapp: { type: String, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  location: { type: String, required: true, trim: true },
  description: { type: String, trim: true, maxlength: 500 },
  photo: { type: String, default: '' },
  yearsOfExperience: { type: Number, default: 0 },
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  registrationFeePaid: { type: Boolean, default: false },
  registrationFeeReference: { type: String, default: '' },
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
}, { timestamps: true });

workerSchema.index({ location: 'text', name: 'text', description: 'text' });

module.exports = mongoose.model('Worker', workerSchema);
