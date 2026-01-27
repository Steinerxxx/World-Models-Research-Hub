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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await query(createTableQuery);
  console.log('"papers" table created or already exists.');
}

export async function addPaper(paper: { title: string; authors: string[]; abstract: string; url: string; publication_date: string; }) {
  const { title, authors, abstract, url, publication_date } = paper;
  const insertQuery = `
    INSERT INTO papers (title, authors, abstract, url, publication_date)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (url) DO NOTHING;
  `;
  await query(insertQuery, [title, authors, abstract, url, publication_date]);
}

export async function getAllPapers() {
  const { rows } = await query('SELECT * FROM papers ORDER BY publication_date DESC');
  return rows;
}
