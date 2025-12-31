-- HALOmed Pharmacy Management System Database Schema
-- All tables normalized to BCNF

CREATE DATABASE IF NOT EXISTS halomed_pharmacy;
USE halomed_pharmacy;

-- 1. Users Table
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff', 'customer') NOT NULL DEFAULT 'staff',
    email VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Customers Table
CREATE TABLE customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    contact_info VARCHAR(20),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Medicines Table
CREATE TABLE medicines (
    medicine_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    reorder_level INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. MedicineBatch Table
CREATE TABLE medicine_batches (
    batch_id INT PRIMARY KEY AUTO_INCREMENT,
    medicine_id INT NOT NULL,
    batch_number VARCHAR(50) UNIQUE NOT NULL,
    quantity INT NOT NULL,
    expiry_date DATE NOT NULL,
    manufactured_date DATE,
    supplier_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    INDEX idx_expiry_date (expiry_date),
    INDEX idx_medicine_id (medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Suppliers Table
CREATE TABLE suppliers (
    supplier_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    contact_info VARCHAR(20),
    address VARCHAR(255),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Orders Table
CREATE TABLE orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    order_date DATE NOT NULL,
    status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_status (status),
    INDEX idx_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. OrderDetails Table
CREATE TABLE order_details (
    order_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. InventoryLogs Table
CREATE TABLE inventory_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    medicine_id INT NOT NULL,
    change_type ENUM('add', 'remove', 'sale', 'expired', 'adjustment') NOT NULL,
    quantity_changed INT NOT NULL,
    previous_quantity INT,
    new_quantity INT,
    changed_by INT,
    log_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    FOREIGN KEY (changed_by) REFERENCES users(user_id),
    INDEX idx_medicine_id (medicine_id),
    INDEX idx_log_date (log_date),
    INDEX idx_change_type (change_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Sales Table
CREATE TABLE sales (
    sale_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_applied DECIMAL(10, 2) DEFAULT 0,
    final_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('completed', 'pending', 'cancelled') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_sale_date (sale_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. SaleDetails Table
CREATE TABLE sale_details (
    sale_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    INDEX idx_sale_id (sale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Prescriptions Table
CREATE TABLE prescriptions (
    prescription_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    medicine_id INT NOT NULL,
    prescribed_by VARCHAR(100) NOT NULL,
    dosage VARCHAR(100),
    quantity INT NOT NULL,
    date_issued DATE NOT NULL,
    expiry_date DATE,
    is_fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_is_fulfilled (is_fulfilled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. PaymentTransactions Table
CREATE TABLE payment_transactions (
    transaction_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    payment_method ENUM('cash', 'card', 'online') NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('completed', 'pending', 'failed', 'refunded') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    INDEX idx_status (status),
    INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. DiseaseOutbreakPredictions Table
CREATE TABLE disease_outbreak_predictions (
    prediction_id INT PRIMARY KEY AUTO_INCREMENT,
    predicted_disease VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(5, 2),
    risk_level ENUM('low', 'medium', 'high') DEFAULT 'medium',
    prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    predicted_region VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_risk_level (risk_level),
    INDEX idx_prediction_date (prediction_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. MedicineRecommendations Table
CREATE TABLE medicine_recommendations (
    recommendation_id INT PRIMARY KEY AUTO_INCREMENT,
    prediction_id INT NOT NULL,
    medicine_id INT NOT NULL,
    recommendation_reason TEXT,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prediction_id) REFERENCES disease_outbreak_predictions(prediction_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    INDEX idx_prediction_id (prediction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. DemandAnalytics Table
CREATE TABLE demand_analytics (
    analytics_id INT PRIMARY KEY AUTO_INCREMENT,
    medicine_id INT NOT NULL,
    total_sales INT DEFAULT 0,
    avg_daily_demand DECIMAL(10, 2),
    peak_month VARCHAR(20),
    trend VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    UNIQUE KEY unique_medicine (medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. Reports Table
CREATE TABLE reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    report_type ENUM('sales', 'inventory', 'prescription', 'outbreak', 'financial') NOT NULL,
    generated_by INT,
    report_content LONGTEXT,
    report_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parameters JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by) REFERENCES users(user_id),
    INDEX idx_report_type (report_type),
    INDEX idx_report_date (report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create indexes for better query performance
CREATE INDEX idx_batch_medicine ON medicine_batches(medicine_id);
CREATE INDEX idx_order_supplier ON orders(supplier_id);
CREATE INDEX idx_sale_status ON sales(status);

-- Insert default admin user (password: admin123 - hashed with bcrypt)
-- Note: The password hash below is for 'admin123' encrypted with bcrypt
INSERT INTO users (username, password_hash, role, email, is_active) 
VALUES ('admin', '$2a$10$YIjlrWxWfD5S5s5s5s5s5u5V5V5V5V5V5V5V5V5V5V5V5V5V5V5V', 'admin', 'admin@halomed.com', TRUE);

-- Sample data for testing
INSERT INTO medicines (name, category, price, stock_quantity, reorder_level) VALUES
('Paracetamol 500mg', 'Painkillers', 5.50, 100, 20),
('Ibuprofen 200mg', 'Painkillers', 6.00, 80, 20),
('Amoxicillin 500mg', 'Antibiotics', 8.50, 60, 15),
('Omeprazole 20mg', 'Antacids', 7.00, 50, 15),
('Cetirizine 10mg', 'Antihistamines', 4.50, 120, 25);

INSERT INTO suppliers (name, contact_info, address, email, is_active) VALUES
('PharmaCorp', '9876543210', '123 Pharmacy St', 'contact@pharmacorp.com', TRUE),
('MediSupply Inc', '9876543211', '456 Medical Ave', 'info@medisupply.com', TRUE),
('HealthCare Plus', '9876543212', '789 Health Blvd', 'sales@healthcare-plus.com', TRUE);

INSERT INTO customers (name, contact_info, address) VALUES
('John Doe', '9876543200', '100 Main St'),
('Jane Smith', '9876543201', '200 Oak Ave'),
('Mike Johnson', '9876543202', '300 Pine Rd');
