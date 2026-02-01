
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTags() {
  try {
    const client = await pool.connect();
    console.log("Connected to DB.");

    try {
        // Check papers with "Transformer" tag
        const res = await client.query(`
        SELECT count(*) 
        FROM papers 
        WHERE 'Transformer' = ANY(tags)
        `);
        console.log(`Papers with 'Transformer' tag: ${res.rows[0].count}`);

        // Check all distinct tags
        const resTags = await client.query(`
    SELECT unnest(tags) as tag, count(*) as count
    FROM papers
    GROUP BY tag
    ORDER BY count DESC
  `);

  console.log("Tag Distribution:", resTags.rows);

  const missingTags = ['RNN', 'State Space Models'];
  for (const tag of missingTags) {
    const res = await client.query('SELECT count(*) FROM papers WHERE $1 = ANY(tags)', [tag]);
    console.log(`Papers with '${tag}' tag: ${res.rows[0].count}`);
  }
        
        // Check a sample paper to see its structure
        const sample = await client.query('SELECT title, tags FROM papers WHERE array_length(tags, 1) > 0 LIMIT 1');
        if (sample.rows.length > 0) {
        console.log("\nSample paper tags:", sample.rows[0]);
        } else {
        console.log("\nNo papers with tags found.");
        }
    } finally {
        client.release();
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

checkTags();
