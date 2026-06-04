// Supplier Controller — handles supplier business logic
import { sendResponse, handleError } from '../utils/helpers.js';

export const getAllSuppliers = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { searchTerm } = req.query;
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];
    if (searchTerm) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    query += ' ORDER BY name ASC';
    const [suppliers] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Suppliers retrieved successfully', suppliers);
  } catch (error) {
    handleError(error, res);
  }
};

export const getSupplierById = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE supplier_id = ?', [req.params.id]);
    if (!rows[0]) return sendResponse(res, 404, false, 'Supplier not found');
    sendResponse(res, 200, true, 'Supplier retrieved successfully', rows[0]);
  } catch (error) {
    handleError(error, res);
  }
};

export const createSupplier = async (req, res) => {
  try {
    const { name, contact_info, address, email } = req.body;
    const pool = req.app.locals.pool;

    if (!name) return sendResponse(res, 400, false, 'Supplier name is required');

    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_info, address, email, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [name, contact_info || null, address || null, email || null]
    );
    sendResponse(res, 201, true, 'Supplier created successfully', { supplier_id: result.insertId, name });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_info, address, email, is_active } = req.body;
    const pool = req.app.locals.pool;

    const [result] = await pool.query(
      'UPDATE suppliers SET name=?, contact_info=?, address=?, email=?, is_active=? WHERE supplier_id=?',
      [name, contact_info || null, address || null, email || null, is_active !== undefined ? is_active : true, id]
    );

    if (result.affectedRows === 0) return sendResponse(res, 404, false, 'Supplier not found');
    sendResponse(res, 200, true, 'Supplier updated successfully');
  } catch (error) {
    handleError(error, res);
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;
    const [result] = await pool.query('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
    if (result.affectedRows === 0) return sendResponse(res, 404, false, 'Supplier not found');
    sendResponse(res, 200, true, 'Supplier deleted successfully');
  } catch (error) {
    handleError(error, res);
  }
};
