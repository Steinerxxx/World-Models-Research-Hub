import { getAllPapers, updatePaperTags, initDatabase } from './database.js';
import { classifyWithAI } from './ai_service.js';

async function retagAllPapers() {
  console.log('🚀 Starting AI Re-tagging Process...');
  
  // 1. Initialize DB
  await initDatabase();
  
  // 2. Get all papers
  const papers = await getAllPapers();
  console.log(`Found ${papers.length} papers to process.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    console.log(`[${i + 1}/${papers.length}] Processing: ${paper.title}`);
    
    try {
      // 3. Call AI to get new tags
      console.log(`   Calling AI for "${paper.title.substring(0, 30)}..."`);
      const newTags = await classifyWithAI(paper.title, paper.abstract);
      
      if (newTags && newTags.length > 0) {
        // 4. Update DB
        await updatePaperTags(paper.id, newTags);
        console.log(`   ✅ Success! New tags: ${newTags.join(', ')}`);
        successCount++;
      } else {
        console.log(`   ⚠️ AI returned no tags for this paper. Keeping original tags.`);
        failCount++;
      }
    } catch (error) {
      if (error.message.includes('402')) {
        console.error(`   ❌ AI Service: Insufficient Balance (402). Stopping process to save state.`);
        break;
      }
      console.error(`   ❌ Failed to process paper ${paper.id}:`, error.message);
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n--- Process Completed ---');
  console.log(`Total: ${papers.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  process.exit(0);
}

retagAllPapers();
