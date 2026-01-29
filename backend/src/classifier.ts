
export function classifyPaper(title: string, abstract: string): string[] {
  const text = (title + " " + abstract).toLowerCase();
  const tags: Set<string> = new Set();

  // Subject Categories
  if (text.includes('reinforcement learning') || text.includes('rl') || text.includes('policy gradient') || text.includes('q-learning') || text.includes('actor-critic')) {
    tags.add('Reinforcement Learning');
  }
  if (text.includes('generative model') || text.includes('gan') || text.includes('vae') || text.includes('diffusion') || text.includes('image generation')) {
    tags.add('Generative Models');
  }
  if (text.includes('video prediction') || text.includes('future frame') || text.includes('dynamics model') || text.includes('world model')) {
    tags.add('World Models'); // "World Model" itself is a key category
  }
  if (text.includes('video prediction') || text.includes('predict next frame')) {
    tags.add('Video Prediction');
  }
  if (text.includes('robotics') || text.includes('robot') || text.includes('control') || text.includes('manipulation')) {
    tags.add('Robotics');
  }
  if (text.includes('planning') || text.includes('mcts') || text.includes('tree search')) {
    tags.add('Planning');
  }

  // Architecture Categories
  if (text.includes('transformer') || text.includes('attention') || text.includes('vit') || text.includes('gpt')) {
    tags.add('Transformer');
  }
  if (text.includes('diffusion model') || text.includes('score-based') || text.includes('denoising')) {
    tags.add('Diffusion');
  }
  if (text.includes('rnn') || text.includes('lstm') || text.includes('gru') || text.includes('recurrent neural network')) {
    tags.add('RNN');
  }
  if (text.includes('state space model') || text.includes('ssm') || text.includes('mamba') || text.includes('s4')) {
    tags.add('State Space Models');
  }
  
  // Default tag if none found, but "World Models" usually covers it if searched
  if (tags.size === 0) {
      tags.add('Uncategorized');
  }

  return Array.from(tags);
}
