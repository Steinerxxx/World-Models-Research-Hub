import fs from 'fs';
import * as cheerio from 'cheerio';

async function debugScrape() {
  try {
    console.log('Reading local file...');
    const data = fs.readFileSync('arxiv_dump.html', 'utf8');
    const $ = cheerio.load(data);

    const results = $('li.arxiv-result');
    console.log(`Found ${results.length} results.`);

    results.each((i, el) => {
      if (i < 5) { // Check first 5
        const title = $(el).find('p.title').text().trim();
        const publishedText = $(el).find('p.is-size-7').text().trim();
        // Try multiple regexes or just print the text to see what it is
        const dateMatch = publishedText.match(/originally announced (\w+ \d{4})/i);
        
        console.log(`\n--- Paper ${i+1} ---`);
        console.log(`Title: ${title}`);
        console.log(`Raw Date Text: "${publishedText}"`);
        if (dateMatch) {
            console.log(`Parsed Date: ${dateMatch[1]} -> ${new Date(dateMatch[1]).toISOString()}`);
        } else {
            console.log('NO DATE MATCH FOUND');
            // Try to match "Submitted X" as fallback?
            const submittedMatch = publishedText.match(/submitted (\d+ \w+ \d{4})/i);
             if (submittedMatch) {
                console.log(`Submitted Date Match: ${submittedMatch[1]} -> ${new Date(submittedMatch[1]).toISOString()}`);
             }
        }
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

debugScrape();
