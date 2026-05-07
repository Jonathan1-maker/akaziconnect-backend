const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  company:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true, trim: true },
  title:       { type: String, required: true, trim: true },
  category:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  location:    { type: String, required: true, trim: true },
  type:        { type: String, enum: ['full-time', 'part-time', 'contract', 'temporary'], default: 'full-time' },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  requirements:{ type: String, trim: true, maxlength: 1000 },
  salary:      { type: String, trim: true },
  deadline:    { type: Date },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

jobSchema.index({ title: 'text', description: 'text', companyName: 'text' });

module.exports = mongoose.model('Job', jobSchema);
