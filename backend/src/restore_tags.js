import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyWithAI } from './ai_service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function restoreTags() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB. Starting tag restoration...');

    const { rows: papers } = await client.query('SELECT id, title, abstract FROM papers');
    console.log(`Processing ${papers.length} papers to restore high-quality discovery tags...`);

    let count = 0;
    for (const paper of papers) {
      console.log(`[${count + 1}/${papers.length}] Re-classifying: ${paper.title.substring(0, 50)}...`);
      
      const newTags = await classifyWithAI(paper.title, paper.abstract);
      
      if (newTags && newTags.length > 0) {
        await client.query('UPDATE papers SET tags = $1 WHERE id = $2', [newTags, paper.id]);
      }
      
      count++;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✅ Restoration complete! All papers have been re-processed with discovery capabilities.');
  } catch (err) {
    console.error('Restoration failed:', err);
  } finally {
    await client.end();
  }
}

restoreTags();
