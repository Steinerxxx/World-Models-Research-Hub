import app from './app.js';
import { APP_VERSION, HOST, PORT } from './config.js';
import { getAllPapers, initDatabase, seedMockData } from './database.js';
import { startScrapeScheduler } from './jobs/scrapeScheduler.js';
import { scrapeArxiv } from './scraper.js';

app.listen(PORT, HOST, () => {
  console.log(`🚀 v${APP_VERSION} Backend is now STABLE and LISTENING on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/health`);
  console.log('✨ Ready to serve requests!');
});

(async () => {
  console.log('⏳ Initializing database connection...');
  await initDatabase();

  try {
    const papers = await getAllPapers();
    if (papers.length === 0) {
      console.log('Database is empty. Attempting to seed with mock data...');
      await seedMockData();

      console.log('Triggering background scrape...');
      scrapeArxiv().catch(err => console.error('Background scrape failed:', err));
    }
  } catch (err) {
    console.error('Error checking database state:', err);
  }

  startScrapeScheduler();
})();

export default app;
