import mysql from 'mysql2/promise';
import {
  buildCacheKey,
  ensureAssistantCacheTable,
  getCachedAssistantResponse,
  upsertCachedAssistantResponse,
} from '../src/utils/assistantCache.js';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'halomed_user',
  password: 'halomed_pass123',
  database: 'halomed_pharmacy',
});

await ensureAssistantCacheTable(pool);

const message = 'how does delivery tracking work?';
const history = [];
const { cacheKey, normalizedMessage, historyHash } = buildCacheKey({ userId: 999, message, history });

let cached = await getCachedAssistantResponse({ pool, cacheKey, ttlSeconds: 86400 });
console.log('before', cached);

if (!cached) {
  await upsertCachedAssistantResponse({
    pool,
    cacheKey,
    userId: 999,
    message: normalizedMessage,
    historyHash,
    response: { answer: 'demo', groundednessScore: 50, responseMode: 'app_help' },
  });
}

cached = await getCachedAssistantResponse({ pool, cacheKey, ttlSeconds: 86400 });
console.log('after', cached);

await pool.end();

