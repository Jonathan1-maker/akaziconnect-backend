const Worker = require('../models/Worker');
const User = require('../models/User');
const { notify } = require('../config/notify');

const registerWorker = async (req, res) => {
  try {
    const { name, phone, whatsapp, category, location, description, yearsOfExperience } = req.body;
    if (!name || !phone || !category || !location)
      return res.status(400).json({ message: 'Name, phone, category, and location are required' });

    const existing = await Worker.findOne({ user: req.user._id });
    if (existing) return res.status(400).json({ message: 'Worker profile already exists' });

    const photo = req.file ? req.file.path : '';
    // req.file.path is the Cloudinary URL when using CloudinaryStorage
    const worker = await Worker.create({
      user: req.user._id, name, phone, whatsapp, category, location,
      description, yearsOfExperience, photo, isApproved: false, registrationFeePaid: false,
    });

    await User.findByIdAndUpdate(req.user._id, { role: 'worker' });
    res.status(201).json({ message: 'Registration submitted. Pay 2000 RWF to activate your profile.', worker });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

const getWorkers = async (req, res) => {
  try {
    const { category, location, rating, search, page = 1, limit = 12 } = req.query;
    const filter = { isApproved: true, isActive: true };

    if (category) {
      const Category = require('../models/Category');
      const cat = await Category.findOne({ slug: category });
      if (cat) filter.category = cat._id;
      else return res.json({ workers: [], total: 0, page: Number(page), pages: 0 });
    }
    if (location) filter.location = new RegExp(location, 'i');
    if (rating) filter.averageRating = { $gte: Number(rating) };

    if (search) {
      const Category = require('../models/Category');
      // split search into words and match any category containing any word
      const words = search.trim().split(/\s+/);
      const regexes = words.map((w) => new RegExp(w, 'i'));
      const matchingCats = await Category.find({ name: { $in: regexes } }).select('_id');
      const catIds = matchingCats.map((c) => c._id);
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
        ...(catIds.length ? [{ category: { $in: catIds } }] : []),
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [workers, total] = await Promise.all([
      Worker.find(filter).populate('category', 'name icon slug').skip(skip).limit(Number(limit)).sort({ averageRating: -1 }),
      Worker.countDocuments(filter),
    ]);
    res.json({ workers, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch workers' });
  }
};

const getWorkerById = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id).populate('category', 'name icon slug').populate('user', 'name');
    if (!worker || !worker.isApproved) return res.status(404).json({ message: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker' });
  }
};

const approveWorker = async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    if (!worker) return res.status(404).json({ message: 'Worker not found' });

    await notify(
      worker.user, 'worker_approved',
      '✅ Profile Approved!',
      'Your worker profile has been approved. You are now visible to customers.',
      { workerId: worker._id }
    );

    res.json({ message: 'Worker approved', worker });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve worker' });
  }
};

const rejectWorker = async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!worker) return res.status(404).json({ message: 'Worker not found' });

    await notify(
      worker.user, 'worker_rejected',
      '❌ Profile Rejected',
      'Your worker profile was not approved. Please contact support for more information.',
      { workerId: worker._id }
    );

    res.json({ message: 'Worker rejected' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject worker' });
  }
};

const verifyWorker = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    worker.isVerified = !worker.isVerified;
    await worker.save();

    if (worker.isVerified) {
      await notify(
        worker.user, 'worker_verified',
        '🏅 Profile Verified!',
        'Congratulations! Your profile has been verified. A verified badge is now shown on your profile.',
        { workerId: worker._id }
      );
    }

    res.json({ message: `Worker ${worker.isVerified ? 'verified' : 'unverified'}`, worker });
  } catch (err) {
    res.status(500).json({ message: 'Failed to verify worker' });
  }
};

const getPendingWorkers = async (req, res) => {
  try {
    const workers = await Worker.find({ isApproved: false, isActive: true, registrationFeePaid: true }).populate('category', 'name');
    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pending workers' });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const worker = await Worker.findOne({ user: req.user._id }).populate('category', 'name icon slug');
    if (!worker) return res.status(404).json({ message: 'Worker profile not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const worker = await Worker.findOne({ user: req.user._id });
    if (!worker) return res.status(404).json({ message: 'Worker profile not found' });

    const { name, phone, whatsapp, category, location, description, yearsOfExperience } = req.body;
    if (name) worker.name = name;
    if (phone) worker.phone = phone;
    if (whatsapp !== undefined) worker.whatsapp = whatsapp;
    if (category) worker.category = category;
    if (location) worker.location = location;
    if (description !== undefined) worker.description = description;
    if (yearsOfExperience !== undefined) worker.yearsOfExperience = yearsOfExperience;
    if (req.file) worker.photo = req.file.path;

    await worker.save();
    await worker.populate('category', 'name icon slug');
    res.json({ message: 'Profile updated', worker });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};

module.exports = { registerWorker, getWorkers, getWorkerById, approveWorker, rejectWorker, getPendingWorkers, verifyWorker, getMyProfile, updateMyProfile };
