import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getDemandAnalytics,
  getSalesAnalytics,
  getTopMedicines,
  getDashboardStats,
} from '../controllers/analyticsController.js';

const router = express.Router();

// Get demand analytics
router.get('/demand', authenticateToken, getDemandAnalytics);

// Get sales analytics (date-grouped)
router.get('/sales', authenticateToken, getSalesAnalytics);

// Get top selling medicines
router.get('/top-medicines', authenticateToken, getTopMedicines);

// Get dashboard statistics
router.get('/dashboard/stats', authenticateToken, getDashboardStats);

export default router;
