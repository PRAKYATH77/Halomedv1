import express from 'express';
import fs from 'fs';
import path from 'path';
import { sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import multer from 'multer';

const router = express.Router();

// configure multer storage to backend/uploads/prescriptions
const uploadsRoot = path.resolve(process.cwd(), 'backend', 'uploads', 'prescriptions');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsRoot),
  filename: (req, file, cb) => {
    // use timestamp + random suffix to avoid collisions
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}-${rand}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

// Create prescription
router.post('/', authenticateToken, authorizeRole(['staff', 'admin']), async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Admins should not see prescriptions
    if (req.user && req.user.role === 'admin') {
      return sendResponse(res, 403, false, 'Access denied');
    }
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

// Customer upload: customers can upload prescription files (multipart/form-data)
// POST /prescriptions/upload
router.post('/upload', authenticateToken, authorizeRole(['customer']), upload.single('file'), async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    // map authenticated user to customers.customer_id if possible
    let customerId = null;
    try {
      const [userRows] = await pool.query('SELECT username, email FROM users WHERE user_id = ? LIMIT 1', [req.user.user_id]);
      const uname = userRows && userRows[0] && userRows[0].username;
      const uemail = userRows && userRows[0] && userRows[0].email;
      const [custRows] = await pool.query('SELECT customer_id FROM customers WHERE contact_info = ? OR name = ? LIMIT 1', [uemail || uname, uname || uemail]);
      if (custRows && custRows.length > 0) customerId = custRows[0].customer_id;
      else {
        // create a minimal customers row so FK constraints are satisfied
        const [ins] = await pool.query('INSERT INTO customers (name, contact_info, created_at) VALUES (?, ?, NOW())', [uname || `user_${req.user.user_id}`, uemail || null]);
        customerId = ins.insertId;
      }
    } catch (mapErr) {
      console.warn('Failed to map or create customer for upload:', mapErr.message);
      // as a last resort use user_id
      customerId = req.user.user_id;
    }

    if (!req.file) return sendResponse(res, 400, false, 'No file uploaded');

    // Optional form fields
    const { medicine_id, notes } = req.body;

    const fileRelPath = path.posix.join('/uploads/prescriptions', path.basename(req.file.path));

    const [result] = await pool.query(
      `INSERT INTO prescriptions (customer_id, medicine_id, prescribed_by, dosage, quantity, date_issued, expiry_date, file_path, file_name, file_mime, file_size, uploaded_by, uploaded_at)
       VALUES (?, ?, NULL, NULL, 0, NOW(), NULL, ?, ?, ?, ?, ?, NOW())`,
      [customerId, medicine_id || null, fileRelPath, req.file.originalname, req.file.mimetype, req.file.size, req.user.user_id]
    );

    sendResponse(res, 201, true, 'Prescription uploaded successfully', { prescription_id: result.insertId, file: { path: fileRelPath, name: req.file.originalname } });
  } catch (error) {
    handleError(error, res);
  }
});

// Get prescriptions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { customer_id, is_fulfilled } = req.query;

    // Admins should not see prescriptions
    if (req.user && req.user.role === 'admin') {
      return sendResponse(res, 403, false, 'Access denied');
    }

    let query = 'SELECT p.*, m.name as medicine_name, c.name as customer_name FROM prescriptions p JOIN medicines m ON p.medicine_id = m.medicine_id LEFT JOIN customers c ON p.customer_id = c.customer_id WHERE 1=1';
    const params = [];

    if (req.user && req.user.role === 'customer') {
      // Try to map authenticated user to a customers.customer_id, fall back to using user_id directly
      try {
        const [userRows] = await pool.query('SELECT username, email FROM users WHERE user_id = ? LIMIT 1', [req.user.user_id]);
        const uname = userRows && userRows[0] && userRows[0].username;
        const uemail = userRows && userRows[0] && userRows[0].email;

        const [custRows] = await pool.query('SELECT customer_id FROM customers WHERE contact_info = ? OR name = ? LIMIT 1', [uemail || uname, uname || uemail]);
        if (custRows && custRows.length > 0) {
          query += ' AND p.customer_id = ?';
          params.push(custRows[0].customer_id);
        } else {
          // fallback: treat customer_id as user_id (best-effort)
          query += ' AND p.customer_id = ?';
          params.push(req.user.user_id);
        }
      } catch (mapErr) {
        console.warn('Failed to map user to customer for prescriptions:', mapErr.message);
        query += ' AND p.customer_id = ?';
        params.push(req.user.user_id);
      }
    } else if (customer_id) {
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

// Secure download endpoint for prescription file
// GET /prescriptions/:id/download
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    const [rows] = await pool.query('SELECT * FROM prescriptions WHERE prescription_id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return sendResponse(res, 404, false, 'Prescription not found');
    const pres = rows[0];

    // Admins are not allowed to view prescriptions
    if (req.user && req.user.role === 'admin') return sendResponse(res, 403, false, 'Access denied');

    // Customers may only access their own prescriptions
    if (req.user && req.user.role === 'customer') {
      let mappedCustomerId = null;
      try {
        const [userRows] = await pool.query('SELECT username, email FROM users WHERE user_id = ? LIMIT 1', [req.user.user_id]);
        const uname = userRows && userRows[0] && userRows[0].username;
        const uemail = userRows && userRows[0] && userRows[0].email;
        const [custRows] = await pool.query('SELECT customer_id FROM customers WHERE contact_info = ? OR name = ? LIMIT 1', [uemail || uname, uname || uemail]);
        if (custRows && custRows.length > 0) mappedCustomerId = custRows[0].customer_id;
      } catch (mapErr) {
        console.warn('Failed to map user to customer for download:', mapErr.message);
      }
      const allowedId = mappedCustomerId || req.user.user_id;
      if (pres.customer_id !== allowedId) return sendResponse(res, 403, false, 'Not authorized to view this prescription');
    }

    // Staff may view any

    if (!pres.file_path) return sendResponse(res, 404, false, 'No file attached to this prescription');

    const filename = path.basename(pres.file_path);
    const filePath = path.resolve(process.cwd(), 'backend', 'uploads', 'prescriptions', filename);
    if (!fs.existsSync(filePath)) return sendResponse(res, 404, false, 'File not found');

    // Use res.download to set Content-Disposition with original filename
    return res.download(filePath, pres.file_name || filename, (err) => {
      if (err) {
        console.warn('Error sending prescription file:', err.message);
        if (!res.headersSent) sendResponse(res, 500, false, 'Failed to download file');
      }
    });
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
