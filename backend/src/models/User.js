// User Model — encapsulates all DB queries for users
import { hashPassword, comparePassword, generateToken } from '../utils/helpers.js';

export class User {
  constructor(pool) {
    this.pool = pool;
  }

  async findByUsername(username) {
    const [rows] = await this.pool.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      'SELECT user_id, username, email, role, is_active, created_at FROM users WHERE user_id = ?',
      [id]
    );
    return rows[0] || null;
  }

  async findByEmailOrUsername(email, username) {
    const [rows] = await this.pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    return rows;
  }

  async create({ username, password, email, role = 'customer' }) {
    const hashedPassword = await hashPassword(password);
    const [result] = await this.pool.query(
      'INSERT INTO users (username, password_hash, email, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
      [username, hashedPassword, email, role]
    );
    return result.insertId;
  }

  async updateRole(id, role) {
    const [result] = await this.pool.query('UPDATE users SET role = ? WHERE user_id = ?', [role, id]);
    return result.affectedRows;
  }

  async updatePassword(id, newPassword) {
    const hashedPassword = await hashPassword(newPassword);
    await this.pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, id]);
  }

  async findAll() {
    const [rows] = await this.pool.query(
      'SELECT user_id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    return rows;
  }

  async findByRole(role) {
    const [rows] = await this.pool.query(
      'SELECT user_id, username, email, role, created_at FROM users WHERE role = ? AND is_active = TRUE ORDER BY username ASC',
      [role]
    );
    return rows;
  }

  async verifyPassword(plainPassword, hash) {
    return comparePassword(plainPassword, hash);
  }

  generateAuthToken(userId, role) {
    return generateToken(userId, role);
  }
}

export default User;
