import { scrapeArxiv } from './dist/scraper.js';
import { initDatabase } from './dist/database.js';

async function backfill() {
    console.log("Starting backfill for 2025 papers...");
    await initDatabase();
    
    try {
        // Pass true to enable full backfill mode (deep scraping until 2025 cutoff)
        const result = await scrapeArxiv(true);
        console.log("Backfill complete.");
        console.log("Stats:", result);
    } catch (e) {
        console.error("Backfill failed:", e);
    }
    process.exit(0);
}

backfill();
