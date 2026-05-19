import express from 'express';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Staff: create restock request
router.post('/', authenticateToken, authorizeRole(['staff','admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { medicine_id, quantity_requested, notes } = req.body;
    const requested_by = req.user.userId;

    if (!medicine_id || !quantity_requested) {
      return sendResponse(res, 400, false, 'medicine_id and quantity_requested are required');
    }

    const [result] = await pool.query(
      `INSERT INTO restock_requests (medicine_id, requested_by, quantity_requested, notes) VALUES (?, ?, ?, ?)`,
      [medicine_id, requested_by, quantity_requested, notes || null]
    );

    sendResponse(res, 201, true, 'Restock request created', { request_id: result.insertId });
  } catch (error) {
    handleError(error, res);
  }
});

// Admin: list all requests
router.get('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const [rows] = await pool.query(
      `SELECT rr.*, m.name as medicine_name, u.username as requested_by_username, a.username as admin_username,
       su.username as supplier_username
       FROM restock_requests rr
       JOIN medicines m ON rr.medicine_id = m.medicine_id
       JOIN users u ON rr.requested_by = u.user_id
       LEFT JOIN users a ON rr.admin_id = a.user_id
       LEFT JOIN users su ON rr.supplier_id = su.user_id
       ORDER BY rr.created_at DESC LIMIT 1000`
    );
    sendResponse(res, 200, true, 'Requests retrieved', rows);
  } catch (error) {
    handleError(error, res);
  }
});

// Staff: view own requests
router.get('/my', authenticateToken, authorizeRole(['staff','admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const [rows] = await pool.query(
      `SELECT rr.*, m.name as medicine_name FROM restock_requests rr JOIN medicines m ON rr.medicine_id = m.medicine_id WHERE rr.requested_by = ? ORDER BY rr.created_at DESC`,
      [req.user.userId]
    );
    sendResponse(res, 200, true, 'User requests retrieved', rows);
  } catch (error) {
    handleError(error, res);
  }
});

// Admin: assign a supplier to a restock request
router.patch('/:id/assign-supplier', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const { supplier_id } = req.body;

    if (!supplier_id) return sendResponse(res, 400, false, 'supplier_id is required');

    const [requests] = await pool.query('SELECT * FROM restock_requests WHERE request_id = ?', [id]);
    if (requests.length === 0) return sendResponse(res, 404, false, 'Request not found');

    await pool.query(
      'UPDATE restock_requests SET supplier_id = ?, supplier_assigned_at = NOW(), supplier_status = ? WHERE request_id = ?',
      [supplier_id, 'assigned', id]
    );

    sendResponse(res, 200, true, 'Supplier assigned to restock request');
  } catch (error) {
    handleError(error, res);
  }
});

// Supplier: mark out for delivery
router.patch('/:id/supplier/out-for-delivery', authenticateToken, authorizeRole(['admin','staff','supplier']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const supplierUserId = req.user.userId;

    const [requests] = await pool.query('SELECT * FROM restock_requests WHERE request_id = ?', [id]);
    if (requests.length === 0) return sendResponse(res, 404, false, 'Request not found');
    const reqRow = requests[0];

    // Allow admin/staff to update supplier status; restrict check only for supplier role
    if (req.user.role === 'supplier' && reqRow.supplier_id !== supplierUserId) {
      return sendResponse(res, 403, false, 'Not authorized for this request');
    }

    await pool.query('UPDATE restock_requests SET supplier_status = ?, supplier_assigned_at = IFNULL(supplier_assigned_at, NOW()) WHERE request_id = ?', ['out_for_delivery', id]);

    sendResponse(res, 200, true, 'Supplier marked out for delivery');
  } catch (error) {
    handleError(error, res);
  }
});

