const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
  job:         { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  applicant:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true, trim: true },
  phone:       { type: String, required: true, trim: true },
  coverLetter: { type: String, trim: true, maxlength: 1000 },
  documents:   [{ type: String }], // array of file paths
  status:      { type: String, enum: ['pending', 'reviewed', 'accepted', 'rejected'], default: 'pending' },
  companyNote: { type: String, trim: true },
}, { timestamps: true });

jobApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
