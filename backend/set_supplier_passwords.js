import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'halomed_user',
  password: 'halomed_pass123',
  database: 'halomed_pharmacy',
});

const suppliers = [
  { username: 'supplier1', password: 'supplier1123' },
  { username: 'pharmacorp', password: 'pharmacorp123' },
  { username: 'medisupply_inc', password: 'medisupply_inc123' },
  { username: 'healthcare_plus', password: 'healthcare_plus123' },
];

async function setPasswords() {
  try {
    const connection = await pool.getConnection();

    for (const supplier of suppliers) {
      const hashedPassword = await bcrypt.hash(supplier.password, 10);
      
      const [result] = await connection.query(
        'UPDATE users SET password_hash = ? WHERE username = ?',
        [hashedPassword, supplier.username]
      );

      console.log(`✅ Password set for ${supplier.username}`);
      console.log(`   Username: ${supplier.username}`);
      console.log(`   Password: ${supplier.password}`);
      console.log();
    }

    connection.release();
    pool.end();
    console.log('✅ All supplier passwords updated successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setPasswords();
