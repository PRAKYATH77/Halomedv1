import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { searchTerm } = req.query;

    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (searchTerm) {
      query += ' AND name LIKE ?';
      params.push(`%${searchTerm}%`);
    }

    const [suppliers] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Suppliers retrieved successfully', suppliers);
  } catch (error) {
    handleError(error, res);
  }
});

// Create supplier
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, contact_info, address, email } = req.body;

    if (!name) {
      return sendResponse(res, 400, false, 'Supplier name is required');
    }

    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_info, address, email) VALUES (?, ?, ?, ?)',
      [name, contact_info || null, address || null, email || null]
    );

    sendResponse(res, 201, true, 'Supplier created successfully', {
      supplier_id: result.insertId,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Get supplier details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [suppliers] = await pool.query(
      'SELECT * FROM suppliers WHERE supplier_id = ?',
      [id]
    );

    if (suppliers.length === 0) {
      return sendResponse(res, 404, false, 'Supplier not found');
    }

    sendResponse(res, 200, true, 'Supplier retrieved successfully', suppliers[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// Update supplier
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { name, contact_info, address, email } = req.body;

    const [result] = await pool.query(
      'UPDATE suppliers SET name=?, contact_info=?, address=?, email=? WHERE supplier_id=?',
      [name, contact_info, address, email, id]
    );

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, false, 'Supplier not found');
    }

    sendResponse(res, 200, true, 'Supplier updated successfully');
  } catch (error) {
    handleError(error, res);
  }
});

// Delete supplier
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [result] = await pool.query(
      'DELETE FROM suppliers WHERE supplier_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, false, 'Supplier not found');
    }

    sendResponse(res, 200, true, 'Supplier deleted successfully');
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
