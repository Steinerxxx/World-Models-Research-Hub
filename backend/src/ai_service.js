import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

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

/**
 * Combined function to check relevance and classify a paper in a single AI call.
 * This is significantly faster than calling two separate functions.
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

Task 2: If relevant, classify the paper into categories (e.g., Robotics, Planning, Transformers, Diffusion Models, Sim-to-Real, RNN, State Space Models, Offline RL, Safe RL).

Return ONLY a JSON object:
{
  "isRelevant": boolean,
  "tags": string[] (empty if not relevant)
}
DO NOT include "World Models" or "Model-Based RL" in tags.
    `;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs strict JSON objects.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
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
Choose from the following list of tags (you can select multiple, but only if they are strongly relevant):
- Reinforcement Learning
- Generative Models
- Video Prediction
- Robotics
- Planning
- Representation Learning
- Transformers
- Diffusion Models
- Sim-to-Real
- RNN
- State Space Models

Instructions:
1. DO NOT include "World Models" or "Model-Based RL" as tags, as they are implied by the context of this platform.
2. Focus on more specific sub-fields (e.g., "Robotics", "Planning", "Video Prediction").
3. You may generate new, specific tags if they are significant (e.g., "Offline RL", "Safe RL").
4. Return ONLY a JSON array of strings. Do not include any other text or markdown formatting.

Example Output:
["Robotics", "Planning", "Representation Learning"]
    `;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs strict JSON arrays.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) return [];

    // Clean up potential markdown code blocks (e.g., ```json ... ```)
    const jsonStr = content.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

    try {
      const tags = JSON.parse(jsonStr);
      if (Array.isArray(tags)) {
        return tags;
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
    }

    return [];
  } catch (error) {
    if (error.status === 402) {
      // Silent warning for balance issues to avoid log spam
      return [];
    }
    console.error('Error calling AI service for classification:', error);
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
