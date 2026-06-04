-- Create webhook_events table to audit incoming webhook deliveries and processing
CREATE TABLE IF NOT EXISTS webhook_events (
  webhook_event_id INT PRIMARY KEY AUTO_INCREMENT,
  event_type VARCHAR(100),
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  raw_payload LONGTEXT,
  headers JSON NULL,
  signature VARCHAR(255) NULL,
  external_payment_id VARCHAR(128) NULL,
  mapped_order_id INT NULL,
  processing_status ENUM('received','processing','processed','failed') DEFAULT 'received',
  processing_result LONGTEXT,
  processed_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_external_payment_id (external_payment_id),
  INDEX idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
