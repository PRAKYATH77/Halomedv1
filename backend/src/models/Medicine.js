// Medicine Model — encapsulates all DB queries for medicines
export class Medicine {
  constructor(pool) {
    this.pool = pool;
  }

  async findAll({ category, searchTerm } = {}) {
    let query = 'SELECT * FROM medicines WHERE 1=1';
    const params = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (searchTerm) {
      query += ' AND (name LIKE ? OR category LIKE ?)';
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    query += ' ORDER BY name ASC';
    const [rows] = await this.pool.query(query, params);
    return rows;
  }

  async findById(id) {
    const [rows] = await this.pool.query('SELECT * FROM medicines WHERE medicine_id = ?', [id]);
    return rows[0] || null;
  }

  async create({ name, category, price, stock_quantity = 0, reorder_level = 10 }) {
    const [result] = await this.pool.query(
      'INSERT INTO medicines (name, category, price, stock_quantity, reorder_level) VALUES (?, ?, ?, ?, ?)',
      [name, category, price, stock_quantity, reorder_level]
    );
    return result.insertId;
  }

  async update(id, { name, category, price, stock_quantity, reorder_level }) {
    const [result] = await this.pool.query(
      'UPDATE medicines SET name=?, category=?, price=?, stock_quantity=?, reorder_level=? WHERE medicine_id=?',
      [name, category, price, stock_quantity, reorder_level, id]
    );
    return result.affectedRows;
  }

  async delete(id) {
    const [result] = await this.pool.query('DELETE FROM medicines WHERE medicine_id = ?', [id]);
    return result.affectedRows;
  }

  async findLowStock() {
    const [rows] = await this.pool.query(
      'SELECT * FROM medicines WHERE stock_quantity <= reorder_level ORDER BY stock_quantity ASC'
    );
    return rows;
  }

  async decrementStock(connection, medicineId, quantity) {
    await connection.query(
      'UPDATE medicines SET stock_quantity = stock_quantity - ? WHERE medicine_id = ?',
      [quantity, medicineId]
    );
  }

  async incrementStock(connection, medicineId, quantity) {
    await connection.query(
      'UPDATE medicines SET stock_quantity = stock_quantity + ? WHERE medicine_id = ?',
      [quantity, medicineId]
    );
  }
}

export default Medicine;
