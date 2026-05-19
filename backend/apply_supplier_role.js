import mysql from 'mysql2/promise';

async function apply() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'halomed_user',
    password: 'halomed_pass123',
    database: 'halomed_pharmacy',
  });

  try {
    const connection = await pool.getConnection();
    console.log('Applying ALTER TABLE to add supplier role...');
    await connection.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','staff','delivery_store','customer','supplier') NOT NULL DEFAULT 'staff'");
    console.log('Migration applied successfully.');
    connection.release();
    process.exit(0);
  } catch (err) {
    console.error('Failed to apply migration:', err.message || err);
    process.exit(1);
  }
}

apply();
