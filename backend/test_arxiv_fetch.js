
const axios = require('axios');
const fs = require('fs');

async function test() {
  const url = 'https://arxiv.org/search/?query="World+Models"&searchtype=all&source=header&order=-announced_date_first&start=0';
  console.log('Fetching:', url);
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    console.log('Data length:', res.data.length);
    fs.writeFileSync('test_arxiv.html', res.data);
  } catch (e) {
    console.error('Error:', e.message);
    if (e.response) console.error('Status:', e.response.status);
  }
}
test();
