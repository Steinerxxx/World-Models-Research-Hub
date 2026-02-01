
import { classifyPaper } from './dist/classifier.js';

async function test() {
  console.log('Testing classifyPaper with potential AI failure...');
  
  const title = "DreamerV3: Mastering Diverse Domains through World Models";
  const abstract = "We introduce DreamerV3, a general and scalable algorithm that masters a wide range of domains with fixed hyperparameters. DreamerV3 learns a world model from experience and uses it to train an actor-critic policy from imagined trajectories.";

  try {
    const tags = await classifyPaper(title, abstract);
    console.log('Success! Tags:', tags);
    
    if (tags.includes('World Models')) {
      console.log('PASS: "World Models" tag found (likely from rules).');
    } else {
      console.log('FAIL: "World Models" tag missing.');
    }

  } catch (error) {
    console.error('FAIL: classifyPaper threw an error:', error);
  }
}

test();
