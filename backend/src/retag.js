import { getAllPapers, updatePaperTags, initDatabase } from './database.js';
import { classifyWithAI } from './ai_service.js';
import { classifyPaper } from './classifier.js';

async function retagAllPapers() {
  const forceAll = process.argv.includes('--all');
  const startAt = parseInt(process.argv.find(arg => arg.startsWith('--start='))?.split('=')[1] || '0');
  
  console.log('🚀 Starting AI Re-tagging Process...');
  if (forceAll) console.log('🔔 Force mode enabled: Processing ALL papers.');
  if (startAt > 0) console.log(`⏩ Starting from index: ${startAt}`);
  
  // 1. Initialize DB
  await initDatabase();
  
  // 2. Get all papers
  const papers = await getAllPapers();
  console.log(`Found ${papers.length} papers in database.`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  const DEPRECATED_TAGS = ['World Models', 'Model-Based RL'];

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    const currentIndex = i + 1;

    // Skip if before start index
    if (currentIndex < startAt) {
      skipCount++;
      continue;
    }
    
    // Check if we should skip this paper based on content
    const hasDeprecatedTags = paper.tags && paper.tags.some(t => DEPRECATED_TAGS.includes(t));
    const hasNoTags = !paper.tags || paper.tags.length === 0;
    
    // If not in force mode, skip if paper is already "clean" (has tags and no deprecated ones)
    if (!forceAll && !hasNoTags && !hasDeprecatedTags) {
      // Optional: uncomment to see skipped papers
      // console.log(`[${currentIndex}/${papers.length}] Skipping (already clean): ${paper.title.substring(0, 30)}...`);
      skipCount++;
      continue;
    }

    console.log(`[${currentIndex}/${papers.length}] Processing: ${paper.title}`);
    if (hasDeprecatedTags) console.log(`   Reason: Contains deprecated tags (${paper.tags.filter(t => DEPRECATED_TAGS.includes(t)).join(', ')})`);
    else if (hasNoTags) console.log(`   Reason: No existing tags`);
    else if (forceAll) console.log(`   Reason: Force mode`);
    else if (currentIndex >= startAt) console.log(`   Reason: Start index reached`);
    
    try {
      // 3. Get Rule-based tags first
      const ruleTags = await classifyPaper(paper.title, paper.abstract);
      
      // 4. Call AI to get new high-quality tags
      console.log(`   Calling AI for "${paper.title.substring(0, 30)}..."`);
      const aiTags = await classifyWithAI(paper.title, paper.abstract);
      
      // 5. Combine and deduplicate
      const finalTags = Array.from(new Set([...ruleTags, ...aiTags]));
      
      if (finalTags.length > 0) {
        // 6. Update DB
        await updatePaperTags(paper.id, finalTags);
        console.log(`   ✅ Success! New tags: ${finalTags.join(', ')}`);
        successCount++;
      } else {
        console.log(`   ⚠️ AI & Rules returned no tags. Keeping original or setting empty.`);
        failCount++;
      }
    } catch (error) {
      if (error.message.includes('402')) {
        console.error(`   ❌ AI Service: Insufficient Balance (402). Stopping process.`);
        break;
      }
      console.error(`   ❌ Failed to process paper ${paper.id}:`, error.message);
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n--- Process Completed ---');
  console.log(`Total: ${papers.length}`);
  console.log(`Skipped (already clean): ${skipCount}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  process.exit(0);
}

retagAllPapers();
