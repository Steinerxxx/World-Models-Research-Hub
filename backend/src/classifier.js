import { classifyWithAI } from './ai_service.js';

const TAXONOMY = [
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
      'robotics', 'robot', 'manipulation', 'locomotion', 
      'imitation learning', 'behavior cloning', 'dexterous', 'mobile manipulator'
    ],
    weakKeywords: [
      'control', 'actuator', 'grasping', 'trajectory'
    ]
  },
  {
    tag: 'Sim-to-Real',
    strongKeywords: [
      'sim-to-real', 'simulation-to-real', 'domain randomization', 'system identification'
    ],
    weakKeywords: [
      'reality gap', 'transfer learning to robots'
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
  },
  {
    tag: 'Active Inference',
    strongKeywords: ['active inference', 'free energy principle', 'friston'],
    weakKeywords: ['variational free energy']
  },
  {
    tag: 'Offline RL',
    strongKeywords: ['offline reinforcement learning', 'offline rl', 'batch rl', 'conservative q-learning', 'cql'],
    weakKeywords: ['dataset-based rl']
  },
  {
    tag: 'Decision Transformers',
    strongKeywords: ['decision transformer', 'trajectory transformer', 'sequence modeling for rl'],
    weakKeywords: []
  },
  {
    tag: 'World Models',
    strongKeywords: ['world model', 'dreamer', 'genie', 'latent dynamics', 'world modeling'],
    weakKeywords: ['imagination', 'model-based']
  },
  {
    tag: 'Model-Based RL',
    strongKeywords: ['model-based reinforcement learning', 'mbrl', 'muzero', 'dyna-q'],
    weakKeywords: ['planning in latent space']
  },
  {
    tag: 'RNN',
    strongKeywords: ['recurrent neural network', 'rnn', 'lstm', 'gru', 'backpropagation through time'],
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
