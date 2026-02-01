import { scrapeArxiv } from './dist/scraper.js';
import { initDatabase } from './dist/database.js';
import fs from 'fs';
import path from 'path';

async function testFallback() {
    console.log("🚀 Starting scraper test with JSON fallback...");
    
    // Clean up BEFORE init
    const jsonPath = path.join(process.cwd(), 'papers.json');
    if (fs.existsSync(jsonPath)) {
        console.log("ℹ️  Deleting existing papers.json for fresh test");
        fs.unlinkSync(jsonPath);
    }

    // Initialize DB (which triggers fallback and creates the file)
    await initDatabase();

    try {
        console.log("running scrapeArxiv()...");
        const stats = await scrapeArxiv();
        console.log("✅ Scraper completed!");
        console.log("Stats:", stats);
        
        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            console.log(`✅ papers.json created with ${data.length} papers.`);
            if (data.length > 0) {
                console.log("First paper:", data[0].title);
                console.log("Tags:", data[0].tags);
            }
        } else {
            console.error("❌ papers.json was NOT created.");
        }
    } catch (err) {
        console.error("❌ Scraper crashed:", err);
        process.exit(1);
    }
}

testFallback();
