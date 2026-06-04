// Sale Model — encapsulates all DB queries for sales
export class Sale {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll({ startDate, endDate, customer_id } = {}) {
    let query = `
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      WHERE 1=1
    `;
    const params = [];
    if (startDate && endDate) {
      query += ' AND DATE(s.sale_date) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    if (customer_id) {
      query += ' AND s.customer_id = ?';
      params.push(customer_id);
    }
    query += ' ORDER BY s.sale_date DESC';
    const [rows] = await this.pool.query(query, params);
    return rows;
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      `SELECT s.*, c.name as customer_name
       FROM sales s LEFT JOIN customers c ON s.customer_id = c.customer_id
       WHERE s.sale_id = ?`,
      [id]
    );
    if (!rows[0]) return null;

    const [items] = await this.pool.query(
      `SELECT sd.*, m.name as medicine_name
       FROM sale_details sd
       JOIN medicines m ON sd.medicine_id = m.medicine_id
       WHERE sd.sale_id = ?`,
      [id]
    );
    return { ...rows[0], items };
  }

  async getSummary({ startDate, endDate } = {}) {
    let query = `
      SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(final_amount), 0) as total_revenue,
        COALESCE(AVG(final_amount), 0) as avg_sale_amount,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM sales WHERE 1=1
    `;
    const params = [];
    if (startDate && endDate) {
      query += ' AND DATE(sale_date) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    const [rows] = await this.pool.query(query, params);
    return rows[0];
  }

  async createWithItems(connection, { customerId, items, totalAmount, discountApplied = 0 }) {
    const finalAmount = totalAmount - discountApplied;

    const [saleResult] = await connection.query(
      `INSERT INTO sales (customer_id, total_amount, discount_applied, final_amount, status)
       VALUES (?, ?, ?, ?, 'completed')`,
      [customerId, totalAmount, discountApplied, finalAmount]
    );
    const saleId = saleResult.insertId;

    for (const item of items) {
      const subtotal = Number(item.unit_price) * Number(item.quantity);
      await connection.query(
        `INSERT INTO sale_details (sale_id, medicine_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, item.medicine_id, item.quantity, item.unit_price, subtotal]
      );
    }
    return saleId;
  }
}

export default Sale;
