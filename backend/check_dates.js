import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDates() {
  try {
    const res = await pool.query('SELECT publication_date, COUNT(*) FROM papers GROUP BY publication_date ORDER BY publication_date DESC');
    console.log('Date distribution in DB:', res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

checkDates();
