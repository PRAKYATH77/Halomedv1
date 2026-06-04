// Auth Controller — handles authentication business logic
import { User } from '../models/User.js';
import { sendResponse, handleError } from '../utils/helpers.js';
import { comparePassword } from '../utils/helpers.js';

const VALID_ROLES = ['admin', 'staff', 'delivery_store', 'customer', 'supplier'];

export const register = async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    const pool = req.app.locals.pool;
    const userModel = new User(pool);

    if (!username || !password || !email) {
      return sendResponse(res, 400, false, 'Username, password, and email are required');
    }

    const existing = await userModel.findByEmailOrUsername(email, username);
    if (existing.length > 0) {
      return sendResponse(res, 409, false, 'User already exists');
    }

    const userId = await userModel.create({ username, password, email, role: role || 'customer' });
    sendResponse(res, 201, true, 'User registered successfully', { userId, username, email });
  } catch (error) {
    handleError(error, res);
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const pool = req.app.locals.pool;
    const userModel = new User(pool);

    if (!username || !password) {
      return sendResponse(res, 400, false, 'Username and password are required');
    }

    const user = await userModel.findByUsername(username);
    if (!user) return sendResponse(res, 401, false, 'Invalid credentials');
    if (!user.is_active) return sendResponse(res, 403, false, 'User account is disabled');

    const isPasswordValid = await userModel.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) return sendResponse(res, 401, false, 'Invalid credentials');

    const token = userModel.generateAuthToken(user.user_id, user.role);
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
};

export const getCurrentUser = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userModel = new User(pool);
    const user = await userModel.findById(req.user.userId);
    if (!user) return sendResponse(res, 404, false, 'User not found');
    sendResponse(res, 200, true, 'User retrieved successfully', user);
  } catch (error) {
    handleError(error, res);
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const pool = req.app.locals.pool;
    const userModel = new User(pool);
    const userId = req.user.userId;

    if (!oldPassword || !newPassword) {
      return sendResponse(res, 400, false, 'Old and new passwords are required');
    }

    const [users] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
    if (!users[0]) return sendResponse(res, 404, false, 'User not found');

    const isPasswordValid = await comparePassword(oldPassword, users[0].password_hash);
    if (!isPasswordValid) return sendResponse(res, 401, false, 'Old password is incorrect');

    await userModel.updatePassword(userId, newPassword);
    sendResponse(res, 200, true, 'Password changed successfully');
  } catch (error) {
    handleError(error, res);
  }
};

export const getDeliveryStores = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userModel = new User(pool);
    const users = await userModel.findByRole('delivery_store');
    sendResponse(res, 200, true, 'Delivery stores retrieved successfully', users);
  } catch (error) {
    handleError(error, res);
  }
};

export const getSupplierUsers = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userModel = new User(pool);
    const users = await userModel.findByRole('supplier');
    sendResponse(res, 200, true, 'Suppliers retrieved successfully', users);
  } catch (error) {
    handleError(error, res);
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const pool = req.app.locals.pool;
    const userModel = new User(pool);

    if (!VALID_ROLES.includes(role)) {
      return sendResponse(res, 400, false, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    const affected = await userModel.updateRole(id, role);
    if (affected === 0) return sendResponse(res, 404, false, 'User not found');

    sendResponse(res, 200, true, `User role updated to ${role} successfully`);
  } catch (error) {
    handleError(error, res);
  }
};

export const listUsers = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const userModel = new User(pool);
    const users = await userModel.findAll();
    sendResponse(res, 200, true, 'Users retrieved successfully', users);
  } catch (error) {
    handleError(error, res);
  }
};
