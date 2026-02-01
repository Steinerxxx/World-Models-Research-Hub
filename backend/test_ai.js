
import { classifyWithAI } from './dist/ai_service.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAI() {
  console.log('Testing AI Service...');
  const title = "DreamerV3: Mastering Diverse Domains through World Models";
  const abstract = "We present DreamerV3, a general and scalable algorithm that masters a wide range of domains with fixed hyperparameters. DreamerV3 learns a world model from experience and uses it to train an actor-critic policy from imagined trajectories.";
  
  console.log(`Title: ${title}`);
  console.log('---');
  
  const start = Date.now();
  const tags = await classifyWithAI(title, abstract);
  const duration = (Date.now() - start) / 1000;
  
  console.log(`Duration: ${duration}s`);
  console.log('Tags:', tags);
}

testAI();
