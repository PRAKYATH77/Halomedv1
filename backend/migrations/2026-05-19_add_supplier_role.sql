-- Add 'supplier' to users.role enum
ALTER TABLE users MODIFY COLUMN role ENUM('admin','staff','delivery_store','customer','supplier') NOT NULL DEFAULT 'staff';
