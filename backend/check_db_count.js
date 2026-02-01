
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Supabase
});

async function checkCount() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT COUNT(*) FROM papers');
        console.log(`Row count in "papers" table: ${res.rows[0].count}`);
        client.release();
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkCount();
