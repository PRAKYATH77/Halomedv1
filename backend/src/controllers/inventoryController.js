// Inventory Controller — handles inventory business logic
import { Inventory } from '../models/Inventory.js';
import { sendResponse, handleError } from '../utils/helpers.js';

export const getLogs = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const inventoryModel = new Inventory(pool);
    const { medicine_id, change_type, startDate, endDate } = req.query;
    const logs = await inventoryModel.getLogs({ medicineId: medicine_id, changeType: change_type, startDate, endDate });
    sendResponse(res, 200, true, 'Inventory logs retrieved successfully', logs);
  } catch (error) {
    handleError(error, res);
  }
};

export const addLog = async (req, res) => {
  try {
    const { medicine_id, change_type, quantity_changed, notes } = req.body;
    const pool = req.app.locals.pool;
    const inventoryModel = new Inventory(pool);
    const changedBy = req.user.userId;

    if (!medicine_id || !change_type || quantity_changed === undefined) {
      return sendResponse(res, 400, false, 'medicine_id, change_type, and quantity_changed are required');
    }

    const VALID_TYPES = ['add', 'remove', 'sale', 'expired', 'adjustment'];
    if (!VALID_TYPES.includes(change_type)) {
      return sendResponse(res, 400, false, `change_type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    const logId = await inventoryModel.addLog(pool, { medicineId: medicine_id, changeType: change_type, quantityChanged: quantity_changed, changedBy, notes });
    sendResponse(res, 201, true, 'Inventory log added successfully', { log_id: logId });
  } catch (error) {
    handleError(error, res);
  }
};

export const getSummary = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const inventoryModel = new Inventory(pool);
    const summary = await inventoryModel.getSummary();
    sendResponse(res, 200, true, 'Inventory summary retrieved successfully', summary);
  } catch (error) {
    handleError(error, res);
  }
};

export const getExpired = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const inventoryModel = new Inventory(pool);
    const expired = await inventoryModel.getExpiredBatches();
    sendResponse(res, 200, true, 'Expired batches retrieved successfully', expired);
  } catch (error) {
    handleError(error, res);
  }
};
