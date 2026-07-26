import cron from 'node-cron';
import { scrapeArxiv } from '../scraper.js';
import { indexPaperEmbeddings } from '../vector_service.js';

let scheduledTask = null;

export function startScrapeScheduler() {
  if (scheduledTask) {
    return scheduledTask;
  }

  console.log('⏰ Scheduling hourly crawler (0 * * * *)...');
  scheduledTask = cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running scheduled hourly crawler...');
    try {
      const result = await scrapeArxiv(false);
      console.log('✅ Scheduled crawler finished:', result);

      if (result.added > 0) {
        console.log(`🔄 Auto-indexing embeddings for ${result.added} new papers...`);
        const embedResult = await indexPaperEmbeddings({});
        console.log('✅ Auto-embedding done:', embedResult);
      }
    } catch (err) {
      console.error('❌ Scheduled crawler failed:', err);
    }
  });

  return scheduledTask;
}
