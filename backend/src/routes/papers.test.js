import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createPapersRouter } from './papers.js';

function createJsonApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  return app;
}

async function requestJson(app, url, init = {}) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${url}`, init);
    const body = await response.json();
    return {
      status: response.status,
      body
    };
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('POST /api/search/semantic merges parsed filters with request filters', async () => {
  const calls = [];
  const router = createPapersRouter({
    parseSearchQuery: () => ({
      general: 'dreamer robotics',
      filters: { year: '2025' }
    }),
    semanticSearchPapers: async (payload) => {
      calls.push(payload);
      return {
        items: [{ id: 1, title: 'Dreamer Robotics', authors: [], abstract: '', publication_date: '2025-01-01', url: '#' }],
        status: { enabled: true },
        usedFallbackEmbedding: false
      };
    }
  });

  const app = createJsonApp(router);
  const result = await requestJson(app, '/api/search/semantic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'author:"Hafner" robotics',
      filters: { author: 'Hafner' }
    })
  });

  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    query: 'dreamer robotics',
    filters: {
      year: '2025',
      author: 'Hafner'
    },
    limit: undefined
  });
  assert.equal(result.body.items.length, 1);
});

test('POST /api/search/hybrid merges raw filters, AI filters, request filters and passes weights', async () => {
  const calls = [];
  const router = createPapersRouter({
    parseSearchQuery: () => ({
      general: 'recent planning papers',
      filters: { year: '2025' }
    }),
    parseSearchIntentWithAI: async () => ({
      query: 'recent planning papers',
      intent: 'search',
      rewrittenQuery: 'recent planning world models',
      filters: {
        tag: 'Planning'
      },
      keywords: ['planning', 'world models'],
      focusAreas: ['planning', 'robotics'],
      excludeTerms: ['pure vision'],
      timePreference: 'recent',
      explanation: 'Prefer recent planning-oriented world model papers.'
    }),
    hybridSearchPapers: async (payload) => {
      calls.push(payload);
      return {
        items: [{ id: 2, title: 'Planning with World Models', authors: [], abstract: '', publication_date: '2025-02-01', url: '#', match_reasons: ['title matches "planning"'] }],
        status: { enabled: true },
        usedFallbackEmbedding: false,
        weights: {
          semantic: 0.6,
          keyword: 0.25,
          recency: 0.15
        }
      };
    }
  });

  const app = createJsonApp(router);
  const result = await requestJson(app, '/api/search/hybrid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'recent planning papers',
      filters: { author: 'Hafner' },
      weights: { semantic: 0.6, keyword: 0.25, recency: 0.15 }
    })
  });

  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    query: 'recent planning world models',
    filters: {
      year: '2025',
      tag: 'Planning',
      author: 'Hafner'
    },
    keywords: ['planning', 'world models'],
      focusAreas: ['planning', 'robotics'],
      excludeTerms: ['pure vision'],
      timePreference: 'recent',
    weights: { semantic: 0.6, keyword: 0.25, recency: 0.15 },
    limit: undefined
  });
  assert.equal(result.body.ai.rewrittenQuery, 'recent planning world models');
  assert.deepEqual(result.body.weights, {
    semantic: 0.6,
    keyword: 0.25,
    recency: 0.15
  });
});

test('POST /api/recommendations returns AI-driven recommendation results', async () => {
  const router = createPapersRouter({
    getAllPapers: async () => ([
      { id: 1, title: 'Favorite Paper', authors: ['Danijar Hafner'], abstract: '', publication_date: '2025-01-01', url: '#1', tags: ['Planning'] },
      { id: 2, title: 'Recommended Paper', authors: ['Danijar Hafner'], abstract: '', publication_date: '2025-02-01', url: '#2', tags: ['Planning'], match_reasons: ['title matches "planning"'] }
    ]),
    parseSearchIntentWithAI: async () => ({
      query: 'recent planning papers',
      intent: 'search',
      rewrittenQuery: 'recent planning world models',
      filters: {},
      keywords: ['planning'],
      focusAreas: ['planning'],
      excludeTerms: [],
      timePreference: 'recent',
      explanation: 'Recommend recent planning papers.'
    }),
    hybridSearchPapers: async () => ({
      items: [
        { id: 1, title: 'Favorite Paper', authors: ['Danijar Hafner'], abstract: '', publication_date: '2025-01-01', url: '#1', tags: ['Planning'] },
        { id: 2, title: 'Recommended Paper', authors: ['Danijar Hafner'], abstract: '', publication_date: '2025-02-01', url: '#2', tags: ['Planning'], match_reasons: ['title matches "planning"'] }
      ],
      status: { enabled: true },
      usedFallbackEmbedding: false,
      weights: { semantic: 0.45, keyword: 0.25, recency: 0.3 }
    })
  });

  const app = createJsonApp(router);
  const result = await requestJson(app, '/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'recent planning papers',
      favorites: [1],
      limit: 6
    })
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0].id, 2);
  assert.equal(result.body.basedOnFavorites, true);
});

test('POST /api/recommendations prefers vector-based favorite recommendations when available', async () => {
  const router = createPapersRouter({
    getAllPapers: async () => ([
      { id: 1, title: 'Favorite Paper', authors: ['Danijar Hafner'], abstract: '', publication_date: '2025-01-01', url: '#1', tags: ['Planning'] },
      { id: 2, title: 'Vector Recommended Paper', authors: ['Someone'], abstract: '', publication_date: '2025-03-01', url: '#2', tags: ['Robotics'] }
    ]),
    parseSearchIntentWithAI: async () => ({
      query: 'robotics planning',
      intent: 'search',
      rewrittenQuery: 'robotics planning world models',
      filters: {},
      keywords: ['robotics', 'planning'],
      focusAreas: ['robotics'],
      excludeTerms: [],
      timePreference: 'balanced',
      explanation: 'Recommend robotics planning papers.'
    }),
    recommendPapersFromFavorites: async () => ({
      items: [
        {
          id: 2,
          title: 'Vector Recommended Paper',
          authors: ['Someone'],
          abstract: '',
          publication_date: '2025-03-01',
          url: '#2',
          tags: ['Robotics'],
          match_reasons: ['embedding similarity to your favorites']
        }
      ],
      usedVectorRecommendations: true
    }),
    hybridSearchPapers: async () => ({
      items: [],
      status: { enabled: true },
      usedFallbackEmbedding: false,
      weights: { semantic: 0.45, keyword: 0.25, recency: 0.3 }
    })
  });

  const app = createJsonApp(router);
  const result = await requestJson(app, '/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'robotics planning',
      favorites: [1],
      limit: 6
    })
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0].id, 2);
  assert.equal(result.body.usedVectorRecommendations, true);
});

test('POST /api/recommendations/similar-paper returns similar papers for a target paper', async () => {
  const router = createPapersRouter({
    getPaperById: async (id) => (
      id === 1
        ? { id: 1, title: 'Target Paper', authors: ['Author'], abstract: '', publication_date: '2025-01-01', url: '#1', tags: ['Planning'] }
        : null
    ),
    parseSearchIntentWithAI: async () => ({
      query: 'Target Paper Planning',
      intent: 'search',
      rewrittenQuery: 'planning world models',
      filters: {},
      keywords: ['planning'],
      focusAreas: ['planning'],
      excludeTerms: [],
      timePreference: 'balanced',
      explanation: 'Recommend similar planning papers.'
    }),
    recommendPapersFromFavorites: async () => ({
      items: [
        {
          id: 2,
          title: 'Similar Paper',
          authors: ['Another'],
          abstract: '',
          publication_date: '2025-02-01',
          url: '#2',
          tags: ['Planning'],
          match_reasons: ['embedding similarity to this paper']
        }
      ],
      usedVectorRecommendations: true
    })
  });

  const app = createJsonApp(router);
  const result = await requestJson(app, '/api/recommendations/similar-paper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paperId: 1,
      query: 'Target Paper Planning',
      limit: 6
    })
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.paperId, 1);
  assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0].id, 2);
  assert.equal(result.body.usedVectorRecommendations, true);
});

test('POST /api/search/hybrid returns 400 when query is missing', async () => {
  const app = createJsonApp(createPapersRouter());
  const result = await requestJson(app, '/api/search/hybrid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { message: 'Query is required' });
});
