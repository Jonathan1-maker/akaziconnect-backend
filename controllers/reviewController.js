const Review = require('../models/Review');
const Worker = require('../models/Worker');
const { notify } = require('../config/notify');

const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const workerId = req.params.workerId;

    if (!rating) return res.status(400).json({ message: 'Rating is required' });

    const existing = await Review.findOne({ worker: workerId, reviewer: req.user._id });
    if (existing) return res.status(400).json({ message: 'You already reviewed this worker' });

    const review = await Review.create({ worker: workerId, reviewer: req.user._id, rating, comment });

    const reviews = await Review.find({ worker: workerId });
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const worker = await Worker.findByIdAndUpdate(workerId, { averageRating: avg.toFixed(1), totalReviews: reviews.length }, { new: true });

    // notify worker of new review
    if (worker) {
      await notify(
        worker.user, 'review_new',
        '⭐ New Review',
        `${req.user.name} gave you ${rating} star${rating > 1 ? 's' : ''}${comment ? `: "${comment}"` : '.'}`,
        { workerId, reviewId: review._id }
      );
    }

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add review' });
  }
};

const getWorkerReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ worker: req.params.workerId })
      .populate('reviewer', 'name')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
};

const flagReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    review.isFlagged = !review.isFlagged;
    review.flagReason = review.isFlagged ? (req.body.reason || 'Flagged by admin') : '';
    await review.save();
    res.json({ message: `Review ${review.isFlagged ? 'flagged' : 'unflagged'}`, review });
  } catch (err) {
    res.status(500).json({ message: 'Failed to flag review' });
  }
};

module.exports = { addReview, getWorkerReviews, flagReview };
