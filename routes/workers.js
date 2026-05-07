const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, adminOnly } = require('../middleware/auth');
const {
  registerWorker, getWorkers, getWorkerById,
  approveWorker, rejectWorker, getPendingWorkers, verifyWorker,
  getMyProfile, updateMyProfile,
} = require('../controllers/workerController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/', getWorkers);
router.get('/pending', protect, adminOnly, getPendingWorkers);
router.get('/me', protect, getMyProfile);
router.put('/me', protect, upload.single('photo'), updateMyProfile);
router.get('/:id', getWorkerById);
router.post('/register', protect, upload.single('photo'), registerWorker);
router.put('/:id/approve', protect, adminOnly, approveWorker);
router.put('/:id/reject', protect, adminOnly, rejectWorker);
router.put('/:id/verify', protect, adminOnly, verifyWorker);

module.exports = router;
