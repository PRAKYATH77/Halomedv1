import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Hash password
export const hashPassword = async (password) => {
  try {
    return await bcryptjs.hash(password, 10);
  } catch (error) {
    throw new Error('Error hashing password: ' + error.message);
  }
};

// Compare password
export const comparePassword = async (password, hash) => {
  try {
    return await bcryptjs.compare(password, hash);
  } catch (error) {
    throw new Error('Error comparing password: ' + error.message);
  }
};

// Generate JWT
export const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'your_jwt_secret_key',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Verify JWT
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
  } catch (error) {
    throw new Error('Invalid token: ' + error.message);
  }
};

// Format response
export const sendResponse = (res, statusCode, success, message, data = null) => {
  return res.status(statusCode).json({
    success,
    message,
    data: data || {},
    timestamp: new Date().toISOString(),
  });
};

// Error handler
export const handleError = (error, res) => {
  console.error('Error:', error);
  return sendResponse(
    res,
    500,
    false,
    error.message || 'Internal Server Error'
  );
};
