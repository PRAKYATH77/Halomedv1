import mysql from 'mysql2/promise';

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'halomed_db'
    });

    const [rows] = await conn.execute(
      'SELECT user_id, username, email, role, is_active FROM users WHERE username IN (?, ?)',
      ['delivery_store', 'admin']
    );

    console.log('Users found:');
    console.log(JSON.stringify(rows, null, 2));

    // Also show all users to see what's in the table
    const [allUsers] = await conn.execute('SELECT user_id, username, email, role FROM users ORDER BY user_id');
    console.log('\nAll users in database:');
    console.log(JSON.stringify(allUsers, null, 2));

    await conn.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
