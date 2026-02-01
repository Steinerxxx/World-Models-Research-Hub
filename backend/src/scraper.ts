import axios from 'axios';
import * as cheerio from 'cheerio';
import { addPaper } from './database.js';
import { classifyPaper } from './classifier.js';

const BASE_ARXIV_URL = 'https://arxiv.org/search/?query="World+Models"&searchtype=all&source=header';

interface Paper {
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  publication_date: string; 
  tags?: string[];
}

function parseDate(dateText: string): string {
  const months: {[key: string]: number} = {
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
  const MAX_RESULTS = fullBackfill ? 2000 : 200; // Scrape deeper if backfilling
  const BATCH_SIZE = 25; // Reduced from 50 to avoid timeouts/rate-limits
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
      let foundOldPaper = false;

      $('li.arxiv-result').each((_i, el) => {
        const title = $(el).find('p.title').text().trim();
        const authors = $(el).find('p.authors').text().replace('Authors:', '').trim().split(', ');
        const abstract = $(el).find('span.abstract-full').text().trim().replace('(Less)', '');
        const pdfLink = $(el).find('p.list-title.is-inline-block > span > a').attr('href');
        
        // Extract publication date
        const publishedText = $(el).find('p.is-size-7').text();
        const publication_date = parseDate(publishedText);

        // Check date cutoff
        if (new Date(publication_date) < CUTOFF_DATE) {
            foundOldPaper = true;
            // Don't stop immediately inside the loop, just don't add it if we want strict filtering.
            // But usually we just want to stop fetching *next* pages.
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

      if (foundOldPaper && !fullBackfill) {
        // If we found an old paper and we are NOT doing a full backfill (just normal hourly scrape),
        // we can probably stop, assuming results are sorted by date.
        // But arXiv search results might not be perfectly strict, so let's just use the flag to stop *next* batch.
        // Actually, if we are sorted by date descending, once we hit < 2025, all subsequent papers are old.
        shouldContinue = false;
      }

      // If we are doing a full backfill, we want to keep going until we are SURE we passed Jan 2025.
      if (foundOldPaper && fullBackfill) {
         // If we see papers older than 2025, we can stop fetching more pages.
         shouldContinue = false;
      }
      
      const papers: Paper[] = [];
      for (const raw of rawPapers) {
        // Double check date before adding
        if (new Date(raw.publication_date) >= CUTOFF_DATE) {
            const tags = await classifyPaper(raw.title, raw.abstract);
            papers.push({
            title: raw.title,
            authors: raw.authors,
            abstract: raw.abstract,
            url: raw.pdfLink,
            publication_date: raw.publication_date,
            tags
            });
        }
      }

      if (papers.length === 0 && !shouldContinue) {
        break; 
      }
      
      if (papers.length === 0) {
         console.log('No more papers found.');
         break;
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
