const Category = require('../models/Category');
const { protect } = require('../middleware/auth');

const getCategories = async (req, res) => {
  const categories = await Category.find({ isApproved: true });
  res.json(categories);
};

// worker suggests a custom category — saved as pending (isApproved: false)
const suggestCategory = async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Category name is required' });

  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // return existing if already suggested/approved
  const existing = await Category.findOne({ slug });
  if (existing) return res.json(existing);

  const category = await Category.create({
    name: name.trim(),
    icon: '🔨',
    slug,
    isApproved: false,
    suggestedBy: req.user?._id || null,
  });

  res.status(201).json(category);
};

const seedCategories = async (req, res) => {
  const defaults = [
    { name: 'Plumbing',      icon: '🔧', slug: 'plumbing' },
    { name: 'Cleaning',      icon: '🧹', slug: 'cleaning' },
    { name: 'Electrical',    icon: '⚡', slug: 'electrical' },
    { name: 'Construction',  icon: '🏗️', slug: 'construction' },
    { name: 'Delivery',      icon: '🚚', slug: 'delivery' },
  ];

  await Category.deleteMany();
  const categories = await Category.insertMany(defaults);
  res.status(201).json({ message: 'Categories seeded', categories });
};

// admin — get all pending suggested categories
const getPendingCategories = async (req, res) => {
  const categories = await Category.find({ isApproved: false })
    .populate('suggestedBy', 'name phone')
    .sort({ createdAt: -1 });
  res.json(categories);
};

// admin — approve a suggested category
const approveCategory = async (req, res) => {
  const { icon } = req.body;
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { isApproved: true, ...(icon && { icon }) },
    { new: true }
  );
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ message: 'Category approved', category });
};

// admin — reject (delete) a suggested category
const rejectCategory = async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ message: 'Category rejected and removed' });
};

module.exports = { getCategories, suggestCategory, seedCategories, getPendingCategories, approveCategory, rejectCategory };
