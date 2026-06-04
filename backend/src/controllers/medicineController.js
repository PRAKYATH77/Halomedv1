// Medicine Controller — handles medicine business logic
import { Medicine } from '../models/Medicine.js';
import { sendResponse, handleError } from '../utils/helpers.js';

export const getAllMedicines = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const medicineModel = new Medicine(pool);
    const medicines = await medicineModel.findAll(req.query);
    sendResponse(res, 200, true, 'Medicines retrieved successfully', medicines);
  } catch (error) {
    handleError(error, res);
  }
};

export const getMedicineById = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const medicineModel = new Medicine(pool);
    const medicine = await medicineModel.findById(req.params.id);
    if (!medicine) return sendResponse(res, 404, false, 'Medicine not found');
    sendResponse(res, 200, true, 'Medicine retrieved successfully', medicine);
  } catch (error) {
    handleError(error, res);
  }
};

export const createMedicine = async (req, res) => {
  try {
    const { name, category, price, stock_quantity, reorder_level } = req.body;
    const pool = req.app.locals.pool;
    const medicineModel = new Medicine(pool);

    if (!name || !category || !price) {
      return sendResponse(res, 400, false, 'Name, category, and price are required');
    }

    const id = await medicineModel.create({ name, category, price, stock_quantity, reorder_level });
    sendResponse(res, 201, true, 'Medicine created successfully', { medicine_id: id, name, category, price });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;
    const medicineModel = new Medicine(pool);
    const affected = await medicineModel.update(id, req.body);
    if (affected === 0) return sendResponse(res, 404, false, 'Medicine not found');
    sendResponse(res, 200, true, 'Medicine updated successfully');
  } catch (error) {
    handleError(error, res);
  }
};

export const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = req.app.locals.pool;
    const medicineModel = new Medicine(pool);
    const affected = await medicineModel.delete(id);
    if (affected === 0) return sendResponse(res, 404, false, 'Medicine not found');
    sendResponse(res, 200, true, 'Medicine deleted successfully');
  } catch (error) {
    handleError(error, res);
  }
};

export const getLowStockMedicines = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const medicineModel = new Medicine(pool);
    const medicines = await medicineModel.findLowStock();
    sendResponse(res, 200, true, 'Low stock medicines retrieved successfully', medicines);
  } catch (error) {
    handleError(error, res);
  }
};