// Supplier: mark delivered to delivery store
router.patch('/:id/supplier/mark-delivered', authenticateToken, authorizeRole(['admin','staff','supplier']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    const supplierUserId = req.user.userId;

    const [requests] = await pool.query('SELECT * FROM restock_requests WHERE request_id = ?', [id]);
    if (requests.length === 0) return sendResponse(res, 404, false, 'Request not found');
    const reqRow = requests[0];

    // Allow admin/staff to update supplier status; restrict check only for supplier role
    if (req.user.role === 'supplier' && reqRow.supplier_id !== supplierUserId) {
      return sendResponse(res, 403, false, 'Not authorized for this request');
    }

    await pool.query('UPDATE restock_requests SET supplier_status = ?, supplier_delivered_at = NOW() WHERE request_id = ?', ['delivered', id]);

    sendResponse(res, 200, true, 'Supplier marked as delivered to delivery store');
  } catch (error) {
    handleError(error, res);
  }
});

// Delivery Store: confirm receiving items
router.patch('/:id/delivery-store/confirm', authenticateToken, authorizeRole(['delivery_store']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [requests] = await pool.query('SELECT * FROM restock_requests WHERE request_id = ?', [id]);
    if (requests.length === 0) return sendResponse(res, 404, false, 'Request not found');

    await pool.query('UPDATE restock_requests SET delivery_store_received_at = NOW() WHERE request_id = ?', [id]);

    sendResponse(res, 200, true, 'Delivery store confirmed receipt of items');
  } catch (error) {
    handleError(error, res);
  }
});

// Admin: approve request (also update inventory)
router.patch('/:id/approve', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const connection = await req.app.locals.pool.getConnection();
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    await connection.beginTransaction();

    const [requests] = await connection.query('SELECT * FROM restock_requests WHERE request_id = ? FOR UPDATE', [id]);
    if (requests.length === 0) {
      await connection.rollback();
      return sendResponse(res, 404, false, 'Request not found');
    }

    const reqRow = requests[0];
    if (reqRow.status !== 'pending') {
      await connection.rollback();
      return sendResponse(res, 400, false, 'Request is not pending');
    }

    // Update request status
    await connection.query('UPDATE restock_requests SET status = ?, admin_id = ?, approved_at = NOW() WHERE request_id = ?', ['approved', adminId, id]);

    const [medicineRows] = await connection.query(
      'SELECT stock_quantity FROM medicines WHERE medicine_id = ? FOR UPDATE',
      [reqRow.medicine_id]
    );

    if (medicineRows.length === 0) {
      await connection.rollback();
      return sendResponse(res, 404, false, 'Medicine not found');
    }

    const currentStock = medicineRows[0].stock_quantity;
    const newStock = currentStock + reqRow.quantity_requested;

    // Update medicine stock
    await connection.query('UPDATE medicines SET stock_quantity = ? WHERE medicine_id = ?', [newStock, reqRow.medicine_id]);

    // Insert inventory log
    await connection.query(
      `INSERT INTO inventory_logs (medicine_id, change_type, quantity_changed, previous_quantity, new_quantity, changed_by, notes)
       VALUES (?, 'add', ?, ?, ?, ?, ?)`,
      [reqRow.medicine_id, reqRow.quantity_requested, currentStock, newStock, adminId, `Approved restock request #${id}`]
    );

    await connection.commit();

    sendResponse(res, 200, true, 'Request approved and inventory updated');
  } catch (error) {
    await connection.rollback();
    handleError(error, res);
  } finally {
    connection.release();
  }
});

// Admin: reject request
router.patch('/:id/reject', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const connection = await req.app.locals.pool.getConnection();
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    await connection.beginTransaction();

    const [requests] = await connection.query('SELECT * FROM restock_requests WHERE request_id = ? FOR UPDATE', [id]);
    if (requests.length === 0) {
      await connection.rollback();
      return sendResponse(res, 404, false, 'Request not found');
    }

    if (requests[0].status !== 'pending') {
      await connection.rollback();
      return sendResponse(res, 400, false, 'Request is not pending');
    }

    await connection.query(
      'UPDATE restock_requests SET status = ?, admin_id = ?, approved_at = NOW() WHERE request_id = ?',
      ['rejected', adminId, id]
    );

    await connection.commit();
    sendResponse(res, 200, true, 'Request rejected');
  } catch (error) {
    await connection.rollback();
    handleError(error, res);
  } finally {
    connection.release();
  }
});

export default router;
