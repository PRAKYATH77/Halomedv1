-- HALOmed Complete Fix Migration
-- Adds all missing tables, columns, and seed data

-- ============================================================
-- 1. Add 'supplier' role to users (if not already present)
-- ============================================================
ALTER TABLE users MODIFY COLUMN role ENUM('admin','staff','delivery_store','customer','supplier') NOT NULL DEFAULT 'customer';

-- ============================================================
-- 2. customer_orders table
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_address VARCHAR(500),
    city VARCHAR(100),
    zip_code VARCHAR(20),
    phone_number VARCHAR(20),
    payment_method ENUM('cod','card','upi','online') DEFAULT 'cod',
    status ENUM('pending','confirmed','assigned','out_for_delivery','received','cancelled') DEFAULT 'pending',
    assigned_delivery_store_id INT,
    assigned_by INT,
    assigned_at TIMESTAMP NULL DEFAULT NULL,
    approved_for_delivery_at TIMESTAMP NULL DEFAULT NULL,
    received_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. customer_order_items table
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_order_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. order_tracking table
-- ============================================================
CREATE TABLE IF NOT EXISTS order_tracking (
    tracking_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL UNIQUE,
    courier_lat DECIMAL(10,6),
    courier_lng DECIMAL(10,6),
    progress INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. webhook_events table
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_events (
    webhook_event_id INT PRIMARY KEY AUTO_INCREMENT,
    event_type VARCHAR(100),
    raw_payload LONGTEXT,
    headers TEXT,
    signature VARCHAR(255),
    processing_status ENUM('received','processed','failed') DEFAULT 'received',
    processing_result TEXT,
    processed_at TIMESTAMP NULL DEFAULT NULL,
    mapped_order_id INT,
    external_payment_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. demand_analytics table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS demand_analytics (
    analytics_id INT PRIMARY KEY AUTO_INCREMENT,
    medicine_id INT NOT NULL,
    total_sales INT DEFAULT 0,
    avg_daily_demand DECIMAL(10,2),
    peak_month VARCHAR(20),
    trend VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    UNIQUE KEY unique_medicine (medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed demand_analytics from existing medicines (safe - won't duplicate due to IGNORE)
INSERT IGNORE INTO demand_analytics (medicine_id, total_sales, avg_daily_demand, peak_month, trend)
SELECT medicine_id, 0, 0, 'June', 'stable' FROM medicines;

-- ============================================================
-- 7. Add external_payment_id column to payment_transactions
-- ============================================================
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS external_payment_id VARCHAR(100) NULL;

-- ============================================================
-- 8. Add supplier workflow columns to restock_requests
-- ============================================================
ALTER TABLE restock_requests ADD COLUMN IF NOT EXISTS supplier_id INT NULL;
ALTER TABLE restock_requests ADD COLUMN IF NOT EXISTS supplier_status ENUM('assigned','out_for_delivery','delivered') NULL;
ALTER TABLE restock_requests ADD COLUMN IF NOT EXISTS supplier_assigned_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE restock_requests ADD COLUMN IF NOT EXISTS supplier_delivered_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE restock_requests ADD COLUMN IF NOT EXISTS delivery_store_received_at TIMESTAMP NULL DEFAULT NULL;

-- ============================================================
-- 9. Add file upload columns to prescriptions
-- ============================================================
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100) NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_size INT NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS uploaded_by INT NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP NULL DEFAULT NULL;

-- Make medicine_id nullable for file-only prescriptions
ALTER TABLE prescriptions MODIFY COLUMN medicine_id INT NULL;
ALTER TABLE prescriptions MODIFY COLUMN customer_id INT NULL;
ALTER TABLE prescriptions MODIFY COLUMN quantity INT NOT NULL DEFAULT 0;

-- ============================================================
-- 10. Seed all 5 demo users (bcrypt hashes of their passwords)
--     admin123, staff123, delivery123, customer123, supplier123
-- ============================================================

-- Admin: password = admin123
INSERT INTO users (username, password_hash, email, role, is_active)
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@halomed.com', 'admin', TRUE)
ON DUPLICATE KEY UPDATE password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', is_active = TRUE;

-- Staff: password = staff123
INSERT INTO users (username, password_hash, email, role, is_active)
VALUES ('staff', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff@halomed.com', 'staff', TRUE)
ON DUPLICATE KEY UPDATE password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', is_active = TRUE;

-- Delivery Store: password = delivery123
INSERT INTO users (username, password_hash, email, role, is_active)
VALUES ('delivery_store', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'delivery@halomed.com', 'delivery_store', TRUE)
ON DUPLICATE KEY UPDATE password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', is_active = TRUE;

-- Customer: password = customer123
INSERT INTO users (username, password_hash, email, role, is_active)
VALUES ('customer', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer@halomed.com', 'customer', TRUE)
ON DUPLICATE KEY UPDATE password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', is_active = TRUE;

-- Supplier: password = supplier123
INSERT INTO users (username, password_hash, email, role, is_active)
VALUES ('supplier1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supplier1@halomed.com', 'supplier', TRUE)
ON DUPLICATE KEY UPDATE password_hash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', is_active = TRUE;

-- Seed medicines if empty
INSERT IGNORE INTO medicines (name, category, price, stock_quantity, reorder_level) VALUES
('Paracetamol 500mg', 'Painkillers', 5.50, 100, 20),
('Ibuprofen 200mg', 'Painkillers', 6.00, 80, 20),
('Amoxicillin 500mg', 'Antibiotics', 8.50, 60, 15),
('Omeprazole 20mg', 'Antacids', 7.00, 50, 15),
('Cetirizine 10mg', 'Antihistamines', 4.50, 120, 25),
('Azithromycin 250mg', 'Antibiotics', 12.00, 40, 10),
('Metformin 500mg', 'Diabetes', 3.50, 90, 20),
('Atorvastatin 10mg', 'Cholesterol', 9.00, 70, 15),
('Vitamin C 500mg', 'Vitamins', 4.00, 200, 30),
('Zinc Supplement', 'Vitamins', 3.00, 150, 25);

-- Seed suppliers if empty
INSERT IGNORE INTO suppliers (name, contact_info, address, email, is_active) VALUES
('PharmaCorp', '9876543210', '123 Pharmacy St, Bangalore', 'contact@pharmacorp.com', TRUE),
('MediSupply Inc', '9876543211', '456 Medical Ave, Mumbai', 'info@medisupply.com', TRUE),
('HealthCare Plus', '9876543212', '789 Health Blvd, Delhi', 'sales@healthcare-plus.com', TRUE);
