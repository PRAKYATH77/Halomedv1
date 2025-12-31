import express from 'express';
import { hashPassword, comparePassword, generateToken, sendResponse, handleError } from '../utils/helpers.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    const pool = req.app.locals.pool;

    // Validate input
    if (!username || !password || !email) {
      return sendResponse(res, 400, false, 'Username, password, and email are required');
    }

    // Check if user exists
    const [existingUser] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser.length > 0) {
      return sendResponse(res, 409, false, 'User already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, email, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [username, hashedPassword, email, role || 'customer']
    );

    sendResponse(res, 201, true, 'User registered successfully', {
      userId: result.insertId,
      username,
      email,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const pool = req.app.locals.pool;

    // Validate input
    if (!username || !password) {
      return sendResponse(res, 400, false, 'Username and password are required');
    }

    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return sendResponse(res, 401, false, 'Invalid credentials');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      return sendResponse(res, 403, false, 'User account is disabled');
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return sendResponse(res, 401, false, 'Invalid credentials');
    }

    // Generate token
    const token = generateToken(user.user_id, user.role);

    sendResponse(res, 200, true, 'Login successful', {
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    handleError(error, res);
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const [users] = await pool.query(
      'SELECT user_id, username, email, role FROM users WHERE user_id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return sendResponse(res, 404, false, 'User not found');
    }

    sendResponse(res, 200, true, 'User retrieved successfully', users[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const pool = req.app.locals.pool;
    const userId = req.user.userId;

    // Validate input
    if (!oldPassword || !newPassword) {
      return sendResponse(res, 400, false, 'Old and new passwords are required');
    }

    // Get user
    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0) {
      return sendResponse(res, 404, false, 'User not found');
    }

    // Verify old password
    const isPasswordValid = await comparePassword(oldPassword, users[0].password_hash);

    if (!isPasswordValid) {
      return sendResponse(res, 401, false, 'Old password is incorrect');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [hashedPassword, userId]
    );

    sendResponse(res, 200, true, 'Password changed successfully');
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
