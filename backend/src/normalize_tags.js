import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, initDatabase, getDbStatus, getLocalDbPath } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const TAG_MAPPING = {
  // RL variations
  'Reinforcement Learning': 'Reinforcement Learning',
  'Reinforcement-learning': 'Reinforcement Learning',
  'RL': 'Reinforcement Learning',
  'Deep Reinforcement Learning': 'Reinforcement Learning',
  'Deep RL': 'Reinforcement Learning',
  'Mbrl': 'Reinforcement Learning',
  'Model-based Reinforcement Learning': 'Reinforcement Learning',
  
  // Generative models
  'Generative Models': 'Generative Models',
  'Generative Modeling': 'Generative Models',
  'Diffusion': 'Diffusion Models',
  'Diffusion-models': 'Diffusion Models',
  
  // State Space Models
  'Ssm': 'State Space Models',
  'State-space Models': 'State Space Models',
  
  // Representation
  'Representation-learning': 'Representation Learning',
  'Latent Representations': 'Representation Learning',
  
  // Transformers
  'Transformer': 'Transformers',
  'Attention Mechanism': 'Transformers',
  
  // Common specific tags
  'Offline-rl': 'Offline RL',
  'Offline Reinforcement Learning': 'Offline RL',
  'Multi Agent Systems': 'Multi-Agent Systems',
  'Multi-agent Reinforcement Learning': 'Multi-Agent Systems',
  'Marl': 'Multi-Agent Systems'
};

async function normalizeTags() {
  await initDatabase();
  const isDb = getDbStatus();
  
  let rows;
  if (isDb) {
    const client = await query('SELECT id, tags FROM papers');
    rows = client.rows;
  } else {
    const localPath = getLocalDbPath();
    const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    rows = data;
  }

  console.log(`Analyzing ${rows.length} papers (Mode: ${isDb ? 'DB' : 'Local JSON'})...`);
  
  let totalChanges = 0;
  const updatedPapers = isDb ? [] : [...rows];

  for (let i = 0; i < rows.length; i++) {
    const paper = rows[i];
    if (!paper.tags || !Array.isArray(paper.tags)) continue;

    const newTags = paper.tags.map(tag => {
      let cleaned = tag.trim();
      if (TAG_MAPPING[cleaned]) return TAG_MAPPING[cleaned];

      // Don't normalize common acronyms to Title Case
      const acronyms = ['RL', 'ML', 'AI', 'SSM', 'NLP', 'CV', 'MARL', 'VLA', 'JEPA'];
      if (acronyms.includes(cleaned.toUpperCase())) {
          return cleaned.toUpperCase();
      }

      cleaned = cleaned.split(/[\s-]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      const unwanted = ['World Models', 'Model Based Rl', 'Ai', 'Machine Learning', 'Research', 'Neural Networks'];
      if (unwanted.includes(cleaned)) return null;
      return cleaned;
    })
    .filter((tag, index, self) => tag && self.indexOf(tag) === index);

    if (JSON.stringify([...newTags].sort()) !== JSON.stringify([...paper.tags].sort())) {
      if (isDb) {
        await query('UPDATE papers SET tags = $1 WHERE id = $2', [newTags, paper.id]);
      } else {
        updatedPapers[i].tags = newTags;
      }
      totalChanges++;
    }
  }

  if (!isDb && totalChanges > 0) {
    fs.writeFileSync(getLocalDbPath(), JSON.stringify(updatedPapers, null, 2));
  }

  console.log(`✅ Normalized tags for ${totalChanges} papers.`);
  process.exit(0);
}

normalizeTags().catch(err => {
  console.error('Normalization failed:', err);
  process.exit(1);
});
