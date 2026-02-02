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

export async function classifyWithAI(title: string, abstract: string): Promise<string[]> {
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
- World Models
- Model-Based RL
- Reinforcement Learning
- Generative Models
- Video Prediction
- Robotics
- Planning
- Representation Learning
- Transformers
- Diffusion Models
- Sim-to-Real

Instructions:
1. If the paper is about World Models or Dreamer-like architectures, MUST include "World Models".
2. If it involves reinforcement learning with a learned model, MUST include "Model-Based RL".
3. Return ONLY a JSON array of strings. Do not include any other text or markdown formatting.

Example Output:
["World Models", "Model-Based RL", "Robotics"]
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
    console.error('Error calling AI service:', error);
    return [];
  }
}
