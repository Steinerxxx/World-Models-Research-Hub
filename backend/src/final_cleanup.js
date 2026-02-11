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
    console.log('Connected to DB for final cleanup...');

    // Remove specific deprecated tags
    const deprecated = ['World Models', 'Model-Based RL'];
    
    // We'll use a more direct SQL approach for each paper
    const { rows: papers } = await client.query('SELECT id, tags FROM papers WHERE tags IS NOT NULL');
    console.log(`Analyzing ${papers.length} papers...`);

    let updatedCount = 0;
    for (const paper of papers) {
      const original = paper.tags || [];
      // Keep only tags that are in the official list
      const filtered = original.filter(t => OFFICIAL_TAGS.includes(t));
      
      if (original.length !== filtered.length) {
        await client.query('UPDATE papers SET tags = $1 WHERE id = $2', [filtered, paper.id]);
        updatedCount++;
      }
    }

    console.log(`✅ Successfully cleaned up ${updatedCount} papers.`);
    
    // Verify
    const verifyRes = await client.query('SELECT DISTINCT unnest(tags) as tag FROM papers');
    console.log('Final tags in DB:', verifyRes.rows.map(r => r.tag));

  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await client.end();
  }
}

cleanup();
