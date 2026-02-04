import { initDatabase, seedMockData } from './database.js';
import { scrapeArxiv } from './scraper.js';

console.log('🔧 Starting Manual Restore Process...');

(async () => {
  try {
    // 1. Initialize DB connection
    await initDatabase();
    
    // 2. Trigger Full Scrape
    console.log('🚀 Triggering deep scrape for 1000+ papers...');
    const stats = await scrapeArxiv(true);
    
    console.log('✅ Restore Completed Successfully!');
    console.log('Stats:', stats);
    process.exit(0);
  } catch (err) {
    console.error('❌ Restore Failed:', err);
    process.exit(1);
  }
})();
