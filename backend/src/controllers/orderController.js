// Order Controller — handles purchase order (supplier orders) business logic
import { Order } from '../models/Order.js';
import { sendResponse, handleError } from '../utils/helpers.js';

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export const getAllOrders = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const orderModel = new Order(pool);
    const { status, supplier_id } = req.query;
    const orders = await orderModel.findAll({ status, supplierId: supplier_id });
    sendResponse(res, 200, true, 'Orders retrieved successfully', orders);
  } catch (error) {
    handleError(error, res);
  }
};

export const getOrderById = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const orderModel = new Order(pool);
    const order = await orderModel.findById(req.params.id);
    if (!order) return sendResponse(res, 404, false, 'Order not found');
    sendResponse(res, 200, true, 'Order retrieved successfully', order);
  } catch (error) {
    handleError(error, res);
  }
};

export const createOrder = async (req, res) => {
  const pool = req.app.locals.pool;
  const connection = await pool.getConnection();
  try {
    const { supplier_id, order_date, items } = req.body;
    const createdBy = req.user.userId;

    if (!supplier_id || !order_date || !items || items.length === 0) {
      return sendResponse(res, 400, false, 'supplier_id, order_date, and items are required');
    }

    await connection.beginTransaction();
    const orderModel = new Order(pool);
    const orderId = await orderModel.create(connection, {
      supplierId: supplier_id,
      orderDate: order_date,
      createdBy,
      items,
    });
    await connection.commit();
    sendResponse(res, 201, true, 'Order created successfully', { order_id: orderId });
  } catch (error) {
    await connection.rollback();
    handleError(error, res);
  } finally {
    connection.release();
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const pool = req.app.locals.pool;
    const orderModel = new Order(pool);

    if (!VALID_STATUSES.includes(status)) {
      return sendResponse(res, 400, false, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const affected = await orderModel.updateStatus(id, status);
    if (affected === 0) return sendResponse(res, 404, false, 'Order not found');
    sendResponse(res, 200, true, 'Order status updated successfully');
  } catch (error) {
    handleError(error, res);
  }
};
