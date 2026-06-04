import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  getAllMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  getLowStockMedicines,
} from '../controllers/medicineController.js';

const router = express.Router();

// Get medicines with low stock (must be before /:id to avoid route conflict)
router.get('/stock/low', authenticateToken, getLowStockMedicines);

// Get all medicines
router.get('/', authenticateToken, getAllMedicines);

// Get single medicine
router.get('/:id', authenticateToken, getMedicineById);

// Create medicine (admin/staff only)
router.post('/', authenticateToken, authorizeRole(['admin', 'staff']), createMedicine);

// Update medicine (admin/staff only)
router.put('/:id', authenticateToken, authorizeRole(['admin', 'staff']), updateMedicine);

// Delete medicine (admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), deleteMedicine);

export default router;
