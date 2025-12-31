import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get all medicines
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { category, searchTerm } = req.query;

    let query = 'SELECT * FROM medicines WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (searchTerm) {
      query += ' AND (name LIKE ? OR category LIKE ?)';
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }

    const [medicines] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Medicines retrieved successfully', medicines);
  } catch (error) {
    handleError(error, res);
  }
});

// Get single medicine
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [medicines] = await pool.query(
      'SELECT * FROM medicines WHERE medicine_id = ?',
      [id]
    );

    if (medicines.length === 0) {
      return sendResponse(res, 404, false, 'Medicine not found');
    }

    sendResponse(res, 200, true, 'Medicine retrieved successfully', medicines[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// Create medicine (admin only)
router.post('/', authenticateToken, authorizeRole(['admin', 'staff']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { name, category, price, stock_quantity, reorder_level } = req.body;

    if (!name || !category || !price) {
      return sendResponse(res, 400, false, 'Name, category, and price are required');
    }

    const [result] = await pool.query(
      'INSERT INTO medicines (name, category, price, stock_quantity, reorder_level) VALUES (?, ?, ?, ?, ?)',
      [name, category, price, stock_quantity || 0, reorder_level || 10]
    );

    sendResponse(res, 201, true, 'Medicine created successfully', {
      medicine_id: result.insertId,
      name,
      category,
      price,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Update medicine (admin only)
router.put('/:id', authenticateToken, authorizeRole(['admin', 'staff']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { name, category, price, stock_quantity, reorder_level } = req.body;

    const [result] = await pool.query(
      'UPDATE medicines SET name=?, category=?, price=?, stock_quantity=?, reorder_level=? WHERE medicine_id=?',
      [name, category, price, stock_quantity, reorder_level, id]
    );

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, false, 'Medicine not found');
    }

    sendResponse(res, 200, true, 'Medicine updated successfully');
  } catch (error) {
    handleError(error, res);
  }
});

// Delete medicine (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [result] = await pool.query(
      'DELETE FROM medicines WHERE medicine_id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, false, 'Medicine not found');
    }

    sendResponse(res, 200, true, 'Medicine deleted successfully');
  } catch (error) {
    handleError(error, res);
  }
});

// Get medicines with low stock
router.get('/stock/low', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    const [medicines] = await pool.query(
      'SELECT * FROM medicines WHERE stock_quantity <= reorder_level ORDER BY stock_quantity ASC'
    );

    sendResponse(res, 200, true, 'Low stock medicines retrieved successfully', medicines);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
