import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get inventory logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { medicine_id, change_type, startDate, endDate } = req.query;

    let query = 'SELECT * FROM inventory_logs WHERE 1=1';
    const params = [];

    if (medicine_id) {
      query += ' AND medicine_id = ?';
      params.push(medicine_id);
    }

    if (change_type) {
      query += ' AND change_type = ?';
      params.push(change_type);
    }

    if (startDate && endDate) {
      query += ' AND log_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY log_date DESC LIMIT 500';

    const [logs] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Inventory logs retrieved successfully', logs);
  } catch (error) {
    handleError(error, res);
  }
});

// Add inventory log
router.post('/', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { medicine_id, change_type, quantity_changed, notes } = req.body;
    const userId = req.user.userId;

    if (!medicine_id || !change_type || !quantity_changed) {
      return sendResponse(res, 400, false, 'medicine_id, change_type, and quantity_changed are required');
    }

    // Get current stock
    const [medicines] = await pool.query(
      'SELECT stock_quantity FROM medicines WHERE medicine_id = ?',
      [medicine_id]
    );

    if (medicines.length === 0) {
      return sendResponse(res, 404, false, 'Medicine not found');
    }

    const currentStock = medicines[0].stock_quantity;
    const newStock = currentStock + quantity_changed;

    // Prevent negative stock
    if (newStock < 0) {
      return sendResponse(res, 400, false, 'Insufficient stock for this operation');
    }

    // Insert log
    const [result] = await pool.query(
      `INSERT INTO inventory_logs 
       (medicine_id, change_type, quantity_changed, previous_quantity, new_quantity, changed_by, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [medicine_id, change_type, quantity_changed, currentStock, newStock, userId, notes || null]
    );

    // Update medicine stock
    await pool.query(
      'UPDATE medicines SET stock_quantity = ? WHERE medicine_id = ?',
      [newStock, medicine_id]
    );

    sendResponse(res, 201, true, 'Inventory updated successfully', {
      log_id: result.insertId,
      previous_quantity: currentStock,
      new_quantity: newStock,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Get inventory summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) as total_medicines,
        SUM(stock_quantity) as total_stock,
        SUM(stock_quantity * price) as total_value,
        COUNT(CASE WHEN stock_quantity <= reorder_level THEN 1 END) as low_stock_count
      FROM medicines
    `);

    sendResponse(res, 200, true, 'Inventory summary retrieved successfully', summary[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// Get expired medicines
router.get('/expired', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const [expired] = await pool.query(`
      SELECT m.*, mb.batch_id, mb.expiry_date 
      FROM medicines m
      JOIN medicine_batches mb ON m.medicine_id = mb.medicine_id
      WHERE mb.expiry_date < CURDATE()
      ORDER BY mb.expiry_date ASC
    `);

    sendResponse(res, 200, true, 'Expired medicines retrieved successfully', expired);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
