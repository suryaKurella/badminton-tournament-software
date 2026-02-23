/**
 * Per-match mutex lock to prevent concurrent modifications.
 *
 * When two requests try to modify the same match simultaneously
 * (e.g. two people scoring points at the same time), the second
 * request waits for the first to finish before proceeding.
 *
 * This works because Node.js is single-process. For multi-process
 * deployments, use Redis-based distributed locks instead.
 */

const locks = new Map();

/**
 * Acquire a lock for a given key (e.g. matchId).
 * Returns a release function that MUST be called when done.
 * The release function is safe to call multiple times.
 */
async function acquireLock(key) {
  while (locks.has(key)) {
    await locks.get(key);
  }

  let releaseFn;
  const promise = new Promise((resolve) => {
    releaseFn = resolve;
  });
  locks.set(key, promise);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks.delete(key);
    releaseFn();
  };
}

/**
 * Express middleware that locks on req.params.id (matchId).
 * Ensures only one request modifies a given match at a time.
 * Includes a safety timeout to prevent permanent lock leaks.
 */
function matchLockMiddleware(req, res, next) {
  const matchId = req.params.id;
  if (!matchId) return next();

  acquireLock(`match:${matchId}`).then((release) => {
    // Release on whichever fires first: finish, close, or safety timeout
    const safeRelease = () => {
      clearTimeout(timeout);
      release();
    };
    res.on('finish', safeRelease);
    res.on('close', safeRelease);
    // Safety timeout: release lock after 30s even if response never finishes
    const timeout = setTimeout(safeRelease, 30000);
    next();
  });
}

module.exports = { acquireLock, matchLockMiddleware };
