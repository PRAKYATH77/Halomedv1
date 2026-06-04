// Order Model — encapsulates DB queries for purchase orders (supplier orders)
export class Order {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll({ status, supplierId } = {}) {
    let query = `
      SELECT o.*, s.name as supplier_name, u.username as created_by_username
      FROM orders o
      JOIN suppliers s ON o.supplier_id = s.supplier_id
      LEFT JOIN users u ON o.created_by = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    if (supplierId) {
      query += ' AND o.supplier_id = ?';
      params.push(supplierId);
    }
    query += ' ORDER BY o.created_at DESC';
    const [rows] = await this.pool.query(query, params);
    return rows;
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      `SELECT o.*, s.name as supplier_name
       FROM orders o JOIN suppliers s ON o.supplier_id = s.supplier_id
       WHERE o.order_id = ?`,
      [id]
    );
    if (!rows[0]) return null;

    const [items] = await this.pool.query(
      `SELECT od.*, m.name as medicine_name
       FROM order_details od
       JOIN medicines m ON od.medicine_id = m.medicine_id
       WHERE od.order_id = ?`,
      [id]
    );
    return { ...rows[0], items };
  }

  async create(connection, { supplierId, orderDate, createdBy, items }) {
    const [result] = await connection.query(
      'INSERT INTO orders (supplier_id, order_date, status, created_by) VALUES (?, ?, ?, ?)',
      [supplierId, orderDate, 'pending', createdBy]
    );
    const orderId = result.insertId;

    for (const item of items) {
      await connection.query(
        'INSERT INTO order_details (order_id, medicine_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.medicine_id, item.quantity, item.unit_price]
      );
    }
    return orderId;
  }

  async updateStatus(id, status) {
    const [result] = await this.pool.query(
      'UPDATE orders SET status = ? WHERE order_id = ?',
      [status, id]
    );
    return result.affectedRows;
  }
}

export default Order;
