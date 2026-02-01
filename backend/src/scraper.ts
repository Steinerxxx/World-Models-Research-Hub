import axios from 'axios';
import * as cheerio from 'cheerio';
import { addPaper } from './database.js';
import { classifyPaper } from './classifier.js';

const BASE_ARXIV_URL = 'https://arxiv.org/search/?query="World+Models"&searchtype=all&source=header&order=-announced_date_first&size=50';

interface Paper {
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  publication_date: string; 
  tags?: string[];
}

function parseDate(dateText: string): string {
    const months: { [key: string]: number } = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
        'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
    };
    
    // Try to find "Submitted DD Month, YYYY" first
    // e.g., "Submitted 28 January, 2026;"
    const submittedMatch = dateText.match(/Submitted (\d{1,2}) (\w+), (\d{4})/);
    if (submittedMatch) {
        const day = parseInt(submittedMatch[1]);
        const monthStr = submittedMatch[2];
        const year = parseInt(submittedMatch[3]);
        const month = months[monthStr] !== undefined ? months[monthStr] : 0;
        return new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];
    }

    // Fallback to "originally announced Month Year"
    const match = dateText.match(/originally announced (\w+) (\d{4})/);
    if (match) {
        const monthStr = match[1];
        const year = parseInt(match[2]);
        const month = months[monthStr] !== undefined ? months[monthStr] : 0;
        // Use UTC to ensure date stays stable regardless of server timezone
        return new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
    }
    
    // Fallback to current date if parsing fails
    return new Date().toISOString().split('T')[0];
}

export async function scrapeArxiv(fullBackfill = false) {
    const result = { found: 0, added: 0, errors: 0 };
    const MAX_RESULTS = fullBackfill ? 5000 : 200; // Scrape deeper if backfilling
    const BATCH_SIZE = 50; // Match arXiv default page size to avoid overlap
    const CUTOFF_DATE = new Date('2025-01-01');

  // Helper for exponential backoff
  const fetchWithRetry = async (url: string, retries = 5, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await axios.get(url, {
          timeout: 30000, // 30s timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
      } catch (err: any) {
        if (err.response && err.response.status === 429) {
          console.warn(`⚠️ Rate limited (429). Retrying in ${delay/1000}s... (Attempt ${i + 1}/${retries})`);
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
        } else if (err.code === 'ECONNABORTED') {
           console.warn(`⚠️ Request timed out. Retrying in ${delay/1000}s... (Attempt ${i + 1}/${retries})`);
           await new Promise(res => setTimeout(res, delay));
        } else {
          console.error(`Request failed: ${err.message}`);
          throw err;
        }
      }
    }
    throw new Error('Max retries exceeded for arXiv scraping');
  };

  try {
    let shouldContinue = true;

    for (let start = 0; start < MAX_RESULTS && shouldContinue; start += BATCH_SIZE) {
      console.log(`Fetching papers from arXiv (offset ${start})...`);
      const url = `${BASE_ARXIV_URL}&start=${start}`;
      
      const { data } = await fetchWithRetry(url);
      const $ = cheerio.load(data);

      const rawPapers: { title: string; authors: string[]; abstract: string; pdfLink: string; publication_date: string }[] = [];
      let allPapersInBatchAreOld = true;

      $('li.arxiv-result').each((_i, el) => {
        const title = $(el).find('p.title').text().trim();
        const authors = $(el).find('p.authors').text().replace('Authors:', '').trim().split(', ');
        const abstract = $(el).find('span.abstract-full').text().trim().replace('(Less)', '');
        const pdfLink = $(el).find('p.list-title.is-inline-block > span > a').attr('href');
        
        // Extract publication date
        const publishedText = $(el).find('p.is-size-7').text();
        const publication_date = parseDate(publishedText);

        // Check date cutoff
        if (new Date(publication_date) >= CUTOFF_DATE) {
            allPapersInBatchAreOld = false;
        } else {
             // console.log(`Skipping old paper: ${title} (${publication_date})`);
        }

        if (title && authors.length > 0 && abstract && pdfLink) {
          rawPapers.push({
            title,
            authors,
            abstract,
            pdfLink,
            publication_date
          });
        }
      });

      console.log(`Raw papers found on page: ${rawPapers.length}`);
      
      if (allPapersInBatchAreOld && fullBackfill) {
        console.log("All papers in this batch are older than cutoff. Stopping backfill.");
        // Log the dates to see why
        rawPapers.forEach(p => console.log(`  - ${p.title.substring(0, 30)}... : ${p.publication_date}`));
        shouldContinue = false;
      }
      
      const papers: Paper[] = [];
      for (const raw of rawPapers) {
        // Double check date before adding
        if (new Date(raw.publication_date) >= CUTOFF_DATE) {
            // ... classification
            papers.push({
            title: raw.title,
            authors: raw.authors,
            abstract: raw.abstract,
            url: raw.pdfLink,
            publication_date: raw.publication_date,
            // tags will be added later or we can skip classification for speed during debugging?
            // For now let's keep it but handle errors gracefully
            });
        }
      }

      console.log(`Papers to add after date filtering: ${papers.length}`);

      if (papers.length > 0) {
          // Process classification in parallel to speed up? 
          // Or just do it sequentially to avoid rate limits on AI API (if used)
          // We are using rule-based now mostly.
          for (let i = 0; i < papers.length; i++) {
              papers[i].tags = await classifyPaper(papers[i].title, papers[i].abstract);
          }
      }

      if (papers.length === 0 && !shouldContinue) {
        console.log("No papers in this batch and stop signal received.");
        break; 
      }
      
      if (papers.length === 0 && rawPapers.length === 0) {
         console.log('No raw papers found (end of results?).');
         break;
      }
      // If papers.length is 0 but rawPapers.length > 0, it means all were filtered out (old).
      // If we are in backfill mode, we rely on shouldContinue flag.
      // If shouldContinue is true, we keep going even if papers.length is 0.
      if (papers.length === 0 && shouldContinue) {
          console.log("All papers in this batch were filtered out (likely old), but continuing search...");
          // Wait a bit and continue
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
      }

      result.found += papers.length;
      console.log(`Found ${papers.length} papers in this batch. Saving to database...`);

      for (const paper of papers) {
        try {
          await addPaper(paper);
          result.added++;
          // console.log(`Successfully added paper: ${paper.title}`);
        } catch (error) {
          result.errors++;
          console.error(`Failed to add paper: ${paper.title}`, error);
        }
      }
      
      // Be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Scraping finished.', result);
    return result;
  } catch (error) {
    console.error('An error occurred during scraping:', error);
    throw error;
  }
}
