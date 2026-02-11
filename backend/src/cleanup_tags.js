import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const DEPRECATED_TAGS = [
  'World Models', 
  'Model-Based RL'
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
    let removedTagsCount = 0;

    for (const paper of papers) {
      const originalTags = paper.tags || [];
      
      // 现在的逻辑：只过滤掉黑名单里的标签，保留其他所有（包括 AI 生成的新标签）
      const filteredTags = originalTags.filter(tag => 
        !DEPRECATED_TAGS.includes(tag)
      );

      if (originalTags.length !== filteredTags.length) {
        await client.query('UPDATE papers SET tags = $1 WHERE id = $2', [filteredTags, paper.id]);
        updatedCount++;
        removedTagsCount += (originalTags.length - filteredTags.length);
      }
    }

    console.log(`\n✅ Cleanup complete. Updated ${updatedCount} papers.`);
    console.log(`Removed ${removedTagsCount} deprecated tags (World Models / Model-Based RL).`);
    console.log(`All other AI-generated tags have been PRESERVED.`);
    
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await client.end();
  }
}

cleanup();
