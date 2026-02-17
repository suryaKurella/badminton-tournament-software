const express = require('express');
const { getFeatureFlags, getFeatureFlagsAdmin, updateFeatureFlag } = require('../controllers/featureFlag.controller');
const { protect, authorize } = require('../middleware/supabaseAuth.middleware');

const router = express.Router();

router.get('/', getFeatureFlags);
router.get('/admin', protect, authorize('ROOT', 'ADMIN'), getFeatureFlagsAdmin);
router.put('/:name', protect, authorize('ROOT', 'ADMIN'), updateFeatureFlag);

module.exports = router;
