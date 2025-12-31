import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Create order
router.post('/', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
  const connection = await req.app.locals.pool.getConnection();
  
  try {
    const { supplier_id, order_date, items } = req.body;

    if (!supplier_id || !items || items.length === 0) {
      return sendResponse(res, 400, false, 'Supplier and items are required');
    }

    // BEGIN TRANSACTION
    await connection.beginTransaction();
    console.log('📝 Supplier order transaction started');

    const [result] = await connection.query(
      'INSERT INTO orders (supplier_id, order_date, created_by) VALUES (?, ?, ?)',
      [supplier_id, order_date, req.user.userId]
    );

    const orderId = result.insertId;
    console.log('✅ Supplier order created:', orderId);

    // Add order details
    for (const item of items) {
      await connection.query(
        'INSERT INTO order_details (order_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.medicine_id, item.quantity, item.unit_price]
      );
    }

    // COMMIT TRANSACTION
    await connection.commit();
    console.log('✅ Supplier order transaction committed');

    sendResponse(res, 201, true, 'Order created successfully', {
      order_id: orderId,
    });
  } catch (error) {
    // ROLLBACK on any error
    await connection.rollback();
    console.error('❌ Supplier order transaction rolled back. Error:', error.message);
    handleError(error, res);
  } finally {
    connection.release();
  }
});

// Get orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { status, supplier_id } = req.query;

    let query = 'SELECT o.*, s.name as supplier_name FROM orders o JOIN suppliers s ON o.supplier_id = s.supplier_id WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (supplier_id) {
      query += ' AND o.supplier_id = ?';
      params.push(supplier_id);
    }

    query += ' ORDER BY o.order_date DESC LIMIT 500';

    const [orders] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Orders retrieved successfully', orders);
  } catch (error) {
    handleError(error, res);
  }
});

// Get order details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [orders] = await pool.query(
      'SELECT o.*, s.name as supplier_name FROM orders o JOIN suppliers s ON o.supplier_id = s.supplier_id WHERE o.order_id = ?',
      [id]
    );

    if (orders.length === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    const [details] = await pool.query(
      `SELECT od.*, m.name as medicine_name 
       FROM order_details od
       JOIN medicines m ON od.medicine_id = m.medicine_id
       WHERE od.order_id = ?`,
      [id]
    );

    sendResponse(res, 200, true, 'Order retrieved successfully', {
      order: orders[0],
      items: details,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Update order status
router.patch('/:id/status', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { status } = req.body;

    const [result] = await pool.query(
      'UPDATE orders SET status = ? WHERE order_id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, false, 'Order not found');
    }

    sendResponse(res, 200, true, 'Order status updated successfully');
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
