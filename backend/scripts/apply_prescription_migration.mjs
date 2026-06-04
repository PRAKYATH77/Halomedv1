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
    console.log('Running ALTER TABLE for prescriptions (per-column)...');
    const columns = [
      "file_path VARCHAR(512) NULL",
      "file_name VARCHAR(255) NULL",
      "file_mime VARCHAR(128) NULL",
      "file_size INT NULL",
      "uploaded_by INT NULL",
      "uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
    ];
    for (const col of columns) {
      try {
        await pool.query(`ALTER TABLE prescriptions ADD COLUMN ${col}`);
        console.log(`Added column: ${col.split(' ')[0]}`);
      } catch (err) {
        console.warn(`Skipping column (may exist): ${col.split(' ')[0]} —`, err.message);
      }
    }
    try {
      await pool.query('CREATE INDEX idx_prescriptions_customer_id ON prescriptions (customer_id)');
      console.log('Index created');
    } catch (e) {
      console.warn('Index create warning:', e.message);
    }
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
})();
