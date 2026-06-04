import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'halomed_db',
    port: process.env.DB_PORT || 3306,
  });
  try {
    const [rows] = await pool.query('DESCRIBE prescriptions');
    console.log(rows);
  } catch (err) {
    console.error('Describe failed:', err.message);
  } finally {
    await pool.end();
  }
})();
