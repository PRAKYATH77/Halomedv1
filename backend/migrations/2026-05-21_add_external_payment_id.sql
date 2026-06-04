-- Add external_payment_id to payment_transactions for webhook idempotency
ALTER TABLE payment_transactions
  ADD COLUMN external_payment_id VARCHAR(128) NULL AFTER sale_id,
  ADD UNIQUE INDEX ux_payment_transactions_external_id (external_payment_id);
