import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  register,
  login,
  getCurrentUser,
  changePassword,
  getDeliveryStores,
  getSupplierUsers,
  updateUserRole,
  listUsers,
} from '../controllers/authController.js';

const router = express.Router();

// Register user
router.post('/register', register);

// Login
router.post('/login', login);

// Get current user
router.get('/me', authenticateToken, getCurrentUser);

// Change password
router.post('/change-password', authenticateToken, changePassword);

// Get delivery store users for assignment
router.get('/delivery-stores', authenticateToken, authorizeRole(['admin', 'staff']), getDeliveryStores);

// Get supplier users for assignment
router.get('/suppliers', authenticateToken, authorizeRole(['admin', 'staff']), getSupplierUsers);

// Update user role (admin only)
router.patch('/users/:id/role', authenticateToken, authorizeRole(['admin']), updateUserRole);

// List all users (admin only)
router.get('/users', authenticateToken, authorizeRole(['admin']), listUsers);

export default router;
