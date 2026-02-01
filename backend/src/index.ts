import express from 'express';
import cors from 'cors';
import {
  createPapersTable,
  addPaper,
  getAllPapers,
  updatePaperTags,
  query,
  initDatabase
} from './database.js';
import { scrapeArxiv } from './scraper.js';
import { classifyPaper } from './classifier.js';
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
    console.error('Error during reclassification:', err);
    res.status(500).json({ 
      message: 'Reclassification failed', 
      error: err instanceof Error ? err.message : 'Unknown error' 
    });
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
app.listen(port, () => {
  console.log(`Backend server is running at port ${port}`);
});
