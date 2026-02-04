import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

let isDbConnected = false;
const LOCAL_DB_PATH = path.join(process.cwd(), 'papers.json');

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit, just mark as disconnected
  isDbConnected = false;
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function initDatabase() {
  try {
    await pool.query('SELECT 1');
    isDbConnected = true;
    console.log('✅ Connected to PostgreSQL database');
    await createPapersTable();
  } catch (err) {
    console.warn('⚠️  Database connection failed. Switching to local JSON storage.');
    console.warn('   Error:', (err as Error).message);
    isDbConnected = false;
    
    // Initialize local JSON if not exists
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2));
    }
  }
}

export async function createPapersTable() {
  if (!isDbConnected) return; // Skip if using JSON

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
  try {
    await query(createTableQuery);

    // Add tags column if it doesn't exist (migration for existing table)
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS tags TEXT[]`);
    
    // Add AI summary columns if they don't exist
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS summary TEXT`);
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS contribution TEXT`);
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS limitations TEXT`);
    
    console.log('"papers" table created or updated.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

export async function addPaper(paper: { title: string; authors: string[]; abstract: string; url: string; publication_date: string; tags?: string[] }) {
  if (isDbConnected) {
    const { title, authors, abstract, url, publication_date, tags } = paper;
    const insertQuery = `
      INSERT INTO papers (title, authors, abstract, url, publication_date, tags)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (url) DO UPDATE SET 
        tags = EXCLUDED.tags,
        publication_date = EXCLUDED.publication_date;
    `;
    await query(insertQuery, [title, authors, abstract, url, publication_date, tags || []]);
  } else {
    // Local JSON Fallback
    const papers = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    const existingIndex = papers.findIndex((p: any) => p.url === paper.url);
    
    const newPaper = {
      ...paper,
      id: existingIndex >= 0 ? papers[existingIndex].id : Date.now(), // Mock ID
      created_at: existingIndex >= 0 ? papers[existingIndex].created_at : new Date().toISOString()
    };

    if (existingIndex >= 0) {
      papers[existingIndex] = { ...papers[existingIndex], ...newPaper };
    } else {
      papers.push(newPaper);
    }
    
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(papers, null, 2));
  }
}

export async function updatePaperTags(id: number, tags: string[]) {
  if (isDbConnected) {
    const updateQuery = `
      UPDATE papers SET tags = $1 WHERE id = $2;
    `;
    await query(updateQuery, [tags, id]);
  } else {
    // Local JSON Fallback
    const papers = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    const paperIndex = papers.findIndex((p: any) => p.id === id);
    if (paperIndex >= 0) {
      papers[paperIndex].tags = tags;
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(papers, null, 2));
    }
  }
}

export async function updatePaperSummary(id: number, analysis: { summary: string; contribution: string; limitations: string }) {
  if (isDbConnected) {
    const updateQuery = `
      UPDATE papers 
      SET summary = $1, contribution = $2, limitations = $3 
      WHERE id = $4;
    `;
    await query(updateQuery, [analysis.summary, analysis.contribution, analysis.limitations, id]);
  } else {
    // Local JSON Fallback
    const papers = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    const paperIndex = papers.findIndex((p: any) => p.id === id);
    if (paperIndex >= 0) {
      papers[paperIndex] = { ...papers[paperIndex], ...analysis };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(papers, null, 2));
    }
  }
}

export async function getPaperById(id: number) {
  if (isDbConnected) {
    const { rows } = await query('SELECT * FROM papers WHERE id = $1', [id]);
    return rows[0];
  } else {
    // Local JSON Fallback
    if (!fs.existsSync(LOCAL_DB_PATH)) return null;
    const papers = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    return papers.find((p: any) => p.id === Number(id));
  }
}

export async function getAllPapers() {
  if (isDbConnected) {
    const { rows } = await query('SELECT * FROM papers ORDER BY publication_date DESC');
    return rows;
  } else {
    // Local JSON Fallback
    if (!fs.existsSync(LOCAL_DB_PATH)) return [];
    const papers = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
    return papers.sort((a: any, b: any) => new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime());
  }
}
