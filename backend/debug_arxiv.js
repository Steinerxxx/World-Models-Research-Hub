
import axios from 'axios';
import * as cheerio from 'cheerio';

async function checkArxivHtml() {
  const url = 'https://arxiv.org/search/?query="World+Models"&searchtype=all&source=header&start=0';
  console.log(`Fetching ${url}...`);
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    
    $('li.arxiv-result').each((i, el) => {
      if (i < 5) {
        const title = $(el).find('p.title').text().trim();
        const dateText = $(el).find('p.is-size-7').text().trim();
        console.log(`\nPaper ${i+1}:`);
        console.log(`Title: ${title}`);
        console.log(`Date Text Raw: "${dateText}"`);
      }
    });
  } catch (error) {
    console.error(error);
  }
}

checkArxivHtml();
