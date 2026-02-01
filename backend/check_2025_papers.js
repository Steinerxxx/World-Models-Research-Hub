import { query, initDatabase } from './dist/database.js';

async function check() {
    await initDatabase();
    try {
        const res = await query(`
            SELECT COUNT(*) as count 
            FROM papers 
            WHERE publication_date >= '2025-01-01'
        `);
        console.log(`Papers from 2025 onwards: ${res.rows[0].count}`);
        
        const latest = await query(`
            SELECT title, publication_date 
            FROM papers 
            ORDER BY publication_date DESC 
            LIMIT 5
        `);
        console.log("Latest 5 papers:");
        latest.rows.forEach(r => console.log(`- ${r.publication_date}: ${r.title}`));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

check();
