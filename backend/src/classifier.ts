
export function classifyPaper(title: string, abstract: string): string[] {
  const text = (title + " " + abstract).toLowerCase();
  const tags: Set<string> = new Set();

  // --- Subject Categories ---

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
    text.includes('attention') || 
    text.includes('vit') || 
    text.includes('gpt') ||
    text.includes('bert') ||
    text.includes('llama')
  ) {
    tags.add('Transformer');
  }

  if (
    text.includes('diffusion model') || 
    text.includes('score-based') || 
    text.includes('denoising') ||
    text.includes('ddpm') ||
    text.includes('latent diffusion')
  ) {
    tags.add('Diffusion');
  }

  if (
    text.includes('rnn') || 
    text.includes('lstm') || 
    text.includes('gru') || 
    text.includes('recurrent neural network')
  ) {
    tags.add('RNN');
  }

  if (
    text.includes('state space model') || 
    text.includes('ssm') || 
    text.includes('mamba') || 
    text.includes('s4') ||
    text.includes('rwkv')
  ) {
    tags.add('State Space Models');
  }
  
  // Default tag if none found
  if (tags.size === 0) {
      tags.add('Uncategorized');
  }

  return Array.from(tags);
}
