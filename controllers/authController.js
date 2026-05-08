const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const register = async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ message: 'Name, phone and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'Phone already registered' });

    const allowedRoles = ['worker', 'company'];
    const user = await User.create({ name, phone, email: email || undefined, password, role: allowedRoles.includes(role) ? role : 'customer' });
    res.status(201).json({
      _id: user._id, name: user.name, phone: user.phone, email: user.email,
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
      _id: user._id, name: user.name, phone: user.phone, email: user.email,
      role: user.role, isSuperAdmin: user.isSuperAdmin,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both fields are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.password) return res.status(400).json({ message: 'No password set. Contact admin.' });

    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.user._id, { password: hashed });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to change password' });
  }
};

const updateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const existing = await User.findOne({ email });
    if (existing && existing._id.toString() !== req.user._id.toString()) return res.status(400).json({ message: 'Email already in use' });
    await User.findByIdAndUpdate(req.user._id, { email });
    res.json({ message: 'Email updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update email' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('_id name phone email role isSuperAdmin isActive');
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

module.exports = { register, login, changePassword, updateEmail, getMe, getUserById };
