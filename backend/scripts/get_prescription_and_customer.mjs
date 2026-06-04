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
    const [pres] = await pool.query('SELECT * FROM prescriptions WHERE prescription_id = ? LIMIT 1', [1]);
    console.log('pres:', pres[0]);
    const custId = pres[0].customer_id;
    const [cust] = await pool.query('SELECT * FROM customers WHERE customer_id = ? LIMIT 1', [custId]);
    console.log('customer:', cust[0]);
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
})();
