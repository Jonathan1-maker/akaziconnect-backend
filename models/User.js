const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, required: true, unique: true, trim: true },
  password:     { type: String, required: true },
  role:         { type: String, enum: ['customer', 'worker', 'admin', 'company'], default: 'customer' },
  isActive:     { type: Boolean, default: true },
  isSuperAdmin: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
