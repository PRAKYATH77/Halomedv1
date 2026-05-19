import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'halomed_user',
  password: 'halomed_pass123',
  database: 'halomed_pharmacy',
});

async function createTestUsers() {
  try {
    const connection = await pool.getConnection();

    // Hash passwords
    const staffPass = await bcrypt.hash('staff123', 10);
    const customerPass = await bcrypt.hash('customer123', 10);
    const deliveryStorePass = await bcrypt.hash('delivery123', 10);
    const supplierPass = await bcrypt.hash('supplier123', 10);

    // Insert test users
    await connection.query(
      `INSERT IGNORE INTO users (username, password_hash, email, role, is_active) VALUES 
       (?, ?, ?, ?, TRUE), 
       (?, ?, ?, ?, TRUE),
       (?, ?, ?, ?, TRUE),
       (?, ?, ?, ?, TRUE)`,
      [
        'staff', staffPass, 'staff@halomed.com', 'staff',
        'customer', customerPass, 'customer@halomed.com', 'customer',
        'delivery_store', deliveryStorePass, 'delivery@halomed.com', 'delivery_store',
        'supplier1', supplierPass, 'supplier1@halomed.com', 'supplier',
      ]
    );

    // Verify users
    const [users] = await connection.query(
      'SELECT user_id, username, email, role FROM users WHERE username IN (?, ?, ?, ?, ?)',
      ['admin', 'staff', 'customer', 'delivery_store', 'supplier1']
    );

    console.log('✅ Test users created successfully:\n');
    console.log('Admin User:');
    console.log('  Username: admin');
    console.log('  Password: admin123\n');
    
    console.log('Staff User:');
    console.log('  Username: staff');
    console.log('  Password: staff123\n');
    
    console.log('Customer User:');
    console.log('  Username: customer');
    console.log('  Password: customer123\n');

    console.log('Delivery Store User:');
    console.log('  Username: delivery_store');
    console.log('  Password: delivery123\n');
    
    console.log('Supplier User:');
    console.log('  Username: supplier1');
    console.log('  Password: supplier123\n');
    
    console.log('Database records:');
    users.forEach(user => {
      console.log(`  ${user.username} (${user.role}) - ${user.email}`);
    });

    connection.release();
    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
}

createTestUsers();
