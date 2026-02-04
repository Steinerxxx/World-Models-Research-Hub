import { classifyWithAI } from './ai_service.js';

const TAXONOMY = [
  {
    tag: 'World Models',
    strongKeywords: [
      'world model', 'dreamer', 'daydreamer', 'genie', 'diamond', 'iris', 
      'latent dynamics', 'predictive state representation', 'decision transformer'
    ],
    weakKeywords: [
      'model-based', 'mbrl', 'predict future', 'imagination'
    ]
  },
  {
    tag: 'Model-Based RL',
    strongKeywords: [
      'model-based reinforcement learning', 'mbrl', 'dreamer', 'muzero', 'alphazero', 
      'planet', 'simpla', 'td-mpc'
    ],
    weakKeywords: [
      'model-based', 'planning in latent space'
    ]
  },
  {
    tag: 'Reinforcement Learning',
    strongKeywords: [
      'reinforcement learning', 'deep rl', 'policy gradient', 'q-learning', 
      'actor-critic', 'ppo', 'sac', 'td3', 'ddpg', 'dqn', 'muzero', 'dreamer'
    ],
    weakKeywords: [
      'reward function', 'bellman', 'temporal difference', 'off-policy', 'on-policy', 
      'exploration', 'exploitation', 'markov decision process'
    ]
  },
  {
    tag: 'Generative Models',
    strongKeywords: [
      'generative model', 'gan', 'vae', 'diffusion model', 'flow matching', 
      'consistency model', 'score-based generative', 'image generation', 
      'video generation', 'sora', 'veo', 'latent diffusion'
    ],
    weakKeywords: [
      'denoising', 'autoregressive', 'synthesis'
    ]
  },
  {
    tag: 'Video Prediction',
    strongKeywords: [
      'video prediction', 'future frame prediction', 'video generation', 
      'next-frame prediction', 'spatiotemporal prediction', 'dynamics model'
    ],
    weakKeywords: [
      'predict next frame', 'temporal consistency'
    ]
  },
  {
    tag: 'Robotics',
    strongKeywords: [
      'robotics', 'robot', 'manipulation', 'locomotion', 'sim-to-real', 
      'imitation learning', 'behavior cloning', 'dexterous', 'mobile manipulator'
    ],
    weakKeywords: [
      'control', 'actuator', 'grasping', 'trajectory'
    ]
  },
  {
    tag: 'Planning',
    strongKeywords: [
      'trajectory optimization', 'monte carlo tree search', 'mcts', 
      'rapidly-exploring random tree', 'rrt', 'path planning', 'motion planning'
    ],
    weakKeywords: [
      'planning', 'tree search', 'search algorithm'
    ]
  },
  {
    tag: 'Representation Learning',
    strongKeywords: [
      'representation learning', 'contrastive learning', 'self-supervised learning', 
      'masked autoencoder', 'jepa', 'disentangled representation', 'latent space'
    ],
    weakKeywords: [
      'embedding', 'feature extraction', 'unsupervised'
    ]
  },
  {
    tag: 'Transformers',
    strongKeywords: [
      'transformer', 'attention mechanism', 'self-attention', 'vision transformer', 
      'vit', 'gpt', 'bert', 'large language model'
    ],
    weakKeywords: []
  },
  {
    tag: 'Diffusion Models',
    strongKeywords: [
      'diffusion model', 'ddpm', 'ddim', 'score-based', 'latent diffusion'
    ],
    weakKeywords: [
      'diffusion process', 'denoising'
    ]
  },
  {
    tag: 'State Space Models',
    strongKeywords: [
      'state space model', 'ssm', 'mamba', 's4', 'structured state space', 'linear recurrent unit'
    ],
    weakKeywords: []
  }
];

export async function classifyPaper(title, abstract) {
  const text = (title + " " + abstract).toLowerCase();
  const tags = new Set();

  // 1. Rule-Based Classification
  TAXONOMY.forEach(rule => {
    let match = false;

    // Check strong keywords
    if (rule.strongKeywords.some(k => text.includes(k.toLowerCase()))) {
      match = true;
    }
    
    // Check weak keywords (only if no strong match yet)
    if (!match && rule.weakKeywords.length > 0) {
      if (rule.weakKeywords.some(k => text.includes(k.toLowerCase()))) {
        match = true;
      }
    }

    // Check excludes
    if (rule.excludes && rule.excludes.some(k => text.includes(k.toLowerCase()))) {
      match = false;
    }

    if (match) {
      tags.add(rule.tag);
    }
  });

  // 2. Implied Tags (Hierarchy logic)
  if (tags.has('World Models')) {
    tags.add('Model-Based RL'); // World Models are a subset of MBRL (mostly)
    tags.add('Generative Models'); // Usually involve generative components
  }
  if (tags.has('Model-Based RL')) {
    tags.add('Reinforcement Learning');
  }
  if (tags.has('Diffusion Models')) {
    tags.add('Generative Models');
  }
  if (tags.has('Video Prediction')) {
    tags.add('Generative Models');
  }

  // 3. AI-Based Classification (Enhancement)
  // Only attempt if we missed obvious categories or if we want extra precision.
  // We wrap in try-catch to ensure the rule-based tags are always returned even if AI fails.
  try {
    // Only call AI if configured (checked inside the service)
    const aiTags = await classifyWithAI(title, abstract);
    if (aiTags && aiTags.length > 0) {
      aiTags.forEach(tag => tags.add(tag));
    }
  } catch (error) {
    // Silent fail for AI, we rely on rules
    // console.error("AI Classification skipped/failed");
  }

  return Array.from(tags);
}
