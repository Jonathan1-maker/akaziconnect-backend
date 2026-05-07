const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const { applyForJob, getJobApplications, updateApplicationStatus, getMyApplications, checkApplication } = require('../controllers/applicationController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf|doc|docx/;
  cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
}});

router.get('/my', protect, getMyApplications);
router.get('/:jobId', protect, getJobApplications);
router.get('/:jobId/check', protect, checkApplication);
router.post('/:jobId', protect, upload.array('documents', 5), applyForJob);
router.put('/:id/status', protect, updateApplicationStatus);

module.exports = router;
