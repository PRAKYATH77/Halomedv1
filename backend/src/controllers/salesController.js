// Sales Controller — handles sales business logic
import { Sale } from '../models/Sale.js';
import { sendResponse, handleError } from '../utils/helpers.js';

export const getAllSales = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const saleModel = new Sale(pool);
    const sales = await saleModel.findAll(req.query);
    sendResponse(res, 200, true, 'Sales retrieved successfully', sales);
  } catch (error) {
    handleError(error, res);
  }
};

export const getSaleById = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const saleModel = new Sale(pool);
    const sale = await saleModel.findById(req.params.id);
    if (!sale) return sendResponse(res, 404, false, 'Sale not found');
    sendResponse(res, 200, true, 'Sale retrieved successfully', sale);
  } catch (error) {
    handleError(error, res);
  }
};

export const getSalesSummary = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const saleModel = new Sale(pool);
    const summary = await saleModel.getSummary(req.query);
    sendResponse(res, 200, true, 'Sales summary retrieved successfully', summary);
  } catch (error) {
    handleError(error, res);
  }
};

export const createSale = async (req, res) => {
  const pool = req.app.locals.pool;
  const connection = await pool.getConnection();
  try {
    const { customer_id, items, discount_applied = 0 } = req.body;
    const createdBy = req.user.userId;

    if (!items || items.length === 0) {
      return sendResponse(res, 400, false, 'At least one item is required');
    }

    // Validate all items have required fields
    for (const item of items) {
      if (!item.medicine_id || !item.quantity || !item.unit_price) {
        return sendResponse(res, 400, false, 'Each item must have medicine_id, quantity, and unit_price');
      }
    }

    await connection.beginTransaction();

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0);
    const saleModel = new Sale(pool);
    const saleId = await saleModel.createWithItems(connection, { customerId: customer_id || null, items, totalAmount, discountApplied: discount_applied });

    // Decrement stock and log inventory changes
    for (const item of items) {
      await connection.query(
        'UPDATE medicines SET stock_quantity = stock_quantity - ? WHERE medicine_id = ?',
        [item.quantity, item.medicine_id]
      );
      await connection.query(
        `INSERT INTO inventory_logs (medicine_id, change_type, quantity_changed, changed_by, notes)
         VALUES (?, 'sale', ?, ?, ?)`,
        [item.medicine_id, -item.quantity, createdBy, `Sale #${saleId}`]
      );
    }

    await connection.commit();
    sendResponse(res, 201, true, 'Sale created successfully', { sale_id: saleId });
  } catch (error) {
    await connection.rollback();
    handleError(error, res);
  } finally {
    connection.release();
  }
};
