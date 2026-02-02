import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { classifyPaper } from './dist/classifier.js';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function reclassifyAll() {
  const client = await pool.connect();
  try {
    console.log("Connected to database...");
    
    // Fetch all papers
    const res = await client.query('SELECT id, title, abstract, tags FROM papers');
    const papers = res.rows;
    console.log(`Found ${papers.length} papers to reclassify.`);

    let updatedCount = 0;

    for (const paper of papers) {
      const oldTags = new Set(paper.tags || []);
      const newTagsArray = await classifyPaper(paper.title, paper.abstract);
      const newTags = new Set(newTagsArray);

      // Check if tags have changed (simple check: size difference or missing items)
      // Actually, we want to MERGE new rule-based tags.
      // classifyPaper returns a fresh set of tags based on rules + AI (if enabled).
      // Since classifyPaper is comprehensive, we can just overwrite, OR merge if we trust old manual tags.
      // But here we want to FIX missing tags like RNN.
      // Let's assume classifyPaper is the source of truth for automated tags.
      
      // However, to be safe and efficient, let's just see if the new tags are different.
      // Also, we might want to preserve any tags that are NOT in the classification rules if they were added manually?
      // Assuming no manual tagging yet, just automated.
      
      // Let's optimize: only update if the new tags contain something the old ones didn't, or vice versa.
      // Specifically we want to see if 'RNN' or 'State Space Models' or 'Transformers' (plural fix) appears.
      
      // Let's just update all of them to be consistent with current rules.
      
      // Sort for comparison
      const sortedOld = [...oldTags].sort().join(',');
      const sortedNew = [...newTags].sort().join(',');

      if (sortedOld !== sortedNew) {
        await client.query('UPDATE papers SET tags = $1 WHERE id = $2', [Array.from(newTags), paper.id]);
        updatedCount++;
        if (updatedCount % 50 === 0) {
            console.log(`Updated ${updatedCount} papers...`);
        }
      }
    }

    console.log(`Reclassification complete. Updated ${updatedCount} papers.`);

  } catch (err) {
    console.error('Error reclassifying papers:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

reclassifyAll();
