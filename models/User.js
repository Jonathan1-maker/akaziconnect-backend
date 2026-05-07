const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  role: { type: String, enum: ['customer', 'worker', 'admin', 'company'], default: 'customer' },
  isActive: { type: Boolean, default: true },
  isSuperAdmin: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
