import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController.js';

const router = express.Router();

// Get all suppliers
router.get('/', authenticateToken, getAllSuppliers);

// Get supplier details
router.get('/:id', authenticateToken, getSupplierById);

// Create supplier (admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), createSupplier);

// Update supplier (admin only)
router.put('/:id', authenticateToken, authorizeRole(['admin']), updateSupplier);

// Delete supplier (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), deleteSupplier);

export default router;
