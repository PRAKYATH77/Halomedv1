import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Create sale
router.post('/', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
  const connection = await req.app.locals.pool.getConnection();
  
  try {
    const { customer_id, items, discount_applied } = req.body;

    if (!items || items.length === 0) {
      return sendResponse(res, 400, false, 'At least one item is required');
    }

    // Calculate total
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unit_price;
    }

    const finalAmount = totalAmount - (discount_applied || 0);

    // BEGIN TRANSACTION
    await connection.beginTransaction();
    console.log('📝 Sale transaction started');

    // Create sale
    const [saleResult] = await connection.query(
      `INSERT INTO sales (customer_id, total_amount, discount_applied, final_amount, status)
       VALUES (?, ?, ?, ?, 'completed')`,
      [customer_id || null, totalAmount, discount_applied || 0, finalAmount]
    );

    const saleId = saleResult.insertId;
    console.log('✅ Sale created:', saleId);

    // Add sale details
    for (const item of items) {
      const subtotal = item.quantity * item.unit_price;

      await connection.query(
        `INSERT INTO sale_details (sale_id, medicine_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, item.medicine_id, item.quantity, item.unit_price, subtotal]
      );

      // Update inventory logs
      await connection.query(
        `INSERT INTO inventory_logs (medicine_id, change_type, quantity_changed, changed_by)
         VALUES (?, 'sale', ?, ?)`,
        [item.medicine_id, -item.quantity, req.user.userId]
      );

      // Update medicine stock
      await connection.query(
        'UPDATE medicines SET stock_quantity = stock_quantity - ? WHERE medicine_id = ?',
        [item.quantity, item.medicine_id]
      );
    }

    // COMMIT TRANSACTION
    await connection.commit();
    console.log('✅ Sale transaction committed');

    sendResponse(res, 201, true, 'Sale created successfully', {
      sale_id: saleId,
      total_amount: totalAmount,
      discount_applied: discount_applied || 0,
      final_amount: finalAmount,
    });
  } catch (error) {
    // ROLLBACK on any error
    await connection.rollback();
    console.error('❌ Sale transaction rolled back. Error:', error.message);
    handleError(error, res);
  } finally {
    connection.release();
  }
});

// Get sales
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate, customer_id } = req.query;

    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];

    if (customer_id) {
      query += ' AND customer_id = ?';
      params.push(customer_id);
    }

    if (startDate && endDate) {
      query += ' AND DATE(sale_date) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY sale_date DESC LIMIT 500';

    const [sales] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Sales retrieved successfully', sales);
  } catch (error) {
    handleError(error, res);
  }
});

// Get sale details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [sales] = await pool.query(
      'SELECT * FROM sales WHERE sale_id = ?',
      [id]
    );

    if (sales.length === 0) {
      return sendResponse(res, 404, false, 'Sale not found');
    }

    const [details] = await pool.query(
      `SELECT sd.*, m.name, m.category 
       FROM sale_details sd
       JOIN medicines m ON sd.medicine_id = m.medicine_id
       WHERE sd.sale_id = ?`,
      [id]
    );

    sendResponse(res, 200, true, 'Sale retrieved successfully', {
      sale: sales[0],
      items: details,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Get sales summary
router.get('/summary/stats', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(final_amount) as total_revenue,
        AVG(final_amount) as avg_sale_amount,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM sales WHERE 1=1
    `;
    const params = [];

    if (startDate && endDate) {
      query += ' AND DATE(sale_date) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const [summary] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Sales summary retrieved successfully', summary[0]);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
