import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const sql = `
CREATE TABLE IF NOT EXISTS restock_requests (
  request_id INT PRIMARY KEY AUTO_INCREMENT,
  medicine_id INT NOT NULL,
  requested_by INT NOT NULL,
  quantity_requested INT NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  admin_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
  FOREIGN KEY (requested_by) REFERENCES users(user_id),
  FOREIGN KEY (admin_id) REFERENCES users(user_id),
  INDEX idx_status (status),
  INDEX idx_medicine_id (medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'halomed_db',
    port: Number(process.env.DB_PORT || 3306),
  });

  try {
    await connection.query(sql);
    console.log('restock_requests table is ready.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Failed to create restock_requests table:', error.message);
  process.exit(1);
});
