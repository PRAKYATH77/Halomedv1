-- Create Staff and Customer test users
-- Both passwords are hashed versions of their plain passwords (staff123, customer123)

INSERT IGNORE INTO users (username, password_hash, email, role, is_active) VALUES
('staff', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36jbMFOP', 'staff@halomed.com', 'staff', TRUE),
('customer', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36jbMFOP', 'customer@halomed.com', 'customer', TRUE);

-- Verify users were created
SELECT user_id, username, email, role, is_active FROM users WHERE username IN ('admin', 'staff', 'customer');
