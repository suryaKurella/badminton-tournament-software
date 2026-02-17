const featureFlagService = require('../services/featureFlag.service');

/**
 * Middleware that checks if a feature flag is enabled.
 * Returns 404 if disabled. Fails open on errors.
 */
const requireFlag = (flagName) => {
  return async (req, res, next) => {
    try {
      const enabled = await featureFlagService.isEnabled(flagName);
      if (!enabled) {
        return res.status(404).json({
          success: false,
          message: 'This feature is not currently available',
        });
      }
      next();
    } catch (error) {
      console.error(`Feature flag check error for '${flagName}':`, error);
      next(); // Fail open
    }
  };
};

module.exports = { requireFlag };
