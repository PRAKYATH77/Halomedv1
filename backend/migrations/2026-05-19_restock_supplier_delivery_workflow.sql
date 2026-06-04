ALTER TABLE restock_requests
  ADD COLUMN supplier_id INT NULL AFTER admin_id,
  ADD COLUMN supplier_assigned_at TIMESTAMP NULL DEFAULT NULL AFTER supplier_id,
  ADD COLUMN supplier_status ENUM('assigned','out_for_delivery','delivered') NULL AFTER supplier_assigned_at,
  ADD COLUMN supplier_delivered_at TIMESTAMP NULL DEFAULT NULL AFTER supplier_status,
  ADD COLUMN delivery_store_received_at TIMESTAMP NULL DEFAULT NULL AFTER supplier_delivered_at,
  ADD CONSTRAINT fk_restock_supplier FOREIGN KEY (supplier_id) REFERENCES users(user_id) ON DELETE SET NULL;

-- Optional: index for quicker supplier/status queries
-- NOTE: creating an index here sometimes fails on environments where the
-- column or index already exists. If you want the index, create it separately
-- via a dedicated migration or run the following manually once:
-- ALTER TABLE restock_requests ADD INDEX idx_restock_supplier_status (supplier_status);
