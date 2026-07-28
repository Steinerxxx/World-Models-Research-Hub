import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.AI_API_KEY;
const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const modelName = process.env.AI_MODEL_NAME || 'deepseek-chat';

const openai = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

const SYSTEM_PROMPT = `You are a research assistant for a World Models & Model-Based RL paper hub.

=== AVAILABLE TOOLS ===

SEARCH(query, mode)
  - mode: "semantic" | "hybrid" | "keyword"
  - To filter by tag/author/year, include them in the query string.

RECOMMEND(query?, limit?)
  - Recommend papers based on user's favorites and research context.

ANALYZE(paper_title)
  - Get summary, contribution, and limitations for a specific paper.

SIMILAR(paper_title)
  - Find papers similar to a given paper.

=== WHEN TO USE EACH TOOL ===
- "find/search/discover papers about X" → SEARCH
- "recommend/suggest papers" → RECOMMEND
- "analyze/explain paper X", "what is X about" → ANALYZE
- "similar to X", "papers like X" → SIMILAR

=== RESPONSE FORMAT ===

To use tools, output EXACTLY:
---TOOLS
SEARCH("query", "mode")
---END

Use ONLY quoted positional arguments. NEVER use tag="value" syntax.
After receiving results, respond in natural language. NEVER repeat the ---TOOLS block.

=== IMPORTANT RULES ===
- NEVER mention internal database IDs in your responses.
- When referring to a paper, always use its title, not an ID number.
- For ANALYZE, use the exact paper title from results. The tool will confirm which paper was matched.
- If the user says "the last one", "the first one", or similar ordinal references, look at the most recent results for context.

If no tools needed, answer directly. Keep responses concise.`;

function parseToolCalls(text) {
  // Match ---TOOLS block flexibly — handles single-line, multi-line, \r\n, extra spaces
  const match = text.match(/---TOOLS\s*[\r\n]*([\s\S]*?)[\r\n]*\s*---END/i);
  if (!match) {
    if (text.includes('---TOOLS')) {
      console.error('[parseToolCalls] Found ---TOOLS but regex failed. Raw text:', JSON.stringify(text.slice(0, 500)));
    }
    return null;
  }

  const calls = [];
  const body = match[1].trim();
  // Split into lines if multi-line, otherwise treat entire body as one line
  const lines = body.includes('\n') ? body.split(/\r?\n/) : [body];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const toolMatch = trimmed.match(/^(SEARCH|RECOMMEND|ANALYZE|SIMILAR)\((.*)\)$/s);
    if (!toolMatch) continue;

    const [, tool, argsStr] = toolMatch;
    const args = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < argsStr.length; i++) {
      const ch = argsStr[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        args.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) args.push(current.trim());

    calls.push({ tool, args: args.map(a => a.replace(/^"|"$/g, '')) });
  }

  if (calls.length === 0) {
    console.error('[parseToolCalls] Parsed TOOLS block but found no valid tool calls. Content:', JSON.stringify(match[1].slice(0, 300)));
  }

  return calls.length > 0 ? calls : null;
}

