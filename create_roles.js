import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: './backend/.env' });

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'halomed_user',
  password: process.env.DB_PASSWORD || 'halomed_pass123',
  database: process.env.DB_NAME || 'halomed_pharmacy',
  port: process.env.DB_PORT || 3306,
});

console.log('✅ Connected to database');

const users = [
  { username: 'staff1',    email: 'staff1@halomed.com',    password: 'staff123',    role: 'staff' },
  { username: 'customer1', email: 'customer1@halomed.com', password: 'customer123', role: 'customer' },
];

for (const u of users) {
  try {
    // Check if already exists
    const [exists] = await db.execute('SELECT user_id FROM users WHERE username = ?', [u.username]);
    if (exists.length > 0) {
      console.log(`⚠️  User "${u.username}" already exists — skipping`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    await db.execute(
      'INSERT INTO users (username, password_hash, email, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [u.username, hash, u.email, u.role]
    );
    console.log(`✅ Created ${u.role} user: ${u.username} / ${u.password}`);
  } catch (err) {
    console.error(`❌ Failed to create ${u.username}:`, err.message);
  }
}

// Show all users
const [rows] = await db.execute('SELECT user_id, username, email, role, is_active FROM users');
console.log('\n📋 All users in database:');
console.table(rows);

await db.end();
