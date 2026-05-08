const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const { applyForJob, getJobApplications, updateApplicationStatus, getMyApplications, checkApplication } = require('../controllers/applicationController');

router.get('/my', protect, getMyApplications);
router.get('/:jobId', protect, getJobApplications);
router.get('/:jobId/check', protect, checkApplication);
router.post('/:jobId', protect, upload.array('documents', 5), applyForJob);
router.put('/:id/status', protect, updateApplicationStatus);

module.exports = router;
