import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getAllSales, getSaleById, getSalesSummary, createSale } from '../controllers/salesController.js';

const router = express.Router();

// Summary stats (must be before /:id to avoid route conflict)
router.get('/summary/stats', authenticateToken, getSalesSummary);

// Get all sales
router.get('/', authenticateToken, getAllSales);

// Create sale (staff/admin only)
router.post('/', authenticateToken, authorizeRole(['staff', 'admin']), createSale);

// Get sale details
router.get('/:id', authenticateToken, getSaleById);

export default router;
