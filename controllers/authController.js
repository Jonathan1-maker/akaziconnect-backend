const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const register = async (req, res) => {
  try {
    const { name, phone, role } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'Phone already registered' });

    const allowedRoles = ['worker', 'company'];
    const user = await User.create({ name, phone, role: allowedRoles.includes(role) ? role : 'customer' });
    res.status(201).json({
      _id: user._id, name: user.name, phone: user.phone,
      role: user.role, isSuperAdmin: user.isSuperAdmin,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

    res.json({
      _id: user._id, name: user.name, phone: user.phone,
      role: user.role, isSuperAdmin: user.isSuperAdmin,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Login failed', error: err.message });
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

    // check if this user is a worker and return worker name if available
    const Worker = require('../models/Worker');
    const worker = await Worker.findOne({ user: req.params.id }).select('name');

    res.json({ _id: user._id, name: worker?.name || user.name, phone: user.phone });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get user' });
  }
};

module.exports = { register, login, getMe, getUserById };
