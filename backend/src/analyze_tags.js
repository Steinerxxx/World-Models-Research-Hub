import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllTags, initDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function analyzeTags() {
  await initDatabase();
  const tags = await getAllTags();
  console.log(`Total unique tags: ${tags.length}`);
  console.log('Top 50 tags:');
  console.log(JSON.stringify(tags.slice(0, 50), null, 2));
  
  const rareTags = tags.filter(t => t.count === 1);
  console.log(`\nTags with only 1 paper: ${rareTags.length}`);
  console.log('Sample of rare tags:');
  console.log(JSON.stringify(rareTags.slice(0, 20).map(t => t.tag), null, 2));
  
  process.exit(0);
}

analyzeTags();
