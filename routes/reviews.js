const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { addReview, getWorkerReviews, flagReview } = require('../controllers/reviewController');

router.get('/:workerId', getWorkerReviews);
router.post('/:workerId', protect, addReview);
router.put('/:id/flag', protect, adminOnly, flagReview);

module.exports = router;
