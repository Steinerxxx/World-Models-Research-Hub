import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { extractKeywords, stripQueryWrappers } from './stopwords.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load from root or backend directory
dotenv.config(); // Default (root if run from root)
dotenv.config({ path: path.join(__dirname, '../.env') }); // backend/.env

const apiKey = process.env.AI_API_KEY;
const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const defaultModelName = process.env.AI_MODEL_NAME || 'deepseek-chat';
const searchModelName = process.env.AI_SEARCH_MODEL_NAME || 'deepseek-v4-pro';

if (!apiKey) {
  console.warn('AI_API_KEY is not set. AI features will be disabled.');
}

const openai = apiKey ? new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
}) : null;

function extractJsonObject(text) {
  const cleaned = text.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in AI response');
  }

  return cleaned.slice(start, end + 1);
}

function buildFallbackSearchIntent(query, explanation) {
  const stripped = stripQueryWrappers(query);
  const keywords = extractKeywords(stripped);

  return {
    query,
    intent: 'search',
    rewrittenQuery: stripped || query,
    filters: {},
    keywords,
    focusAreas: keywords.slice(0, 4),
    excludeTerms: [],
    timePreference: 'balanced',
    explanation
  };
}

function normalizeSearchIntent(query, result) {
  return {
    query,
    intent: 'search',
    rewrittenQuery: result.rewrittenQuery || query,
    filters: {
      tag: result.filters?.tag || undefined,
      author: result.filters?.author || undefined,
      year: result.filters?.year || undefined
    },
    keywords: Array.isArray(result.keywords) ? result.keywords.filter(Boolean) : [],
    focusAreas: Array.isArray(result.focusAreas) ? result.focusAreas.filter(Boolean).slice(0, 4) : [],
    excludeTerms: Array.isArray(result.excludeTerms) ? result.excludeTerms.filter(Boolean).slice(0, 6) : [],
    timePreference: result.timePreference === 'recent' || result.timePreference === 'classic' ? result.timePreference : 'balanced',
    explanation: result.explanation || 'AI parsed the query into semantic intent and optional filters.'
  };
}

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
      model: defaultModelName,
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
  'State Space Models',
  'Offline RL',
  'Multi-Agent Systems',
  'Safe RL',
  'Active Inference'
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
1. MANDATORY: Choose at least 2 and at most 3 tags from this CORE list: ${ALLOWED_TAGS.join(', ')}.
2. OPTIONAL: You may generate EXACTLY ONE highly specific "Discovery Tag" ONLY if the paper introduces a significant new concept not covered by the core list.
3. STRICT NEGATIVE CONSTRAINTS:
   - NO "World Models", "Model-Based RL", "MBRL", "AI", "Machine Learning", "Neural Networks", "Deep Learning", "Research", "Paper".
   - NO duplicate or near-duplicate tags.
   - NO tags longer than 3 words.
4. FORMATTING: Use Title Case (e.g., "Offline RL", not "offline rl").

Return ONLY a JSON object:
{
  "isRelevant": boolean,
  "tags": string[]
}
    `;

    const response = await openai.chat.completions.create({
      model: defaultModelName,
      messages: [
        { role: 'system', content: 'You are a strict academic classifier that outputs ONLY JSON. You follow negative constraints religiously.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const choice = response.choices[0];
    let content = choice.message.content?.trim();
    // Fallback: DeepSeek sometimes returns reasoning_content only with empty content
    if (!content && choice.message.reasoning_content) {
      content = choice.message.reasoning_content.trim();
    }
    if (!content) return { isRelevant: true, tags: [] };

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
You are an expert academic researcher. Analyze the following research paper:
Title: "${title}"
Abstract: "${abstract}"

Your task is to classify this paper into relevant categories.
1. MANDATORY: Choose at least 2 and at most 3 tags from this CORE list: ${ALLOWED_TAGS.join(', ')}.
2. OPTIONAL: You may generate EXACTLY ONE highly specific tag ONLY if the paper introduces a major new concept (e.g., "Offline RL", "Safe RL").
3. STRICT NEGATIVE CONSTRAINTS:
   - NO "World Models", "Model-Based RL", "MBRL", "AI", "Machine Learning", "Neural Networks", "Deep Learning", "Research", "Paper".
   - NO duplicate or near-duplicate tags.
   - NO tags longer than 3 words.
4. FORMATTING: Use Title Case.

Return ONLY a JSON array of strings.
    `;

    const response = await openai.chat.completions.create({
      model: defaultModelName,
      messages: [
        { role: 'system', content: 'You are a strict academic classifier that outputs ONLY JSON arrays.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
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
      model: defaultModelName,
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

export async function parseSearchIntentWithAI(query) {
  if (!openai) {
    return buildFallbackSearchIntent(query, 'AI query parsing is unavailable, using the original query.');
  }

  const prompt = `
You are an academic search assistant. Parse the following natural language search request into structured fields.

Query: "${query}"

Return ONLY a JSON object with this schema:
{
  "intent": "search",
  "rewrittenQuery": string,
  "filters": {
    "tag": string | null,
    "author": string | null,
    "year": string | null
  },
  "keywords": string[],
  "focusAreas": string[],
  "excludeTerms": string[],
  "timePreference": "recent" | "balanced" | "classic",
  "explanation": string
}

Rules:
- rewrittenQuery should be concise and optimized for semantic search.
- filters should only include values if clearly present in the query.
- keywords should contain 2-8 short terms useful for keyword ranking.
- focusAreas should contain 1-4 short phrases describing preferred themes.
- excludeTerms should contain terms or directions the user seems to avoid.
- timePreference should be "recent" for freshness-sensitive requests, "classic" for foundational work, otherwise "balanced".
- explanation should be one sentence explaining how the query was interpreted.
`;

  const modelsToTry = [searchModelName];
  if (defaultModelName !== searchModelName) {
    modelsToTry.push(defaultModelName);
  }

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a strict JSON search parser.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 250
      });

      const choice = response.choices?.[0];
      let content = choice?.message?.content?.trim();
      // Fallback: DeepSeek sometimes returns reasoning_content only with empty content
      if (!content && choice?.message?.reasoning_content) {
        content = choice.message.reasoning_content.trim();
      }

      if (!content) {
        const finishReason = choice?.finish_reason || 'unknown';
        const hasReasoningOnly = Boolean(choice?.message?.reasoning_content?.trim());
        throw new Error(
          `Empty AI search parsing response from ${modelName} (finish_reason=${finishReason}, reasoning_only=${hasReasoningOnly})`
        );
      }

      const result = JSON.parse(extractJsonObject(content));
      return normalizeSearchIntent(query, result);
    } catch (error) {
      lastError = error;
      console.warn(`Search intent parsing failed with model ${modelName}:`, error.message);
    }
  }

  console.error('Error parsing search intent with AI:', lastError);
  return buildFallbackSearchIntent(query, 'AI query parsing failed, so the original query was used.');
}
