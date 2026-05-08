const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');

// Worker applies for a job
const applyForJob = async (req, res) => {
  try {
    const { name, phone, coverLetter } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

    const job = await Job.findById(req.params.jobId);
    if (!job || !job.isActive) return res.status(404).json({ message: 'Job not found' });

    const existing = await JobApplication.findOne({ job: req.params.jobId, applicant: req.user._id });
    if (existing) return res.status(400).json({ message: 'You have already applied for this job' });

    const documents = req.files ? req.files.map((f) => f.path || `/uploads/${f.filename}`) : [];

    const application = await JobApplication.create({
      job: req.params.jobId,
      applicant: req.user._id,
      name, phone, coverLetter, documents,
    });

    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit application', error: err.message });
  }
};

// Company gets all applications for a job
const getJobApplications = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, company: req.user._id });
    if (!job) return res.status(403).json({ message: 'Not your job' });

    const applications = await JobApplication.find({ job: req.params.jobId })
      .populate('applicant', 'name phone')
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch applications' });
  }
};

// Company updates application status
const updateApplicationStatus = async (req, res) => {
  try {
    const { status, companyNote } = req.body;
    const application = await JobApplication.findById(req.params.id).populate('job');
    if (!application) return res.status(404).json({ message: 'Application not found' });

    const job = await Job.findOne({ _id: application.job._id, company: req.user._id });
    if (!job) return res.status(403).json({ message: 'Not authorized' });

    application.status = status;
    if (companyNote !== undefined) application.companyNote = companyNote;
    await application.save();
    res.json({ message: 'Status updated', application });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status' });
  }
};

// Worker gets their own applications
const getMyApplications = async (req, res) => {
  try {
    const applications = await JobApplication.find({ applicant: req.user._id })
      .populate({ path: 'job', populate: { path: 'category', select: 'name icon' } })
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch applications' });
  }
};

// Check if user already applied
const checkApplication = async (req, res) => {
  try {
    const application = await JobApplication.findOne({ job: req.params.jobId, applicant: req.user._id });
    res.json({ applied: !!application, application });
  } catch (err) {
    res.status(500).json({ message: 'Failed to check application' });
  }
};

module.exports = { applyForJob, getJobApplications, updateApplicationStatus, getMyApplications, checkApplication };
