import { scrapeArxiv } from './dist/scraper.js';
import { initDatabase } from './dist/database.js';
import fs from 'fs';
import util from 'util';

const logFile = fs.createWriteStream('backfill_debug.log', { flags: 'w' });
const logStdout = process.stdout;

console.log = function(d) { //
  logFile.write(util.format(d) + '\n');
  logStdout.write(util.format(d) + '\n');
};

console.error = function(d) { //
  logFile.write(util.format(d) + '\n');
  logStdout.write(util.format(d) + '\n');
};

console.warn = function(d) { //
  logFile.write(util.format(d) + '\n');
  logStdout.write(util.format(d) + '\n');
};

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
