const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 300 },
  isFlagged: { type: Boolean, default: false },
  flagReason: { type: String, trim: true, default: '' },
}, { timestamps: true });

reviewSchema.index({ worker: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
