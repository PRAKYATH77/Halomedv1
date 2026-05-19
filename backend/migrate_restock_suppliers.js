import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'halomed_user',
  password: 'halomed_pass123',
  database: 'halomed_pharmacy',
});

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Starting restock_requests supplier_id migration...');
    await conn.beginTransaction();

    // Create backup table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS restock_requests_supplier_backup (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        old_supplier_id INT,
        new_supplier_id INT,
        migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Find all restock rows that have a supplier_id referencing suppliers.supplier_id
    const [legacyRows] = await conn.query(`
      SELECT rr.request_id, rr.supplier_id as old_supplier_id, s.supplier_id as suppliers_table_id, s.name as suppliers_name, s.email as suppliers_email
      FROM restock_requests rr
      LEFT JOIN suppliers s ON rr.supplier_id = s.supplier_id
      WHERE rr.supplier_id IS NOT NULL AND s.supplier_id IS NOT NULL
    `);

    console.log('Found', legacyRows.length, 'rows referencing suppliers table');

    for (const row of legacyRows) {
      // Try to find a matching user by email first, then by username/name
      let [usersByEmail] = await conn.query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [row.suppliers_email]);
      let userId = null;
      if (usersByEmail.length > 0) userId = usersByEmail[0].user_id;

      if (!userId) {
        const [usersByName] = await conn.query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [row.suppliers_name]);
        if (usersByName.length > 0) userId = usersByName[0].user_id;
      }

      if (!userId) {
        console.log(`No matching user found for supplier (suppliers.supplier_id=${row.suppliers_table_id}). Skipping.`);
        continue;
      }

      // Backup current mapping
      await conn.query(
        'INSERT INTO restock_requests_supplier_backup (request_id, old_supplier_id, new_supplier_id) VALUES (?, ?, ?)',
        [row.request_id, row.old_supplier_id, userId]
      );

      // Perform update
      await conn.query('UPDATE restock_requests SET supplier_id = ? WHERE request_id = ?', [userId, row.request_id]);
      console.log(`Updated request ${row.request_id}: supplier ${row.old_supplier_id} -> user ${userId}`);
    }

    await conn.commit();
    console.log('Migration completed successfully.');
    conn.release();
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err.message || err);
    conn.release();
    process.exit(1);
  }
}

migrate();
