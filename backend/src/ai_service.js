import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load from root or backend directory
dotenv.config(); // Default (root if run from root)
dotenv.config({ path: path.join(__dirname, '../.env') }); // backend/.env

const apiKey = process.env.AI_API_KEY;
const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const modelName = process.env.AI_MODEL_NAME || 'deepseek-chat';

if (!apiKey) {
  console.warn('AI_API_KEY is not set. AI features will be disabled.');
}

const openai = apiKey ? new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
}) : null;

export async function generatePaperAnalysis(title, abstract) {
  if (!openai) {
    return null;
  }

  try {
    const prompt = `
You are an expert academic researcher in Artificial Intelligence.
Analyze the following research paper:
Title: "${title}"
Abstract: "${abstract}"

Provide a structured summary with the following fields:
1. summary: A concise one-sentence summary of the paper's core idea.
2. contribution: A short paragraph explaining the key innovation or contribution.
3. limitations: A short paragraph mentioning potential limitations or future work (if inferred from context, otherwise say "Not explicitly stated").

Return ONLY a JSON object with keys: "summary", "contribution", "limitations".
Do not include any other text or markdown formatting.
    `;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs strict JSON objects.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) return null;

    const jsonStr = content.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

    try {
      const result = JSON.parse(jsonStr);
      if (result.summary && result.contribution) {
        return {
          summary: result.summary,
          contribution: result.contribution,
          limitations: result.limitations || "Not explicitly stated"
        };
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
    }
  } catch (error) {
    if (error.status === 402) {
      console.warn('⚠️ AI Service: Insufficient Balance (402). Skipping AI analysis.');
      return null;
    }
    console.error('Error calling AI service for summary:', error);
    return null;
  }
}

const ALLOWED_TAGS = [
  'Reinforcement Learning', 
  'Generative Models', 
  'Video Prediction', 
  'Robotics', 
  'Sim-to-Real',
  'Planning', 
  'Representation Learning',
  'Transformers', 
  'Diffusion Models', 
  'RNN', 
  'State Space Models'
];

/**
 * Task 1: Check relevance to World Models / MBRL
 * Task 2: Classify into specific categories
 */
export async function processPaperWithAI(title, abstract) {
  if (!openai) {
    return { isRelevant: true, tags: [] };
  }

  try {
    const prompt = `
You are an expert academic researcher. Analyze the following paper:
Title: "${title}"
Abstract: "${abstract}"

Task 1: Determine if this paper is relevant to "World Models" or "Model-Based Reinforcement Learning" (MBRL).
Relevant topics: dynamics models, planning/policy training with learned models, environment generative models, representation learning for world modeling.

Task 2: If relevant, classify the paper into categories. 
1. STICK TO this CORE list as much as possible: ${ALLOWED_TAGS.join(', ')}.
2. You MAY generate ONE (at most) highly specific "Discovery Tag" ONLY if the paper introduces a significant new concept not covered by the core list.
3. If you generate a Discovery Tag, use Title Case (e.g., "Offline RL", not "offline rl").
4. Avoid generic tags like "Machine Learning", "AI", "Neural Networks".
5. Return 2-4 tags in total.

Return ONLY a JSON object:
{
  "isRelevant": boolean,
  "tags": string[]
}
DO NOT include "World Models" or "Model-Based RL" in tags.
    `;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs strict JSON objects. You combine core categories with discovery tags.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 150,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) return { isRelevant: false, tags: [] };

    const jsonStr = content.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    const result = JSON.parse(jsonStr);
    
    return {
      isRelevant: !!result.isRelevant,
      tags: Array.isArray(result.tags) ? result.tags : []
    };
  } catch (error) {
    if (error.status === 402) return { isRelevant: true, tags: [] };
    console.error('Error in processPaperWithAI:', error);
    return { isRelevant: true, tags: [] };
  }
}

export async function classifyWithAI(title, abstract) {
  if (!openai) {
    return [];
  }

  try {
    const prompt = `
You are an expert academic researcher in Artificial Intelligence, specializing in World Models, Model-Based Reinforcement Learning (MBRL), and Generative AI.

Analyze the following research paper:
Title: "${title}"
Abstract: "${abstract}"

Your task is to classify this paper into relevant categories.
1. Primary Source: Select from this core list: ${ALLOWED_TAGS.join(', ')}.
2. Secondary Source: You may generate ONE highly specific tag ONLY if the paper introduces a major new concept (e.g., "Offline RL", "Safe RL").
3. Constraints:
   - Total tags: 2-4.
   - Use Title Case.
   - NO "World Models" or "Model-Based RL".
   - NO generic tags like "AI" or "Research".

Return ONLY a JSON array of strings.
    `;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs strict JSON arrays.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Slightly higher for better discovery
      max_tokens: 100,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) return [];

    const jsonStr = content.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    const result = JSON.parse(jsonStr);
    
    if (!Array.isArray(result)) return [];
    return result;
  } catch (error) {
    if (error.status === 402) return [];
    console.error('Error in classifyWithAI:', error);
    return [];
  }
}

/**
 * Checks if a paper is relevant to World Models or Model-Based RL
 * @returns {Promise<boolean>}
 */
export async function checkRelevanceWithAI(title, abstract) {
  if (!openai) {
    return true; // Default to true if AI is disabled to avoid missing papers
  }

  try {
    const prompt = `
You are an expert academic reviewer. Determine if the following paper is relevant to the fields of "World Models" or "Model-Based Reinforcement Learning" (MBRL).

Relevant topics include:
- Learning a predictive model of the environment (dynamics model).
- Using a learned model for planning or policy training (e.g., Dreamer, PlaNet).
- Generative models of environments (video prediction for RL).
- Representation learning for world modeling.

Irrelevant topics include:
- Pure computer vision (unless applied to world modeling).
- Traditional model-free RL (unless compared significantly with MBRL).
- Generic deep learning without a focus on modeling environment dynamics.

Title: "${title}"
Abstract: "${abstract}"

Return ONLY a JSON object with a single key "is_relevant" (boolean).
    `;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a strict filtering assistant that outputs JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 50,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) return true;

    const jsonStr = content.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
    const result = JSON.parse(jsonStr);
    return !!result.is_relevant;
  } catch (error) {
    console.error('Error checking relevance with AI:', error);
    return true; // Fallback to true on error
  }
}
