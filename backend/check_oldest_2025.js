
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkOldestPaper() {
  console.log('Connecting to DB...');
  try {
    const client = await pool.connect();
    console.log('Connected.');
    
    try {
      // Get oldest 5
      const resOldest = await client.query('SELECT publication_date, title FROM papers ORDER BY publication_date ASC LIMIT 5');
      console.log('Oldest 5 papers in DB:');
      resOldest.rows.forEach(p => {
        // publication_date might be a Date object or string depending on pg config
        const dateStr = p.publication_date instanceof Date 
          ? p.publication_date.toISOString().split('T')[0] 
          : p.publication_date;
        console.log(`${dateStr}: ${p.title}`);
      });

      // Get count
      const resCount = await client.query('SELECT COUNT(*) FROM papers');
      console.log(`Total papers count: ${resCount.rows[0].count}`);
      
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  } finally {
    await pool.end();
  }
}

checkOldestPaper();
