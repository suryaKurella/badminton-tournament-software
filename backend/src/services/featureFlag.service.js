const { prisma } = require('../config/database');

// In-memory cache
let flagCache = {};
let lastRefresh = 0;
const REFRESH_INTERVAL = 60 * 1000; // 60 seconds

const refreshCache = async () => {
  try {
    const flags = await prisma.featureFlag.findMany();
    const newCache = {};
    for (const flag of flags) {
      newCache[flag.name] = flag.enabled;
    }
    flagCache = newCache;
    lastRefresh = Date.now();
  } catch (error) {
    console.error('Failed to refresh feature flag cache:', error);
  }
};

const ensureFresh = async () => {
  if (Date.now() - lastRefresh > REFRESH_INTERVAL) {
    await refreshCache();
  }
};

const isEnabled = async (flagName) => {
  await ensureFresh();
  return flagCache[flagName] === true;
};

const getAllFlags = async () => {
  await ensureFresh();
  return { ...flagCache };
};

const getAllFlagsDetailed = async () => {
  return prisma.featureFlag.findMany({ orderBy: { name: 'asc' } });
};

const updateFlag = async (flagName, enabled) => {
  const flag = await prisma.featureFlag.update({
    where: { name: flagName },
    data: { enabled },
  });
  flagCache[flagName] = enabled;
  return flag;
};

const initialize = async () => {
  await refreshCache();
  const count = Object.keys(flagCache).length;
  console.log(`✅ Feature flag cache initialized (${count} flags)`);
};

module.exports = { isEnabled, getAllFlags, getAllFlagsDetailed, updateFlag, initialize };
