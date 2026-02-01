import { query } from './dist/database.js';

async function test() {
  try {
    const res = await query('SELECT NOW()');
    console.log('DB Connection Successful:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('DB Connection Failed:', err);
    process.exit(1);
  }
}

test();
