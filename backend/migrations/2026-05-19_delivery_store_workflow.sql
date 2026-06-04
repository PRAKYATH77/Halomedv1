ALTER TABLE customer_orders
  MODIFY COLUMN status ENUM('pending', 'confirmed', 'assigned', 'out_for_delivery', 'received', 'cancelled') DEFAULT 'pending',
  ADD COLUMN assigned_delivery_store_id INT NULL AFTER payment_method,
  ADD COLUMN assigned_by INT NULL AFTER assigned_delivery_store_id,
  ADD COLUMN assigned_at TIMESTAMP NULL DEFAULT NULL AFTER assigned_by,
  ADD COLUMN approved_for_delivery_at TIMESTAMP NULL DEFAULT NULL AFTER assigned_at,
  ADD COLUMN received_at TIMESTAMP NULL DEFAULT NULL AFTER approved_for_delivery_at,
  ADD CONSTRAINT fk_customer_orders_delivery_store FOREIGN KEY (assigned_delivery_store_id) REFERENCES users(user_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_customer_orders_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL;

-- NOTE: users.role was adjusted in a previous migration (add_supplier_role).
-- Avoid changing the users.role enum here to prevent conflicts with prior migrations.
-- If you need to adjust `users.role` further, add a dedicated migration that
-- is aware of existing values and runs safely.