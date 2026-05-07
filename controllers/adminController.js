const User = require('../models/User');
const Worker = require('../models/Worker');
const Review = require('../models/Review');
const { notify } = require('../config/notify');

const getStats = async (req, res) => {
  const [totalUsers, totalWorkers, pendingWorkers, totalReviews] = await Promise.all([
    User.countDocuments(),
    Worker.countDocuments({ isApproved: true }),
    Worker.countDocuments({ isApproved: false, isActive: true }),
    Review.countDocuments(),
  ]);
  res.json({ totalUsers, totalWorkers, pendingWorkers, totalReviews });
};

const getAllUsers = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
};

// super admin only
const toggleUserActive = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.isSuperAdmin) return res.status(403).json({ message: 'Cannot deactivate super admin' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, user });
};

const getAllWorkers = async (req, res) => {
  const workers = await Worker.find().populate('category', 'name icon').sort({ createdAt: -1 });
  res.json(workers);
};

const getAllReviews = async (req, res) => {
  const reviews = await Review.find()
    .populate('reviewer', 'name')
    .populate('worker', 'name')
    .sort({ createdAt: -1 });
  res.json(reviews);
};

// super admin only
const deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  const reviews = await Review.find({ worker: review.worker });
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  await Worker.findByIdAndUpdate(review.worker, { averageRating: avg.toFixed(1), totalReviews: reviews.length });
  res.json({ message: 'Review deleted' });
};

// super admin only — get all admins
const getAdmins = async (req, res) => {
  const admins = await User.find({ role: 'admin' }).sort({ createdAt: -1 });
  res.json(admins);
};

// super admin only — add new sub-admin
const addAdmin = async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

  let user = await User.findOne({ phone });
  if (user) {
    if (user.role === 'admin') return res.status(400).json({ message: 'Already an admin' });
    user.role = 'admin';
    user.isSuperAdmin = false;
    await user.save();
  } else {
    user = await User.create({ name, phone, role: 'admin', isSuperAdmin: false });
  }

  // notify new sub-admin
  await notify(
    user._id, 'admin_added',
    '👑 You are now an Admin',
    `You have been added as a sub-admin on AkaziConnect by the super admin. Login to access the admin panel.`,
    {}
  );

  res.status(201).json({ message: 'Sub-admin added successfully', user });
};

// super admin only — remove admin (demote to customer)
const removeAdmin = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.isSuperAdmin) return res.status(403).json({ message: 'Cannot remove super admin' });
  if (user.role !== 'admin') return res.status(400).json({ message: 'User is not an admin' });

  user.role = 'customer';
  await user.save();
  res.json({ message: 'Admin removed successfully', user });
};

module.exports = {
  getStats, getAllUsers, toggleUserActive,
  getAllWorkers, getAllReviews, deleteReview,
  getAdmins, addAdmin, removeAdmin,
};
