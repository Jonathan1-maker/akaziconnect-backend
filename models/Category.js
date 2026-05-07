const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  icon: { type: String, default: '🔧' },
  slug: { type: String, required: true, unique: true, lowercase: true },
  isApproved: { type: Boolean, default: true },
  suggestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
