CREATE TABLE IF NOT EXISTS customer_orders (
  order_id INT NOT NULL AUTO_INCREMENT,
  customer_id INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  zip_code VARCHAR(10) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status ENUM('pending', 'confirmed', 'assigned', 'out_for_delivery', 'received', 'cancelled') DEFAULT 'pending',
  assigned_delivery_store_id INT NULL,
  assigned_by INT NULL,
  assigned_at TIMESTAMP NULL DEFAULT NULL,
  approved_for_delivery_at TIMESTAMP NULL DEFAULT NULL,
  received_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_delivery_store_id) REFERENCES users(user_id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_order_items (
  order_item_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  medicine_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (order_item_id),
  FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE RESTRICT
);
