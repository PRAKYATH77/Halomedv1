import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'halomed_user',
  password: 'halomed_pass123',
  database: 'halomed_pharmacy',
});

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
}

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('Creating users for legacy suppliers...');
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS restock_requests_supplier_backup (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        old_supplier_id INT,
        new_supplier_id INT,
        migrated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    const [suppliers] = await conn.query('SELECT supplier_id, name, email FROM suppliers WHERE is_active = 1');
    const created = [];

    for (const s of suppliers) {
      // Try to find existing user by email
      const [usersByEmail] = await conn.query('SELECT user_id, username FROM users WHERE email = ? LIMIT 1', [s.email]);
      let userId = null;
      let username = null;

      if (usersByEmail.length > 0) {
        userId = usersByEmail[0].user_id;
        username = usersByEmail[0].username;
        console.log(`Found existing user for supplier ${s.name} -> ${username} (id=${userId})`);
      } else {
        // Try by slugged name
        const slug = slugify(s.name);
        const [usersBySlug] = await conn.query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [slug]);
        let finalUsername = slug;
        let counter = 1;
        while (usersBySlug.length > 0) {
          finalUsername = `${slug}_${counter}`;
          const [dup] = await conn.query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [finalUsername]);
          if (dup.length === 0) break;
          counter++;
        }

        const defaultPass = 'supplier_default123';
        const hash = await bcrypt.hash(defaultPass, 10);

        const [ins] = await conn.query('INSERT INTO users (username, password_hash, email, role, is_active) VALUES (?, ?, ?, ?, TRUE)', [finalUsername, hash, s.email, 'supplier']);
        userId = ins.insertId;
        username = finalUsername;
        created.push({ supplier_id: s.supplier_id, userId, username, password: defaultPass });
        console.log(`Created user ${username} (id=${userId}) for supplier ${s.name}`);
      }

      // Update restock_requests mapping: backup then update
      // Backup existing rows for this supplier reference
      const [rows] = await conn.query('SELECT request_id, supplier_id FROM restock_requests WHERE supplier_id = ?', [s.supplier_id]);
      for (const r of rows) {
        await conn.query('INSERT INTO restock_requests_supplier_backup (request_id, old_supplier_id, new_supplier_id) VALUES (?, ?, ?)', [r.request_id, r.supplier_id, userId]);
      }

      // Update
      await conn.query('UPDATE restock_requests SET supplier_id = ? WHERE supplier_id = ?', [userId, s.supplier_id]);
    }

    await conn.commit();
    console.log('All suppliers processed. Created users:');
    console.table(created);
    conn.release();
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error('Failed:', err.message || err);
    conn.release();
    process.exit(1);
  }
}

run();
