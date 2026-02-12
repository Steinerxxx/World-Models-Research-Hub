import express from 'express';
import cors from 'cors';
import {
  createPapersTable,
  addPaper,
  getAllPapers,
  getPaperTrends,
  getAllTags,
  updatePaperTags,
  updatePaperSummary,
  getPaperById,
  query,
  initDatabase,
  seedMockData,
  getDbStatus
} from './database.js';
import { scrapeArxiv } from './scraper.js';
import { classifyPaper } from './classifier.js';
import { generatePaperAnalysis } from './ai_service.js';
import authRoutes from './auth.js';
import favoritesRoutes from './favorites.js';
import cron from 'node-cron';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- 1. API Routes ---
// Health check (Public)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    version: '3.5.2',
    timestamp: new Date().toISOString(),
    db: getDbStatus() ? 'connected' : 'disconnected' 
  });
});

// Debug version endpoint
app.get('/api/debug-version', (req, res) => {
  res.json({ version: '3.5.2', build_time: '2026-02-12' });
});

app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);

// API route to get all papers
app.get('/api/papers', async (req, res) => {
  try {
    const papers = await getAllPapers();
    res.json(papers);
  } catch (err) {
    console.error('Error getting papers:', err);
    res.status(500).json({ message: 'Failed to get papers' });
  }
});

// API route to get trends data (minimized fields)
app.get('/api/papers/trends', async (req, res) => {
  try {
    const trends = await getPaperTrends();
    res.json(trends);
  } catch (err) {
    console.error('Error getting trends:', err);
    res.status(500).json({ message: 'Failed to get trends' });
  }
});

// API route to get all tags with counts
app.get('/api/tags', async (req, res) => {
  try {
    console.log('GET /api/tags - Fetching all tags');
    const tags = await getAllTags();
    console.log(`GET /api/tags - Found ${tags.length} tags`);
    res.json(tags);
  } catch (err) {
    console.error('Error getting tags:', err);
    res.status(500).json({ message: 'Failed to get tags', error: err.message });
  }
});

// API route to add a new paper
app.post('/api/papers', async (req, res) => {
  try {
    await addPaper(req.body);
    res.status(201).json({ message: 'Paper added successfully' });
  } catch (err) {
    console.error('Error adding paper:', err);
    res.status(500).json({ message: 'Failed to add paper' });
  }
});

// API route to trigger scraper
app.post('/api/scrape', async (req, res) => {
  try {
    const fullBackfill = req.query.type === 'full';
    console.log(`Triggering scrape (Full Backfill: ${fullBackfill})...`);
    
    if (fullBackfill) {
      scrapeArxiv(true).catch(err => console.error('Full backfill failed:', err));
      return res.json({ 
        message: 'Full backfill started in background.',
        status: 'processing'
      });
    }

    const result = await scrapeArxiv(false);
    res.json({ message: 'Scraping completed', stats: result });
  } catch (err) {
    console.error('Scraping error:', err);
    res.status(500).json({ message: 'Scraping failed' });
  }
});

// API route to analyze a paper
app.post('/api/papers/:id/analyze', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const paper = await getPaperById(id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    // Check if analysis already exists in database
    if (paper.summary && paper.contribution) {
      console.log(`[Cache Hit] Returning existing analysis for paper ${id}`);
      return res.json({ 
        message: 'Analysis retrieved from cache', 
        analysis: {
          summary: paper.summary,
          contribution: paper.contribution,
          limitations: paper.limitations || "Not explicitly stated"
        } 
      });
    }

    console.log(`[Cache Miss] Generating new analysis for paper ${id}...`);
    const analysis = await generatePaperAnalysis(paper.title, paper.abstract);
    if (analysis) {
      await updatePaperSummary(id, analysis);
    }
    res.json({ message: 'Analysis generated', analysis });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ message: 'Analysis failed' });
  }
});



// --- 2. Static Files ---
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// --- 3. Frontend Catch-all (Must be LAST) ---
app.use((req, res, next) => {
  // If the request starts with /api but didn't match any route, it's a 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'API endpoint not found',
      hint: 'The backend might be running an outdated version. Please redeploy on Sealos.',
      requested_path: req.path
    });
  }
  // Otherwise, serve the frontend index.html
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- 3. Error Handling ---
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// Start the server immediately, don't wait for DB
const server = app.listen(Number(port), '0.0.0.0', () => {
  console.log(`🚀 v3.5.2 Backend is now STABLE and LISTENING on port ${port}`);
  console.log(`📡 Health Check: http://localhost:${port}/health`);
  console.log(`✨ Ready to serve requests!`);
});

// Initialize Database asynchronously
(async () => {
  console.log('⏳ Initializing database connection...');
  await initDatabase();
  
  // Check if database is empty and seed if necessary
  try {
    const papers = await getAllPapers();
    if (papers.length === 0) {
      console.log('Database is empty. Attempting to seed with mock data...');
      await seedMockData();
      
      // Also trigger a background scrape
      console.log('Triggering background scrape...');
      scrapeArxiv().catch(err => console.error('Background scrape failed:', err));
    }
  } catch (err) {
    console.error('Error checking database state:', err);
  }
})();

// Auth middleware for admin endpoints
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized: Admin key required' });
  }
};

// Manual seed endpoint
app.post('/api/admin/seed', adminAuth, async (req, res) => {
  try {
    await seedMockData();
    res.json({ message: 'Database seeded successfully' });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ message: 'Seed failed' });
  }
});

// API route to reclassify all existing papers
app.post('/api/reclassify', adminAuth, async (req, res) => {
  try {
    const papers = await getAllPapers();
    let count = 0;
    
    for (const paper of papers) {
      const tags = await classifyPaper(paper.title, paper.abstract);
      await updatePaperTags(paper.id, tags);
      count++;
    }
    
    res.json({ 
      message: 'Reclassification completed successfully', 
      processed_count: count 
    });
  } catch (err) {
    console.error('Error reclassifying papers:', err);
    res.status(500).json({ message: 'Failed to reclassify papers' });
  }
});

export default app;
