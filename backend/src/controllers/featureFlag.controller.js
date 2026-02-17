const featureFlagService = require('../services/featureFlag.service');

// @desc    Get all feature flags (public - name:enabled map)
// @route   GET /api/feature-flags
// @access  Public
const getFeatureFlags = async (req, res) => {
  try {
    const flags = await featureFlagService.getAllFlags();
    res.status(200).json({ success: true, data: flags });
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({ success: false, message: 'Error getting feature flags' });
  }
};

// @desc    Get all feature flags with full details (admin)
// @route   GET /api/feature-flags/admin
// @access  ROOT, ADMIN
const getFeatureFlagsAdmin = async (req, res) => {
  try {
    const flags = await featureFlagService.getAllFlagsDetailed();
    res.status(200).json({ success: true, data: flags });
  } catch (error) {
    console.error('Get feature flags admin error:', error);
    res.status(500).json({ success: false, message: 'Error getting feature flags' });
  }
};

// @desc    Update a feature flag
// @route   PUT /api/feature-flags/:name
// @access  ROOT, ADMIN
const updateFeatureFlag = async (req, res) => {
  try {
    const { name } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled must be a boolean' });
    }

    const flag = await featureFlagService.updateFlag(name, enabled);
    res.status(200).json({ success: true, data: flag });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: `Feature flag '${req.params.name}' not found` });
    }
    console.error('Update feature flag error:', error);
    res.status(500).json({ success: false, message: 'Error updating feature flag' });
  }
};

module.exports = { getFeatureFlags, getFeatureFlagsAdmin, updateFeatureFlag };
