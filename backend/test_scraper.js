
import axios from 'axios';

async function testScrape() {
  try {
    console.log('Triggering scraper...');
    const response = await axios.post('http://localhost:3001/api/scrape');
    console.log('Scraper response:', response.data);
  } catch (error) {
    console.error('Error triggering scraper:', error.response ? error.response.data : error.message);
  }
}

testScrape();
