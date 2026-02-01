import { classifyWithAI } from './ai_service.js';

export async function classifyPaper(title: string, abstract: string): Promise<string[]> {
  const text = (title + " " + abstract).toLowerCase();
  const tags: Set<string> = new Set();

  // --- 1. Rule-Based Classification (Fast & Cheap) ---

  // World Models & Model-Based RL (Primary Focus)
  if (
    text.includes('world model') || 
    text.includes('dreamer') || 
    text.includes('daydreamer') || 
    text.includes('genie') || 
    text.includes('diamond') ||
    text.includes('iris') ||
    (text.includes('model-based') && (text.includes('rl') || text.includes('reinforcement'))) ||
    text.includes('mbrl') ||
    text.includes('muzero') ||
    text.includes('alphazero')
  ) {
    tags.add('World Models');
    tags.add('Model-Based RL');
  }

  // Reinforcement Learning (General)
  if (
    tags.has('Model-Based RL') || // If it's MBRL, it's also RL
    text.includes('reinforcement learning') || 
    text.includes(' deep rl ') || 
    text.includes('policy gradient') || 
    text.includes('q-learning') || 
    text.includes('actor-critic') ||
    text.includes('ppo') ||
    text.includes('sac')
  ) {
    tags.add('Reinforcement Learning');
  }

  // Generative Models & Video
  if (
    text.includes('generative model') || 
    text.includes('gan') || 
    text.includes('vae') || 
    text.includes('diffusion') || 
    text.includes('image generation') ||
    text.includes('video generation') ||
    text.includes('sora')
  ) {
    tags.add('Generative Models');
  }

  if (
    text.includes('video prediction') || 
    text.includes('future frame') || 
    text.includes('dynamics model') || 
    text.includes('predict next frame') ||
    text.includes('video generation')
  ) {
    tags.add('Video Prediction');
  }

  // Robotics & Control
  if (
    text.includes('robotics') || 
    text.includes('robot') || 
    text.includes('control') || 
    text.includes('manipulation') ||
    text.includes('locomotion') ||
    text.includes('sim-to-real')
  ) {
    tags.add('Robotics');
  }

  // Planning & Search
  if (
    text.includes('planning') || 
    text.includes('mcts') || 
    text.includes('tree search') ||
    text.includes('path finding')
  ) {
    tags.add('Planning');
  }

  // Representation Learning
  if (
    text.includes('representation learning') ||
    text.includes('latent space') ||
    text.includes('disentanglement') ||
    text.includes('self-supervised') ||
    text.includes('contrastive') ||
    text.includes('masked autoencoder') ||
    text.includes('jepa')
  ) {
    tags.add('Representation Learning');
  }

  // --- Architecture Categories ---
  if (
    text.includes('transformer') || 
    text.includes('attention mechanism') ||
    text.includes('gpt')
  ) {
    tags.add('Transformers');
  }

  if (
    text.includes('diffusion model') ||
    text.includes('score-based') ||
    text.includes('denoising')
  ) {
    tags.add('Diffusion Models');
  }

  // --- 2. AI-Based Classification (Enhancement) ---
  // If we have very few tags, or specific complex categories, let's ask AI.
  // For now, let's ALWAYS ask AI to enrich the tags, but merge them with our rule-based ones.
  // To save costs/time, you might only want to call this if tags.size === 0
  
  try {
    const aiTags = await classifyWithAI(title, abstract);
    aiTags.forEach(tag => tags.add(tag));
  } catch (error) {
    console.error("AI Classification failed, falling back to rules only:", error);
  }

  return Array.from(tags);
}
