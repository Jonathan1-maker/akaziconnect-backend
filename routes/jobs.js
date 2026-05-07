const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getJobs, getJobById, createJob, updateJob, deleteJob, getMyJobs } = require('../controllers/jobController');

router.get('/', getJobs);
router.get('/my', protect, getMyJobs);
router.get('/:id', getJobById);
router.post('/', protect, createJob);
router.put('/:id', protect, updateJob);
router.delete('/:id', protect, deleteJob);

module.exports = router;
