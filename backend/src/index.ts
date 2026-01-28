import express from 'express';
import cors from 'cors';
import {
  createPapersTable,
  addPaper,
  getAllPapers,
  query
} from './database.js';
import { scrapeArxiv } from './scraper.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API route to test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({
      message: 'Database connection successful!',
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error('Database query error', err);
    res.status(500).json({
      message: 'Database connection failed!',
      error: err instanceof Error ? err.message : 'An unknown error occurred',
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

// Start the server
app.listen(port, () => {
  console.log(`Backend server is running at port ${port}`);
});
