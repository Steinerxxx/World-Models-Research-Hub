
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('DB URL:', process.env.DATABASE_URL ? 'Found' : 'Missing');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL?.replace(':6543', ':5432'),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000 // 5 seconds timeout
});

async function test() {
  try {
    console.log('Connecting...');
    const client = await pool.connect();
    console.log('Client connected!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    client.release();
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await pool.end();
  }
}

test();
