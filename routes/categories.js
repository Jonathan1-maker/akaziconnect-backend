const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getCategories, suggestCategory, seedCategories, getPendingCategories, approveCategory, rejectCategory } = require('../controllers/categoryController');

router.get('/', getCategories);
router.post('/suggest', protect, suggestCategory);
router.post('/seed', protect, adminOnly, seedCategories);

// admin
router.get('/pending', protect, adminOnly, getPendingCategories);
router.put('/:id/approve', protect, adminOnly, approveCategory);
router.delete('/:id/reject', protect, adminOnly, rejectCategory);

module.exports = router;
