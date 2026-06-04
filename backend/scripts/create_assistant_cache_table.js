import mysql from 'mysql2/promise';
import { ensureAssistantCacheTable } from '../src/utils/assistantCache.js';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'halomed_user',
  password: 'halomed_pass123',
  database: 'halomed_pharmacy',
});

await ensureAssistantCacheTable(pool);
const [rows] = await pool.query("SHOW TABLES LIKE 'assistant_cache'");
console.log(rows);
await pool.end();

