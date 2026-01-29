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
  // Regex to match "originally announced Month Year"
  const match = dateText.match(/originally announced (\w+) (\d{4})/);
  if (match) {
      const monthStr = match[1];
      const year = parseInt(match[2]);
      const months: {[key: string]: number} = {
          'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
          'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
      };
      const month = months[monthStr] !== undefined ? months[monthStr] : 0;
      // Use UTC to ensure date stays stable regardless of server timezone
      return new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
  }
  // Fallback to current date if parsing fails
  return new Date().toISOString().split('T')[0];
}

export async function scrapeArxiv() {
  const result = { found: 0, added: 0, errors: 0 };
  const MAX_RESULTS = 200; // Scrape up to 200 papers
  const BATCH_SIZE = 50;

  try {
    for (let start = 0; start < MAX_RESULTS; start += BATCH_SIZE) {
      console.log(`Fetching papers from arXiv (offset ${start})...`);
      const url = `${BASE_ARXIV_URL}&start=${start}`;
      
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(data);

      const papers: Paper[] = [];

      $('li.arxiv-result').each((_i, el) => {
        const title = $(el).find('p.title').text().trim();
        const authors = $(el).find('p.authors').text().replace('Authors:', '').trim().split(', ');
        const abstract = $(el).find('span.abstract-full').text().trim().replace('(Less)', '');
        const pdfLink = $(el).find('p.list-title.is-inline-block > span > a').attr('href');
        
        // Extract publication date
        const publishedText = $(el).find('p.is-size-7').text();
        const publication_date = parseDate(publishedText);

        if (title && authors.length > 0 && abstract && pdfLink) {
          const tags = classifyPaper(title, abstract);
          papers.push({
            title,
            authors,
            abstract,
            url: pdfLink,
            publication_date,
            tags
          });
        }
      });

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
