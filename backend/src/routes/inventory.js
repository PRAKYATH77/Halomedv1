import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getLogs, addLog, getSummary, getExpired } from '../controllers/inventoryController.js';

const router = express.Router();

// Get inventory summary (before / to avoid ordering issues)
router.get('/summary', authenticateToken, getSummary);

// Get expired medicine batches
router.get('/expired', authenticateToken, authorizeRole(['admin', 'staff']), getExpired);

// Get all inventory logs (with optional filters)
router.get('/', authenticateToken, authorizeRole(['admin', 'staff']), getLogs);

// Add inventory log entry (and update medicine stock)
router.post('/', authenticateToken, authorizeRole(['admin', 'staff']), addLog);

export default router;
