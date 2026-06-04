-- Add columns to store uploaded prescription file metadata
ALTER TABLE prescriptions
  ADD COLUMN file_path VARCHAR(512) NULL,
  ADD COLUMN file_name VARCHAR(255) NULL,
  ADD COLUMN file_mime VARCHAR(128) NULL,
  ADD COLUMN file_size INT NULL,
  ADD COLUMN uploaded_by INT NULL,
  ADD COLUMN uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP;

-- optional index to quickly find by customer
CREATE INDEX idx_prescriptions_customer_id ON prescriptions (customer_id);
