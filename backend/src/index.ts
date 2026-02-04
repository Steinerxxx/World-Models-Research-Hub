import express from 'express';
import cors from 'cors';
import {
  createPapersTable,
  addPaper,
  getAllPapers,
  updatePaperTags,
  updatePaperSummary,
  getPaperById,
  query,
  initDatabase
} from './database.js';
import { scrapeArxiv } from './scraper.js';
import { classifyPaper } from './classifier.js';
import { generatePaperAnalysis } from './ai_service.js';
import cron from 'node-cron';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Database (or fallback to JSON)
initDatabase();

// API route to test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({
      message: 'Database connection successful!',
      time: result.rows[0].now,
    });
  } catch (err) {
    // If fallback is active, this query will fail or hang, but the app is alive.
    // We should probably return status of connection mode.
    console.error('Database query error (expected if using local JSON)', err);
    res.status(200).json({
      message: 'Using Local JSON Storage (Database not connected)',
      warning: 'Live database connection failed. Running in offline mode.'
    });
  }
});

// API route to get all papers
app.get('/api/papers', async (req, res) => {
  try {
    const papers = await getAllPapers();
    res.json(papers);
  } catch (err) {
    console.error('Error fetching papers:', err);
    res.status(500).json({ message: 'Failed to retrieve papers' });
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
    const result = await scrapeArxiv();
    res.json({ 
      message: 'Scraping completed successfully', 
      stats: result 
    });
  } catch (err) {
    console.error('Error during scraping:', err);
    res.status(500).json({ 
      message: 'Scraping failed', 
      error: err instanceof Error ? err.message : 'Unknown error' 
    });
  }
});

// API route to reclassify all existing papers
app.post('/api/reclassify', async (req, res) => {
  try {
    const papers = await getAllPapers();
    let count = 0;
    
    for (const paper of papers) {
      // Re-run classification logic
      const tags = await classifyPaper(paper.title, paper.abstract);
      // Update the database record
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

// API route to analyze a paper (summary, contribution, limitations)
app.post('/api/papers/:id/analyze', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const paper = await getPaperById(id);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    if (!paper.abstract) {
      return res.status(400).json({ message: 'Paper has no abstract to analyze' });
    }

    console.log(`Analyzing paper: ${paper.title}`);
    const analysis = await generatePaperAnalysis(paper.title, paper.abstract);

    if (!analysis) {
      return res.status(500).json({ message: 'AI service failed to generate analysis' });
    }

    await updatePaperSummary(id, analysis);

    res.json({ 
      message: 'Analysis generated successfully', 
      analysis 
    });
  } catch (err) {
    console.error('Error analyzing paper:', err);
    res.status(500).json({ message: 'Failed to analyze paper' });
  }
});

// Schedule automatic scraping every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled scraping task...');
  try {
    const result = await scrapeArxiv();
    console.log('Scheduled scraping completed:', result);
  } catch (err) {
    console.error('Scheduled scraping failed:', err);
  }
});

// Start the server
// Listen on all interfaces (0.0.0.0) which is required by Render
app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Backend server is running at port ${port}`);
});

export default app;
