import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const OFFICIAL_TAGS = [
  'Reinforcement Learning', 
  'Generative Models', 
  'Video Prediction', 
  'Robotics', 
  'Sim-to-Real',
  'Planning', 
  'Representation Learning',
  'Transformers', 
  'Diffusion Models', 
  'RNN', 
  'State Space Models'
];

async function cleanup() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB for cleanup...');

    // 1. Get all papers
    const { rows: papers } = await client.query('SELECT id, tags FROM papers WHERE tags IS NOT NULL');
    console.log(`Checking ${papers.length} papers...`);

    let updatedCount = 0;
    let badTagsFound = new Set();

    for (const paper of papers) {
      const originalTags = paper.tags || [];
      
      const filteredTags = originalTags.filter(tag => 
        OFFICIAL_TAGS.includes(tag)
      );

      originalTags.forEach(t => {
        if (!OFFICIAL_TAGS.includes(t)) badTagsFound.add(t);
      });

      if (originalTags.length !== filteredTags.length) {
        await client.query('UPDATE papers SET tags = $1 WHERE id = $2', [filteredTags, paper.id]);
        updatedCount++;
      }
    }

    console.log('Bad tags found across all papers:', Array.from(badTagsFound));
    console.log(`\n✅ Cleanup complete. Updated ${updatedCount} papers.`);
    console.log(`All non-official tags have been removed.`);
    
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await client.end();
  }
}

cleanup();