export async function chatWithAgent(userMessage, favorites, context, history = []) {
  if (!openai) {
    return { answer: 'AI agent is currently unavailable. Please configure AI_API_KEY.' };
  }

  // Look up favorite paper titles so AI understands user's references
  let favoriteInfo = favorites.length > 0 ? `User has ${favorites.length} favorite papers.` : 'User has no favorites yet.';
  if (favorites.length > 0) {
    try {
      const { getAllPapers } = await import('./database.js');
      const allPapers = await getAllPapers();
      const favPapers = allPapers.filter(p => favorites.includes(p.id));
      if (favPapers.length > 0) {
        favoriteInfo = `User's favorites:\n${favPapers.map(p => `- "${p.title}" (${new Date(p.publication_date).getFullYear()})`).join('\n')}`;
      }
    } catch { /* non-critical, keep IDs-only fallback */ }
  }

  // Build conversation with recent history (keep last 12 messages = 6 turns)
  const recentHistory = history.slice(-12).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recentHistory,
    { role: 'user', content: `${favoriteInfo}\nUser's research context: ${context || 'none'}\n\nUser message: ${userMessage}` }
  ];

  // Step 1: AI decides what tools to call
  let response;
  try {
    response = await openai.chat.completions.create({
      model: modelName,
      messages,
      temperature: 0.3,
      max_tokens: 800,
    });
  } catch (err) {
    console.error('Agent API error:', err.message);
    return { answer: 'Sorry, the AI service is temporarily unavailable. Please try again later.' };
  }

  let content = response.choices[0]?.message?.content?.trim() || '';
  if (!content && response.choices[0]?.message?.reasoning_content) {
    content = response.choices[0].message.reasoning_content.trim();
  }
  if (!content) {
    return { answer: 'I was unable to process your request. Please try rephrasing.' };
  }

  console.log('[chatWithAgent] AI response (first 500 chars):', content.slice(0, 500));

  const toolCalls = parseToolCalls(content);

  if (!toolCalls) {
    // No tools needed — direct answer (strip any ---TOOLS block just in case)
    const answer = content.replace(/---TOOLS[\s\S]*?---END/gi, '').trim();
    if (answer) return { answer };
    // If the entire response was a TOOLS block we couldn't parse, apologise
    return { answer: 'I encountered an issue processing your request. Please try again or rephrase your question.' };
  }

  // Step 2: Execute tools
  const toolResults = [];
  for (const call of toolCalls) {
    try {
      const result = await executeTool(call, favorites, context);
      toolResults.push({ tool: call.tool, args: call.args, result });
    } catch (err) {
      toolResults.push({ tool: call.tool, args: call.args, error: err.message });
    }
  }

  // Step 3: Feed concise results back to AI for final answer
  messages.push({ role: 'assistant', content: `[System: tools executed: ${toolCalls.map(c => c.tool).join(', ')}]` });
  messages.push({
    role: 'user',
    content: `Tool results:\n${summarizeToolResults(toolResults)}\n\nProvide your final answer based on these results. Be concise. Do NOT output ---TOOLS or tool call format.`
  });

  try {
    response = await openai.chat.completions.create({
      model: modelName,
      messages,
      temperature: 0.5,
      max_tokens: 4096,
    });
  } catch (err) {
    console.error('Agent final response error:', err.message);
    return { answer: formatToolResultsFallback(toolResults) };
  }

  let finalContent = response.choices[0]?.message?.content?.trim() || '';
  if (!finalContent && response.choices[0]?.message?.reasoning_content) {
    finalContent = response.choices[0].message.reasoning_content.trim();
  }
  // Safety: strip any stray ---TOOLS blocks from final response
  finalContent = finalContent.replace(/---TOOLS[\s\S]*?---END/gi, '').trim();

  return {
    answer: finalContent || formatToolResultsFallback(toolResults),
    toolsUsed: toolCalls.map(c => c.tool)
  };
}

function summarizeToolResults(results) {
  return results.map(r => {
    if (r.error) return `[${r.tool}] Error: ${r.error}`;
    if (typeof r.result === 'string') return `[${r.tool}] ${r.result}`;
    const res = r.result;
    if (res.papers) {
      const maxPapers = res.papers.slice(0, 5);
      const lines = [
        `[${r.tool}] ${res.count || maxPapers.length} results${res.sourcePaper ? ` (similar to: "${res.sourcePaper}")` : ''}:`,
        ...maxPapers.map(p => `  - "${p.title}" (${p.year}) - ${p.authors || ''} [${(p.tags || []).join(', ')}]`),
      ];
      if (res.summary) lines.push(`  Summary: ${res.summary}`);
      if (res.contribution) lines.push(`  Contribution: ${res.contribution}`);
      if (res.limitations) lines.push(`  Limitations: ${res.limitations}`);
      return lines.join('\n');
    }
    if (res.summary || res.contribution || res.limitations) {
      return [
        `[${r.tool}] Matched paper: "${res.title}"`,
        res.summary ? `  Summary: ${res.summary}` : '',
        res.contribution ? `  Contribution: ${res.contribution}` : '',
        res.limitations ? `  Limitations: ${res.limitations}` : ''
      ].filter(Boolean).join('\n');
    }
    return `[${r.tool}] ${JSON.stringify(res).slice(0, 500)}`;
  }).join('\n\n');
}

function formatToolResultsFallback(results) {
  return results.map(r => {
    if (r.error) return `[${r.tool}] Error: ${r.error}`;
    if (typeof r.result === 'string') return r.result;
    return `[${r.tool}] Found ${r.result?.count || 0} results.`;
  }).join('\n\n');
}

