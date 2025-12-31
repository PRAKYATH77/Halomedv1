import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Create prescription
router.post('/', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { customer_id, medicine_id, prescribed_by, dosage, quantity, date_issued, expiry_date } = req.body;

    if (!customer_id || !medicine_id || !prescribed_by || !quantity) {
      return sendResponse(res, 400, false, 'Required fields are missing');
    }

    const [result] = await pool.query(
      `INSERT INTO prescriptions 
       (customer_id, medicine_id, prescribed_by, dosage, quantity, date_issued, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, medicine_id, prescribed_by, dosage || null, quantity, date_issued, expiry_date || null]
    );

    sendResponse(res, 201, true, 'Prescription created successfully', {
      prescription_id: result.insertId,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Get prescriptions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { customer_id, is_fulfilled } = req.query;

    let query = 'SELECT p.*, m.name as medicine_name, c.name as customer_name FROM prescriptions p JOIN medicines m ON p.medicine_id = m.medicine_id LEFT JOIN customers c ON p.customer_id = c.customer_id WHERE 1=1';
    const params = [];

    if (customer_id) {
      query += ' AND p.customer_id = ?';
      params.push(customer_id);
    }

    if (is_fulfilled !== undefined) {
      query += ' AND p.is_fulfilled = ?';
      params.push(is_fulfilled === 'true' ? 1 : 0);
    }

    query += ' ORDER BY p.date_issued DESC LIMIT 500';

    const [prescriptions] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Prescriptions retrieved successfully', prescriptions);
  } catch (error) {
    handleError(error, res);
  }
});

// Mark prescription as fulfilled
router.put('/:id/fulfill', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE prescriptions SET is_fulfilled = TRUE WHERE prescription_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, false, 'Prescription not found');
    }

    sendResponse(res, 200, true, 'Prescription marked as fulfilled');
  } catch (error) {
    handleError(error, res);
  }
});

// Get unfulfilled prescriptions
router.get('/unfulfilled', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const [prescriptions] = await pool.query(`
      SELECT p.*, m.name as medicine_name, c.name as customer_name 
      FROM prescriptions p
      JOIN medicines m ON p.medicine_id = m.medicine_id
      LEFT JOIN customers c ON p.customer_id = c.customer_id
      WHERE p.is_fulfilled = FALSE
      ORDER BY p.date_issued DESC
    `);

    sendResponse(res, 200, true, 'Unfulfilled prescriptions retrieved successfully', prescriptions);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
