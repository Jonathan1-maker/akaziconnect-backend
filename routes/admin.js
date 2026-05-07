const express = require('express');
const router = express.Router();
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const {
  getStats, getAllUsers, toggleUserActive,
  getAllWorkers, getAllReviews, deleteReview,
  getAdmins, addAdmin, removeAdmin,
} = require('../controllers/adminController');

router.use(protect, adminOnly);

// all admins
router.get('/stats', getStats);
router.get('/users', getAllUsers);
router.get('/workers', getAllWorkers);
router.get('/reviews', getAllReviews);

// super admin only
router.put('/users/:id/toggle', superAdminOnly, toggleUserActive);
router.delete('/reviews/:id', superAdminOnly, deleteReview);
router.get('/admins', superAdminOnly, getAdmins);
router.post('/admins', superAdminOnly, addAdmin);
router.delete('/admins/:id', superAdminOnly, removeAdmin);

module.exports = router;
