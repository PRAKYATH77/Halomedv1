// Analytics Controller — handles analytics business logic
import { sendResponse, handleError } from '../utils/helpers.js';

export const getDemandAnalytics = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const [analytics] = await pool.query(`
      SELECT da.*, m.name, m.category, m.price
      FROM demand_analytics da
      JOIN medicines m ON da.medicine_id = m.medicine_id
      ORDER BY da.total_sales DESC
    `);
    sendResponse(res, 200, true, 'Demand analytics retrieved successfully', analytics);
  } catch (error) {
    handleError(error, res);
  }
};

export const getSalesAnalytics = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        DATE(sale_date) as date,
        COUNT(*) as total_sales,
        SUM(final_amount) as total_revenue,
        AVG(final_amount) as avg_sale
      FROM sales WHERE 1=1
    `;
    const params = [];

    if (startDate && endDate) {
      query += ' AND DATE(sale_date) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' GROUP BY DATE(sale_date) ORDER BY date DESC LIMIT 90';

    const [analytics] = await pool.query(query, params);
    sendResponse(res, 200, true, 'Sales analytics retrieved successfully', analytics);
  } catch (error) {
    handleError(error, res);
  }
};

export const getTopMedicines = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const [topMedicines] = await pool.query(`
      SELECT
        m.medicine_id,
        m.name,
        m.category,
        m.price,
        m.stock_quantity,
        COALESCE(COUNT(sd.sale_detail_id), 0) as total_sold,
        COALESCE(SUM(sd.subtotal), 0) as total_revenue
      FROM medicines m
      LEFT JOIN sale_details sd ON m.medicine_id = sd.medicine_id
      GROUP BY m.medicine_id
      ORDER BY total_sold DESC
      LIMIT 10
    `);
    sendResponse(res, 200, true, 'Top medicines retrieved successfully', topMedicines);
  } catch (error) {
    handleError(error, res);
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const [stats] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM medicines) as total_medicines,
        (SELECT COALESCE(SUM(stock_quantity), 0) FROM medicines) as total_stock_value,
        (SELECT COUNT(*) FROM sales) as total_sales,
        (SELECT COALESCE(SUM(final_amount), 0) FROM sales) as total_revenue,
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM suppliers) as total_suppliers,
        (SELECT COUNT(*) FROM customer_orders) as total_orders,
        (SELECT COUNT(*) FROM customer_orders WHERE status = 'confirmed') as confirmed_orders,
        (SELECT COUNT(*) FROM customer_orders WHERE status = 'assigned') as assigned_orders,
        (SELECT COUNT(*) FROM customer_orders WHERE status = 'out_for_delivery') as out_for_delivery_orders,
        (SELECT COUNT(*) FROM customer_orders WHERE status = 'received') as received_orders,
        (SELECT COUNT(*) FROM users WHERE role = 'delivery_store' AND is_active = TRUE) as delivery_stores,
        (SELECT COUNT(*) FROM medicines WHERE stock_quantity <= reorder_level) as low_stock_medicines,
        (SELECT COUNT(*) FROM restock_requests WHERE status = 'pending') as pending_restock_requests
    `);
    sendResponse(res, 200, true, 'Dashboard statistics retrieved successfully', stats[0]);
  } catch (error) {
    handleError(error, res);
  }
};
