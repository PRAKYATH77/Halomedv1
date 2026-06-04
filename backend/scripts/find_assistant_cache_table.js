import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'halomed_user',
  password: 'halomed_pass123',
  database: 'information_schema',
});

const [rows] = await pool.query("SELECT table_schema FROM TABLES WHERE table_name = 'assistant_cache'");
console.log(rows);

await pool.end();
