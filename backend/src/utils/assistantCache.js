import crypto from 'crypto';

const normalizeMessage = (message) => String(message || '').trim().toLowerCase().replace(/\s+/g, ' ');

const historyToHash = (history) => {
  if (!Array.isArray(history) || history.length === 0) return null;
  const last = history
    .slice(-6)
    .map((entry) => String(entry?.content || entry?.message || '').trim())
    .filter(Boolean)
    .join('\n---\n');
  if (!last) return null;
  return crypto.createHash('sha256').update(last).digest('hex');
};

export const buildCacheKey = ({ userId, message, history }) => {
  const msg = normalizeMessage(message);
  const h = historyToHash(history);
  const raw = `${userId || 'anon'}|${msg}|${h || ''}`;
  return {
    cacheKey: crypto.createHash('sha256').update(raw).digest('hex'),
    normalizedMessage: msg,
    historyHash: h,
  };
};

let ensured = false;

export const ensureAssistantCacheTable = async (pool) => {
  if (ensured) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS assistant_cache (
      cache_key VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      history_hash VARCHAR(64) NULL,
      response_json JSON NOT NULL,
      hits INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_updated (user_id, updated_at)
    )`
  );
  ensured = true;
};

export const getCachedAssistantResponse = async ({ pool, cacheKey, ttlSeconds = 86400 }) => {
  const [rows] = await pool.query(
    `SELECT response_json
     FROM assistant_cache
     WHERE cache_key = ?
       AND updated_at >= (NOW() - INTERVAL ? SECOND)
     LIMIT 1`,
    [cacheKey, ttlSeconds]
  );
  if (rows.length === 0) return null;

  try {
    // MySQL may return JSON as object or string depending on driver settings
    const payload = rows[0].response_json;
    return typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch {
    return null;
  }
};

export const upsertCachedAssistantResponse = async ({ pool, cacheKey, userId, message, historyHash, response }) => {
  await pool.query(
    `INSERT INTO assistant_cache (cache_key, user_id, message, history_hash, response_json, hits)
     VALUES (?, ?, ?, ?, CAST(? AS JSON), 1)
     ON DUPLICATE KEY UPDATE
       response_json = VALUES(response_json),
       hits = hits + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [cacheKey, userId, message, historyHash, JSON.stringify(response)]
  );
};

