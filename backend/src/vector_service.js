import crypto from 'crypto';

import OpenAI from 'openai';

import {
  EMBEDDING_API_KEY,
  EMBEDDING_BASE_URL,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  EMBEDDING_VERSION,
  VECTOR_SEARCH_TOP_K,
  getEmbeddingConfigSummary
} from './vector_config.js';
import { STOP_WORDS, stripQueryWrappers } from './stopwords.js';
import {
  findSimilarPapers,
  getAllPapers,
  getPaperEmbeddingsByIds,
  getEmbeddingMetadataMap,
  getVectorSearchStatus,
  upsertPaperEmbedding
} from './database.js';

const openai = EMBEDDING_API_KEY
  ? new OpenAI({
      apiKey: EMBEDDING_API_KEY,
      baseURL: EMBEDDING_BASE_URL
    })
  : null;

const DEFAULT_HYBRID_WEIGHTS = Object.freeze({
  semantic: 0.55,
  keyword: 0.3,
  recency: 0.15
});

function clampWeight(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function normalizeHybridWeights(weights = {}) {
  const semantic = clampWeight(weights.semantic, DEFAULT_HYBRID_WEIGHTS.semantic);
  const keyword = clampWeight(weights.keyword, DEFAULT_HYBRID_WEIGHTS.keyword);
  const recency = clampWeight(weights.recency, DEFAULT_HYBRID_WEIGHTS.recency);
  const total = semantic + keyword + recency;

  if (total <= 0) {
    return DEFAULT_HYBRID_WEIGHTS;
  }

  return {
    semantic: Number((semantic / total).toFixed(4)),
    keyword: Number((keyword / total).toFixed(4)),
    recency: Number((recency / total).toFixed(4))
  };
}

function buildKeywordSet(query, keywords = []) {
  const merged = [stripQueryWrappers(query), ...keywords]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

  return Array.from(new Set(merged));
}

function matchesFilters(paper, filters) {
  if (filters.tag) {
    const hasTag = (paper.tags || []).some((tag) => tag.toLowerCase().includes(filters.tag.toLowerCase()));
    if (!hasTag) {
      return false;
    }
  }

  if (filters.author) {
    const hasAuthor = (paper.authors || []).some((author) => author.toLowerCase().includes(filters.author.toLowerCase()));
    if (!hasAuthor) {
      return false;
    }
  }

  if (filters.year) {
    const paperYear = new Date(paper.publication_date).getFullYear().toString();
    if (paperYear !== String(filters.year)) {
      return false;
    }
  }

  return true;
}

async function fallbackSemanticSearch({ query, filters = {}, limit }) {
  const normalizedQuery = query.toLowerCase().trim();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const papers = await getAllPapers();

  const scored = papers
    .filter((paper) => matchesFilters(paper, filters))
    .map((paper) => {
      const haystack = [
        paper.title,
        (paper.authors || []).join(' '),
        paper.abstract,
        (paper.tags || []).join(' '),
        paper.summary || '',
        paper.contribution || ''
      ]
        .join(' ')
        .toLowerCase();

      const score = terms.reduce((sum, term) => {
        if (!term) {
          return sum;
        }
        if (haystack.includes(term)) {
          return sum + 1;
        }
        return sum;
      }, 0);

      return {
        ...paper,
        similarity: terms.length > 0 ? score / terms.length : 0
      };
    })
    .filter((paper) => paper.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime())
    .slice(0, limit);

  return scored;
}

function computeKeywordScore(paper, terms) {
  if (!terms.length) {
    return 0;
  }

  const text = [
    paper.title,
    (paper.authors || []).join(' '),
    paper.abstract,
    (paper.tags || []).join(' '),
    paper.summary || '',
    paper.contribution || ''
  ]
    .join(' ')
    .toLowerCase();

  const title = (paper.title || '').toLowerCase();
  const tags = (paper.tags || []).join(' ').toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) {
      score += 0.45;
    }
    if (tags.includes(term)) {
      score += 0.2;
    }
    if (text.includes(term)) {
      score += 0.15;
    }
  }

  return Math.min(score, 1);
}

