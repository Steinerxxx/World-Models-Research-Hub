import axios from 'axios';
import * as cheerio from 'cheerio';
import { addPaper } from './database.js';

const ARXIV_URL = 'https://arxiv.org/search/?query="World+Models"&searchtype=all&source=header';

interface Paper {
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  publication_date: string; 
}

async function scrapeArxiv(): Promise<void> {
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
        papers.push({
          title,
          authors,
          abstract,
          url: pdfLink,
          publication_date
        });
      }
    });

    console.log(`Found ${papers.length} papers. Saving to database...`);

    for (const paper of papers) {
      try {
        await addPaper(paper);
        console.log(`Successfully added paper: ${paper.title}`);
      } catch (error) {
        console.error(`Failed to add paper: ${paper.title}`, error);
      }
    }

    console.log('Scraping finished.');
  } catch (error) {
    console.error('An error occurred during scraping:', error);
  }
}

scrapeArxiv();
