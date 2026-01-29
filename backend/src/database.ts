import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function createPapersTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS papers (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT[],
      abstract TEXT,
      publication_date DATE,
      url TEXT UNIQUE NOT NULL,
      tags TEXT[],
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await query(createTableQuery);

  // Add tags column if it doesn't exist (migration for existing table)
  try {
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS tags TEXT[]`);
  } catch (err) {
    console.log('Column tags might already exist or error adding it:', err);
  }
  
  console.log('"papers" table created or updated.');
}

export async function addPaper(paper: { title: string; authors: string[]; abstract: string; url: string; publication_date: string; tags?: string[] }) {
  const { title, authors, abstract, url, publication_date, tags } = paper;
  const insertQuery = `
    INSERT INTO papers (title, authors, abstract, url, publication_date, tags)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (url) DO UPDATE SET 
      tags = EXCLUDED.tags,
      publication_date = EXCLUDED.publication_date;
  `;
  await query(insertQuery, [title, authors, abstract, url, publication_date, tags || []]);
}

export async function updatePaperTags(id: number, tags: string[]) {
  const updateQuery = `
    UPDATE papers SET tags = $1 WHERE id = $2;
  `;
  await query(updateQuery, [tags, id]);
}

export async function getAllPapers() {
  const { rows } = await query('SELECT * FROM papers ORDER BY publication_date DESC');
  return rows;
}