function computeRecencyScore(publicationDate) {
  const publishedAt = new Date(publicationDate).getTime();
  if (Number.isNaN(publishedAt)) {
    return 0;
  }

  const ageDays = Math.max(0, (Date.now() - publishedAt) / (1000 * 60 * 60 * 24));
  if (ageDays <= 30) return 1;
  if (ageDays <= 180) return 0.8;
  if (ageDays <= 365) return 0.6;
  if (ageDays <= 730) return 0.35;
  return 0.15;
}

function buildMatchReasons(paper, {
  terms = [],
  filters = {},
  semanticScore = 0,
  keywordScore = 0,
  recencyScore = 0,
  focusAreas = [],
  focusAreaScore = 0,
  timePreference = 'balanced'
} = {}) {
  const reasons = [];

  // Semantic similarity — the primary ranking signal
  if (semanticScore > 0.6) reasons.push(`strong semantic match (${Math.round(semanticScore * 100)}%)`);
  else if (semanticScore > 0.3) reasons.push(`moderate semantic match (${Math.round(semanticScore * 100)}%)`);

  // Focus area match
  if (focusAreaScore > 0) {
    const matched = focusAreas.filter(a => {
      const text = [paper.title, paper.abstract, (paper.tags || []).join(' ')].join(' ').toLowerCase();
      return text.includes(a.toLowerCase());
    });
    if (matched.length > 0) reasons.push(`topic: ${matched.slice(0, 2).join(', ')}`);
    else reasons.push(`topic relevance (${Math.round(focusAreaScore * 100)}%)`);
  }

  // Recency
  if (timePreference === 'recent' && recencyScore >= 0.8) reasons.push('recent publication');
  else if (timePreference === 'classic' && recencyScore <= 0.35) reasons.push('foundational/classic work');
  else if (recencyScore >= 0.9) reasons.push('recently published');

  // Keyword match — only show if it's a distinguishing factor
  if (keywordScore > 0.3 && semanticScore < 0.5) {
    reasons.push(`keyword relevance (${Math.round(keywordScore * 100)}%)`);
  } else if (keywordScore > 0.3) {
    // Show the highest-scoring keyword hit in title
    for (const term of terms.filter(t => t.length > 3).slice(0, 5)) {
      if ((paper.title || '').toLowerCase().includes(term.toLowerCase())) {
        reasons.push(`"${term}" in title`);
        break;
      }
    }
  }

  // Filters
  if (filters.tag) reasons.push(`tag: ${filters.tag}`);
  if (filters.author) reasons.push(`author: ${filters.author}`);
  if (filters.year) reasons.push(`year: ${filters.year}`);

  return Array.from(new Set(reasons)).slice(0, 4);
}

function computeFocusAreaScore(paper, focusAreas = []) {
  if (!focusAreas.length) {
    return 0;
  }

  const text = [
    paper.title,
    (paper.authors || []).join(' '),
    paper.abstract,
    (paper.tags || []).join(' '),
    paper.summary || '',
    paper.contribution || ''
  ]
    .join(' ')
    .toLowerCase();

  let matches = 0;
  for (const area of focusAreas) {
    if (text.includes(area.toLowerCase())) {
      matches += 1;
    }
  }

  return Math.min(matches / focusAreas.length, 1);
}

function computePenaltyScore(paper, excludeTerms = []) {
  if (!excludeTerms.length) {
    return 0;
  }

  const text = [
    paper.title,
    (paper.authors || []).join(' '),
    paper.abstract,
    (paper.tags || []).join(' ')
  ]
    .join(' ')
    .toLowerCase();

  let penalty = 0;
  for (const term of excludeTerms) {
    if (text.includes(term.toLowerCase())) {
      penalty += 0.18;
    }
  }

  return Math.min(penalty, 0.5);
}

function computeTimePreferenceBoost(publicationDate, timePreference = 'balanced') {
  const recency = computeRecencyScore(publicationDate);
  if (timePreference === 'recent') {
    return recency;
  }
  if (timePreference === 'classic') {
    return 1 - recency;
  }
  return 0.5;
}

function normalizePaperText(paper) {
  const parts = [
    `Title: ${paper.title || ''}`,
    `Authors: ${(paper.authors || []).join(', ')}`,
    `Tags: ${(paper.tags || []).join(', ')}`,
    `Abstract: ${paper.abstract || ''}`,
    `Summary: ${paper.summary || ''}`,
    `Contribution: ${paper.contribution || ''}`,
    `Limitations: ${paper.limitations || ''}`
  ];

  return parts.join('\n').trim();
}

function buildSourceHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function fallbackEmbedding(text) {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  const normalized = text.toLowerCase();

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    vector[index % EMBEDDING_DIMENSIONS] += code / 255;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function averageEmbeddings(embeddings = []) {
  const validEmbeddings = embeddings.filter((embedding) => Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS);
  if (validEmbeddings.length === 0) {
    return null;
  }

  const sums = new Array(EMBEDDING_DIMENSIONS).fill(0);
  for (const embedding of validEmbeddings) {
    for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
      sums[index] += embedding[index];
    }
  }

  const averaged = sums.map((value) => value / validEmbeddings.length);
  const magnitude = Math.sqrt(averaged.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return averaged;
  }

  return averaged.map((value) => value / magnitude);
}

async function createEmbedding(text) {
  if (!text.trim()) {
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  if (!openai) {
    return fallbackEmbedding(text);
  }

  const requestPayload = {
    model: EMBEDDING_MODEL,
    input: text
  };

  // OpenAI-compatible providers may expose different default dimensions.
  // Passing the configured dimension keeps the DB schema and upstream output aligned
  // whenever the provider supports this parameter.
  if (Number.isFinite(EMBEDDING_DIMENSIONS) && EMBEDDING_DIMENSIONS > 0) {
    requestPayload.dimensions = EMBEDDING_DIMENSIONS;
  }

  const response = await openai.embeddings.create(requestPayload);
  const embedding = response.data[0]?.embedding || [];

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimensions mismatch for model "${EMBEDDING_MODEL}". Expected ${EMBEDDING_DIMENSIONS}, received ${embedding.length || 0}.`
    );
  }

  return embedding;
}

export async function indexPaperEmbeddings({ force = false, limit } = {}) {
  const status = getVectorSearchStatus();
  if (!status.enabled) {
    return {
      indexed: 0,
      skipped: 0,
      total: 0,
      status,
      embedding: getEmbeddingConfigSummary()
    };
  }

  const papers = await getAllPapers();
  const embeddingMetadata = await getEmbeddingMetadataMap();
  let indexed = 0;
  let skipped = 0;

  for (const paper of papers.slice(0, limit || papers.length)) {
    const sourceText = normalizePaperText(paper);
    const sourceHash = buildSourceHash(sourceText);
    const existing = embeddingMetadata.get(paper.id);

    if (!force && existing?.source_hash === sourceHash && existing?.embedding_model === EMBEDDING_MODEL) {
      skipped += 1;
      continue;
    }

    const embedding = await createEmbedding(sourceText);
    await upsertPaperEmbedding({
      paperId: paper.id,
      embedding,
      sourceHash,
      sourceText,
      embeddingModel: EMBEDDING_MODEL,
      embeddingVersion: EMBEDDING_VERSION
    });
    indexed += 1;
  }

  return {
    indexed,
    skipped,
    total: papers.length,
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    embedding: getEmbeddingConfigSummary()
  };
}

export async function semanticSearchPapers({
  query,
  filters = {},
  limit = VECTOR_SEARCH_TOP_K
}) {
  const status = getVectorSearchStatus();
  if (!status.enabled) {
    const items = await fallbackSemanticSearch({ query, filters, limit });
    return {
      items,
      status,
      query,
      usedFallbackEmbedding: true
    };
  }

  const embedding = await createEmbedding(query);
  const items = await findSimilarPapers({
    embedding,
    limit,
    filters
  });

  return {
    items,
    status,
    query,
    usedFallbackEmbedding: !openai
  };
}

export async function hybridSearchPapers({
  query,
  filters = {},
  keywords = [],
  focusAreas = [],
  excludeTerms = [],
  timePreference = 'balanced',
  weights = DEFAULT_HYBRID_WEIGHTS,
  limit = VECTOR_SEARCH_TOP_K
}) {
  const semantic = await semanticSearchPapers({ query, filters, limit: limit * 2 });
  const terms = buildKeywordSet(query, keywords);
  const normalizedWeights = normalizeHybridWeights(weights);
  const baseline = semantic.items.length > 0
    ? semantic.items
    : (await fallbackSemanticSearch({ query, filters, limit: limit * 2 }));

  const items = baseline
    .map((paper) => {
      const semanticScore = paper.similarity || 0;
      const keywordScore = computeKeywordScore(paper, terms);
      const recencyScore = computeRecencyScore(paper.publication_date);
      const focusAreaScore = computeFocusAreaScore(paper, focusAreas);
      const timePreferenceBoost = computeTimePreferenceBoost(paper.publication_date, timePreference);
      const penaltyScore = computePenaltyScore(paper, excludeTerms);
      const hybridScore =
        semanticScore * normalizedWeights.semantic +
        keywordScore * normalizedWeights.keyword +
        recencyScore * normalizedWeights.recency +
        focusAreaScore * 0.12 +
        timePreferenceBoost * 0.08 -
        penaltyScore;

      return {
        ...paper,
        semantic_score: Number(semanticScore.toFixed(4)),
        keyword_score: Number(keywordScore.toFixed(4)),
        recency_score: Number(recencyScore.toFixed(4)),
        hybrid_score: Number(hybridScore.toFixed(4)),
        match_reasons: buildMatchReasons(paper, {
          terms, filters, semanticScore, keywordScore, recencyScore,
          focusAreas, focusAreaScore, timePreference
        })
      };
    })
    .sort((a, b) => b.hybrid_score - a.hybrid_score)
    .slice(0, limit);

  return {
    ...semantic,
    weights: normalizedWeights,
    items
  };
}

export async function getVectorSearchOverview() {
  const status = getVectorSearchStatus();
  return {
    ...status,
    ...getEmbeddingConfigSummary(),
    topK: VECTOR_SEARCH_TOP_K
  };
}

export async function recommendPapersFromFavorites({
  favorites = [],
  sourcePaperIds,
  query = '',
  filters = {},
  keywords = [],
  focusAreas = [],
  excludeTerms = [],
  timePreference = 'balanced',
  limit = 12,
  reasonLabel = 'embedding similarity to your favorites'
}) {
  const status = getVectorSearchStatus();
  const seedPaperIds = Array.from(new Set((sourcePaperIds || favorites || []).map(Number).filter((id) => Number.isInteger(id))));
  const seedEmbeddings = await getPaperEmbeddingsByIds(seedPaperIds);
  const centroid = averageEmbeddings(seedEmbeddings.map((item) => item.embedding));

  if (!status.enabled || !centroid) {
    return {
      items: [],
      status,
      usedVectorRecommendations: false
    };
  }

  const semanticItems = await findSimilarPapers({
    embedding: centroid,
    limit: Math.max(limit * 3, 18),
    filters
  });
  const favoriteSet = new Set(seedPaperIds);
  const terms = buildKeywordSet(query, keywords);

  const items = semanticItems
    .filter((paper) => !favoriteSet.has(Number(paper.id)))
    .map((paper) => {
      const semanticScore = paper.similarity || 0;
      const keywordScore = computeKeywordScore(paper, terms);
      const recencyScore = computeRecencyScore(paper.publication_date);
      const focusAreaScore = computeFocusAreaScore(paper, focusAreas);
      const timePreferenceBoost = computeTimePreferenceBoost(paper.publication_date, timePreference);
      const penaltyScore = computePenaltyScore(paper, excludeTerms);
      const recommendationScore =
        semanticScore * 0.55 +
        keywordScore * 0.15 +
        recencyScore * 0.15 +
        focusAreaScore * 0.1 +
        timePreferenceBoost * 0.05 -
        penaltyScore;

      return {
        ...paper,
        semantic_score: Number(semanticScore.toFixed(4)),
        keyword_score: Number(keywordScore.toFixed(4)),
        recency_score: Number(recencyScore.toFixed(4)),
        hybrid_score: Number(recommendationScore.toFixed(4)),
        match_reasons: Array.from(new Set([
          reasonLabel,
          ...buildMatchReasons(paper, {
            terms, filters, semanticScore, keywordScore, recencyScore,
            focusAreas, focusAreaScore, timePreference
          })
        ])).slice(0, 5)
      };
    })
    .sort((a, b) => b.hybrid_score - a.hybrid_score)
    .slice(0, limit);

  return {
    items,
    status,
    usedVectorRecommendations: true
  };
}
