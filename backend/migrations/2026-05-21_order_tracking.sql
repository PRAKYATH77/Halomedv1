-- Migration: create order_tracking table for persistent courier coordinates
CREATE TABLE IF NOT EXISTS order_tracking (
  order_id INT NOT NULL PRIMARY KEY,
  courier_lat DOUBLE NULL,
  courier_lng DOUBLE NULL,
  progress INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES customer_orders(order_id) ON DELETE CASCADE
);
