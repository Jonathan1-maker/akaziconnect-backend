const Job = require('../models/Job');

const getJobs = async (req, res) => {
  try {
    const { category, location, type, search, page = 1, limit = 12 } = req.query;
    const filter = { isActive: true };

    if (category) {
      const Category = require('../models/Category');
      const cat = await Category.findOne({ slug: category });
      if (cat) filter.category = cat._id;
      else return res.json({ jobs: [], total: 0, pages: 0 });
    }
    if (location) filter.location = new RegExp(location, 'i');
    if (type) filter.type = type;
    if (search) filter.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      Job.find(filter).populate('category', 'name icon slug').populate('company', 'name').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Job.countDocuments(filter),
    ]);
    res.json({ jobs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch jobs' });
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('category', 'name icon slug').populate('company', 'name phone');
    if (!job || !job.isActive) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch job' });
  }
};

const createJob = async (req, res) => {
  try {
    const { companyName, title, category, location, type, description, requirements, salary, deadline } = req.body;
    if (!companyName || !title || !category || !location || !description)
      return res.status(400).json({ message: 'companyName, title, category, location and description are required' });

    const job = await Job.create({
      company: req.user._id, companyName, title, category, location,
      type, description, requirements, salary, deadline: deadline || null,
    });
    await job.populate('category', 'name icon slug');
    res.status(201).json({ message: 'Job posted successfully', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to post job', error: err.message });
  }
};

const updateJob = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, company: req.user._id });
    if (!job) return res.status(404).json({ message: 'Job not found or not yours' });
    Object.assign(job, req.body);
    await job.save();
    await job.populate('category', 'name icon slug');
    res.json({ message: 'Job updated', job });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update job' });
  }
};

const deleteJob = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, company: req.user._id });
    if (!job) return res.status(404).json({ message: 'Job not found or not yours' });
    job.isActive = false;
    await job.save();
    res.json({ message: 'Job removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete job' });
  }
};

const getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ company: req.user._id }).populate('category', 'name icon slug').sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch your jobs' });
  }
};

module.exports = { getJobs, getJobById, createJob, updateJob, deleteJob, getMyJobs };
