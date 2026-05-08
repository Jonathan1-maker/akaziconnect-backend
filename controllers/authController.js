const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendSMS } = require('../config/sms');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// In-memory OTP store: phone -> { code, expiresAt }
const otpStore = new Map();

const register = async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ message: 'Name, phone and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'Phone already registered' });

    const allowedRoles = ['worker', 'company'];
    const user = await User.create({ name, phone, password, role: allowedRoles.includes(role) ? role : 'customer' });
    res.status(201).json({
      _id: user._id, name: user.name, phone: user.phone,
      role: user.role, isSuperAdmin: user.isSuperAdmin,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: 'Phone and password are required' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ message: 'Incorrect password' });

    res.json({
      _id: user._id, name: user.name, phone: user.phone,
      role: user.role, isSuperAdmin: user.isSuperAdmin,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// Step 1: send OTP to phone
const sendResetOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: 'No account found with this phone number' });

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    otpStore.set(phone, { code, expiresAt });

    await sendSMS(phone, `AkaziConnect: Your password reset code is ${code}. Valid for 10 minutes.`);

    // In dev (no Twilio), return code in response
    const isDev = !process.env.TWILIO_ACCOUNT_SID;
    res.json({ message: 'OTP sent to your phone', ...(isDev && { code }) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// Step 2: verify OTP + set new password
const resetPassword = async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) return res.status(400).json({ message: 'Phone, code and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const stored = otpStore.get(phone);
    if (!stored) return res.status(400).json({ message: 'No OTP requested for this number' });
    if (Date.now() > stored.expiresAt) { otpStore.delete(phone); return res.status(400).json({ message: 'OTP has expired. Request a new one.' }); }
    if (stored.code !== code) return res.status(400).json({ message: 'Incorrect OTP code' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save();
    otpStore.delete(phone);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both fields are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user._id);
    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('_id name phone role isSuperAdmin isActive');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user' });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name phone');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const Worker = require('../models/Worker');
    const worker = await Worker.findOne({ user: req.params.id }).select('name');
    res.json({ _id: user._id, name: worker?.name || user.name, phone: user.phone });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user' });
  }
};

module.exports = { register, login, sendResetOTP, resetPassword, changePassword, getMe, getUserById };
