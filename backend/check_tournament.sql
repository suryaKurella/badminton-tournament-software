SELECT id, name, status, started_at, is_paused, paused_at, total_paused_time, created_at
FROM tournaments
WHERE status = 'ACTIVE'
ORDER BY created_at DESC
LIMIT 5;