function findPaperByTitle(allPapers, searchTerm) {
  const lower = searchTerm.toLowerCase();
  // 1. Exact substring match
  let paper = allPapers.find(p => p.title.toLowerCase().includes(lower));
  if (paper) return paper;
  // 2. All words must appear in title (AND match)
  const words = lower.split(/\s+/).filter(w => w.length > 1);
  if (words.length > 0) {
    paper = allPapers.find(p => {
      const t = p.title.toLowerCase();
      return words.every(w => t.includes(w));
    });
    if (paper) return paper;
    // 3. Best partial match: most words matched
    let best = null;
    let bestScore = 0;
    for (const p of allPapers) {
      const t = p.title.toLowerCase();
      const score = words.filter(w => t.includes(w)).length;
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if (best && bestScore >= Math.ceil(words.length / 2)) return best;
  }
  return null;
}

function summarizePaper(p) {
  return {
    title: p.title,
    authors: (p.authors || []).slice(0, 3).join(', '),
    year: new Date(p.publication_date).getFullYear(),
    tags: (p.tags || []).slice(0, 5),
  };
}

async function executeTool(call, favorites, context) {
  const { tool, args } = call;

  const cleanTitle = (t) => (t || '').replace(/[?!.,;:]+$/g, '').trim();

  switch (tool) {
    case 'SEARCH': {
      const [query, mode = 'hybrid', tag, author, year] = args;
      const filters = {};
      if (tag) filters.tag = tag;
      if (author) filters.author = author;
      if (year) filters.year = year;

      const { hybridSearchPapers, semanticSearchPapers } = await import('./vector_service.js');
      const searchFn = mode === 'semantic' ? semanticSearchPapers : hybridSearchPapers;
      const result = await searchFn({ query, filters, limit: 5 });

      if (!result.items?.length) return `No papers found for "${query}".`;

      return {
        count: result.items.length,
        papers: result.items.map(summarizePaper)
      };
    }

    case 'RECOMMEND': {
      const [query = '', limit = 5] = args;
      const { recommendPapersFromFavorites } = await import('./vector_service.js');
      const result = await recommendPapersFromFavorites({
        favorites,
        query: query || context || undefined,
        limit: parseInt(limit) || 5,
      });

      if (!result.items?.length) return 'No recommendations available. Try adding some papers to your favorites first.';

      return {
        count: result.items.length,
        papers: result.items.map(summarizePaper)
      };
    }

    case 'ANALYZE': {
      const [rawTitle] = args;
      const paperTitle = cleanTitle(rawTitle);
      if (!paperTitle) return 'Please specify a paper title to analyze.';

      const { getAllPapers } = await import('./database.js');
      const { generatePaperAnalysis } = await import('./ai_service.js');

      const allPapers = await getAllPapers();
      const paper = findPaperByTitle(allPapers, paperTitle);

      if (!paper) return `Could not find a paper matching "${paperTitle}". Try using a more specific title.`;

      if (paper.summary) {
        return {
          title: paper.title,
          summary: paper.summary,
          contribution: paper.contribution,
          limitations: paper.limitations
        };
      }

      try {
        const analysis = await generatePaperAnalysis(paper.title, paper.abstract);
        return {
          title: paper.title,
          ...analysis
        };
      } catch {
        return `Analysis for "${paper.title}" is not available yet.`;
      }
    }

    case 'SIMILAR': {
      const [rawTitle] = args;
      const paperTitle = cleanTitle(rawTitle);
      if (!paperTitle) return 'Please specify a paper title.';

      const { getAllPapers } = await import('./database.js');
      const { recommendPapersFromFavorites } = await import('./vector_service.js');

      const allPapers = await getAllPapers();
      const paper = findPaperByTitle(allPapers, paperTitle);

      if (!paper) return `Could not find a paper matching "${paperTitle}". Try using a more specific title.`;

      const result = await recommendPapersFromFavorites({
        sourcePaperIds: [paper.id],
        limit: 5,
      });

      if (!result.items?.length) return `No similar papers found for "${paperTitle}".`;

      return {
        count: result.items.length,
        sourcePaper: paperTitle,
        papers: result.items.map(summarizePaper)
      };
    }

    default:
      return `Unknown tool: ${tool}`;
  }
}
