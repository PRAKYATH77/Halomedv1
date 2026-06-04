// Inventory Model — encapsulates DB queries for inventory logs
export class Inventory {
  constructor(pool) {
    this.pool = pool;
  }

  async getLogs({ medicineId, changeType, startDate, endDate } = {}) {
    let query = `
      SELECT il.*, m.name as medicine_name, u.username as changed_by_username
      FROM inventory_logs il
      JOIN medicines m ON il.medicine_id = m.medicine_id
      LEFT JOIN users u ON il.changed_by = u.user_id
      WHERE 1=1
    `;
    const params = [];
    if (medicineId) {
      query += ' AND il.medicine_id = ?';
      params.push(medicineId);
    }
    if (changeType) {
      query += ' AND il.change_type = ?';
      params.push(changeType);
    }
    if (startDate && endDate) {
      query += ' AND DATE(il.log_date) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }
    query += ' ORDER BY il.log_date DESC LIMIT 500';
    const [rows] = await this.pool.query(query, params);
    return rows;
  }

  async addLog(pool, { medicineId, changeType, quantityChanged, changedBy, notes }) {
    const [medicine] = await pool.query(
      'SELECT stock_quantity FROM medicines WHERE medicine_id = ?',
      [medicineId]
    );
    if (!medicine[0]) throw new Error('Medicine not found');

    const previousQuantity = medicine[0].stock_quantity;
    let newQuantity;

    if (['add'].includes(changeType)) {
      newQuantity = previousQuantity + Math.abs(quantityChanged);
    } else if (['remove', 'sale', 'expired'].includes(changeType)) {
      newQuantity = previousQuantity - Math.abs(quantityChanged);
    } else {
      // adjustment: quantityChanged is the new absolute quantity
      newQuantity = quantityChanged;
    }

    // Update medicine stock
    await pool.query('UPDATE medicines SET stock_quantity = ? WHERE medicine_id = ?', [newQuantity, medicineId]);

    // Insert log
    const [result] = await pool.query(
      `INSERT INTO inventory_logs (medicine_id, change_type, quantity_changed, previous_quantity, new_quantity, changed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [medicineId, changeType, quantityChanged, previousQuantity, newQuantity, changedBy, notes || null]
    );
    return result.insertId;
  }

  async getSummary() {
    const [rows] = await this.pool.query(`
      SELECT
        COUNT(*) as total_medicines,
        COALESCE(SUM(stock_quantity), 0) as total_stock,
        COALESCE(SUM(stock_quantity * price), 0) as total_value,
        SUM(CASE WHEN stock_quantity <= reorder_level THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM medicines
    `);
    return rows[0];
  }

  async getExpiredBatches() {
    const [rows] = await this.pool.query(`
      SELECT mb.*, m.name as medicine_name, m.category
      FROM medicine_batches mb
      JOIN medicines m ON mb.medicine_id = m.medicine_id
      WHERE mb.expiry_date < CURDATE()
      ORDER BY mb.expiry_date ASC
    `);
    return rows;
  }
}

export default Inventory;
