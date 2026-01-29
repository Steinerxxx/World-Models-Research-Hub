import axios from 'axios';
import * as cheerio from 'cheerio';
import { addPaper } from './database.js';
import { classifyPaper } from './classifier.js';

const ARXIV_URL = 'https://arxiv.org/search/?query="World+Models"&searchtype=all&source=header';

interface Paper {
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  publication_date: string; 
  tags?: string[];
}

export async function scrapeArxiv() {
  const result = { found: 0, added: 0, errors: 0 };
  try {
    console.log('Fetching papers from arXiv...');
    const { data } = await axios.get(ARXIV_URL);
    const $ = cheerio.load(data);

    const papers: Paper[] = [];

    $('li.arxiv-result').each((_i, el) => {
      const title = $(el).find('p.title').text().trim();
      const authors = $(el).find('p.authors').text().replace('Authors:', '').trim().split(', ');
      const abstract = $(el).find('span.abstract-full').text().trim().replace('(Less)', '');
      const pdfLink = $(el).find('p.list-title.is-inline-block > span > a').attr('href');
      
      // Extract publication date
      const publishedText = $(el).find('p.is-size-7').text();
      const dateMatch = publishedText.match(/originally announced (\w+ \d{4})/);
      const publication_date = dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];


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

    result.found = papers.length;
    console.log(`Found ${papers.length} papers. Saving to database...`);

    for (const paper of papers) {
      try {
        await addPaper(paper);
        result.added++;
        console.log(`Successfully added paper: ${paper.title} with tags: ${paper.tags?.join(', ')}`);
      } catch (error) {
        result.errors++;
        console.error(`Failed to add paper: ${paper.title}`, error);
      }
    }

    console.log('Scraping finished.');
    return result;
  } catch (error) {
    console.error('An error occurred during scraping:', error);
    throw error;
  }
}

