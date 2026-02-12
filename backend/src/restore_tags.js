import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { classifyWithAI } from './ai_service.js';
import { classifyPaper } from './classifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Load backup data from papers.json if exists
const PAPERS_JSON_PATH = path.join(__dirname, '../../papers.json');
let backupPapers = [];
try {
  if (fs.existsSync(PAPERS_JSON_PATH)) {
    backupPapers = JSON.parse(fs.readFileSync(PAPERS_JSON_PATH, 'utf-8'));
    console.log(`Loaded ${backupPapers.length} papers from papers.json for restoration.`);
  }
} catch (e) {
  console.warn('Could not load papers.json backup.');
}

async function restoreTags() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB. Starting tag restoration...');

    const { rows: papers } = await client.query('SELECT id, title, abstract, url FROM papers');
    console.log(`Processing ${papers.length} papers to restore high-quality discovery tags...`);

    let count = 0;
    let restoredFromBackup = 0;
    let restoredFromAI = 0;
    let restoredFromRules = 0;

    for (const paper of papers) {
      count++;
      process.stdout.write(`\r[${count}/${papers.length}] Restoring: ${paper.title.substring(0, 40)}...`);
      
      let finalTags = [];

      // 1. Try restoring from papers.json backup first (most accurate for those papers)
      const backup = backupPapers.find(p => p.url === paper.url || p.title === paper.title);
      if (backup && backup.tags && backup.tags.length > 0) {
        finalTags = backup.tags;
        restoredFromBackup++;
      } else {
        // 2. Try AI classification
        try {
          const aiTags = await classifyWithAI(paper.title, paper.abstract);
          if (aiTags && Array.isArray(aiTags) && aiTags.length > 0) {
            finalTags = aiTags;
            restoredFromAI++;
          }
        } catch (aiErr) {
          // AI failed (401 etc), continue to rules
        }

        // 3. Fallback to advanced keyword rules if still empty
        if (finalTags.length === 0) {
          const ruleTags = await classifyPaper(paper.title, paper.abstract);
          if (ruleTags && ruleTags.length > 0) {
            finalTags = ruleTags;
            restoredFromRules++;
          }
        }
      }

      if (finalTags.length > 0) {
        await client.query('UPDATE papers SET tags = $1 WHERE id = $2', [finalTags, paper.id]);
      }
      
      // Small delay every 10 papers to not hammer the DB
      if (count % 10 === 0) await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n\n--- Restoration Summary ---');
    console.log(`Total papers: ${papers.length}`);
    console.log(`Restored from backup: ${restoredFromBackup}`);
    console.log(`Restored from AI: ${restoredFromAI}`);
    console.log(`Restored from Rules: ${restoredFromRules}`);
    console.log('✅ Restoration complete!');

  } catch (err) {
    console.error('\nRestoration failed:', err);
  } finally {
    await client.end();
    process.exit(0);
  }
}

restoreTags();
