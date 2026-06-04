import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getAllOrders, getOrderById, createOrder, updateOrderStatus } from '../controllers/orderController.js';

const router = express.Router();

// Get all orders
router.get('/', authenticateToken, getAllOrders);

// Get order details
router.get('/:id', authenticateToken, getOrderById);

// Create order (staff/admin only)
router.post('/', authenticateToken, authorizeRole(['staff', 'admin']), createOrder);

// Update order status (staff/admin only)
router.patch('/:id/status', authenticateToken, authorizeRole(['staff', 'admin']), updateOrderStatus);

export default router;
