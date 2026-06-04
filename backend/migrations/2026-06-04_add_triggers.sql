-- Migration: Add Triggers for Automation and Validation

DELIMITER //

-- 1. Automated Restock Requests (AFTER UPDATE on medicines)
DROP TRIGGER IF EXISTS trg_after_medicine_update //
CREATE TRIGGER trg_after_medicine_update
AFTER UPDATE ON medicines
FOR EACH ROW
BEGIN
    DECLARE v_admin_id INT;
    
    -- Only trigger if stock just dropped below or equal to reorder level
    IF NEW.stock_quantity <= NEW.reorder_level AND OLD.stock_quantity > OLD.reorder_level THEN
        -- Find an admin user to assign the request to
        SELECT user_id INTO v_admin_id FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1;
        
        -- If no admin is found, fallback to 1
        IF v_admin_id IS NULL THEN
            SET v_admin_id = 1;
        END IF;

        INSERT INTO restock_requests (medicine_id, requested_by, quantity_requested, status, notes)
        VALUES (NEW.medicine_id, v_admin_id, 50, 'pending', 'Automated restock request due to low inventory');
    END IF;
END //

-- 2. Real-time Demand Analytics (AFTER INSERT on sale_details)
DROP TRIGGER IF EXISTS trg_after_sale_detail_insert //
CREATE TRIGGER trg_after_sale_detail_insert
AFTER INSERT ON sale_details
FOR EACH ROW
BEGIN
    INSERT INTO demand_analytics (medicine_id, total_sales, avg_daily_demand, peak_month, trend)
    VALUES (NEW.medicine_id, NEW.quantity, 0, NULL, NULL)
    ON DUPLICATE KEY UPDATE 
        total_sales = total_sales + NEW.quantity;
END //

-- 3. Expiry Date Validation (BEFORE INSERT on medicine_batches)
DROP TRIGGER IF EXISTS trg_before_medicine_batch_insert //
CREATE TRIGGER trg_before_medicine_batch_insert
BEFORE INSERT ON medicine_batches
FOR EACH ROW
BEGIN
    IF NEW.expiry_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot insert a batch with an expiry date in the past.';
    END IF;
END //

-- 4. Stock Quantity Validation (BEFORE INSERT on sale_details)
DROP TRIGGER IF EXISTS trg_before_sale_detail_insert //
CREATE TRIGGER trg_before_sale_detail_insert
BEFORE INSERT ON sale_details
FOR EACH ROW
BEGIN
    DECLARE v_current_stock INT;
    
    SELECT stock_quantity INTO v_current_stock FROM medicines WHERE medicine_id = NEW.medicine_id;
    
    IF NEW.quantity > v_current_stock THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requested quantity exceeds available stock.';
    END IF;
END //

DELIMITER ;
