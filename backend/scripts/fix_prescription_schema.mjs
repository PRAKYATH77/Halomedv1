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
    const statements = [
      "ALTER TABLE prescriptions MODIFY medicine_id INT NULL",
      "ALTER TABLE prescriptions MODIFY prescribed_by VARCHAR(100) NULL",
      "ALTER TABLE prescriptions MODIFY date_issued DATE NULL",
      "ALTER TABLE prescriptions MODIFY quantity INT NULL DEFAULT 0",
    ];
    for (const s of statements) {
      try {
        await pool.query(s);
        console.log('Applied:', s);
      } catch (e) {
        console.warn('Skipped or failed:', s, e.message);
      }
    }
  } catch (err) {
    console.error('Schema fix failed:', err.message);
  } finally {
    await pool.end();
  }
})();
