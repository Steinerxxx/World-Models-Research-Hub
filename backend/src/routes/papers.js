import express from 'express';
import {
  addPaper,
  getAllPapers,
  getAllTags,
  getPaperById,
  getPaperTrends,
  updatePaperSummary
} from '../database.js';
import { scrapeArxiv } from '../scraper.js';
import { generatePaperAnalysis, parseSearchIntentWithAI } from '../ai_service.js';
import { hybridSearchPapers, recommendPapersFromFavorites, semanticSearchPapers } from '../vector_service.js';
import { parseSearchQuery } from '../search_parser.js';

export function createPapersRouter(deps = {}) {
  const router = express.Router();
  const database = {
    addPaper: deps.addPaper || addPaper,
    getAllPapers: deps.getAllPapers || getAllPapers,
    getAllTags: deps.getAllTags || getAllTags,
    getPaperById: deps.getPaperById || getPaperById,
    getPaperTrends: deps.getPaperTrends || getPaperTrends,
    updatePaperSummary: deps.updatePaperSummary || updatePaperSummary
  };
  const services = {
    scrapeArxiv: deps.scrapeArxiv || scrapeArxiv,
    generatePaperAnalysis: deps.generatePaperAnalysis || generatePaperAnalysis,
    parseSearchIntentWithAI: deps.parseSearchIntentWithAI || parseSearchIntentWithAI,
    hybridSearchPapers: deps.hybridSearchPapers || hybridSearchPapers,
    recommendPapersFromFavorites: deps.recommendPapersFromFavorites || recommendPapersFromFavorites,
    semanticSearchPapers: deps.semanticSearchPapers || semanticSearchPapers,
    parseSearchQuery: deps.parseSearchQuery || parseSearchQuery
  };

  async function buildAiRecommendations({ query = '', favorites = [], limit = 6 }) {
    const papers = await database.getAllPapers();
    const aiParsed = await services.parseSearchIntentWithAI(query || 'Recommend world model papers for ongoing research exploration');
    const favoriteSet = new Set((favorites || []).map(Number));
    const favoritePapers = papers.filter((paper) => favoriteSet.has(Number(paper.id)));
    const contextPaperIds = [
      ...favoritePapers.slice(0, 3).map((paper) => paper.id),
      ...papers
        .filter((paper) => !favoriteSet.has(Number(paper.id)))
        .filter((paper) => {
          const haystack = [
            paper.title,
            (paper.tags || []).join(' '),
            paper.summary || '',
            paper.abstract || ''
          ].join(' ').toLowerCase();

          return (aiParsed.focusAreas || []).some((area) => haystack.includes(area.toLowerCase()));
        })
        .slice(0, 2)
        .map((paper) => paper.id)
    ];
    const vectorRecommendations = favoritePapers.length > 0
      ? await services.recommendPapersFromFavorites({
          favorites,
        sourcePaperIds: contextPaperIds,
          query: aiParsed.rewrittenQuery || query || 'world models',
          filters: aiParsed.filters || {},
          keywords: aiParsed.keywords || [],
          focusAreas: aiParsed.focusAreas || [],
          excludeTerms: aiParsed.excludeTerms || [],
          timePreference: aiParsed.timePreference || 'balanced',
        limit,
        reasonLabel: 'embedding similarity to your favorites and current context'
        })
      : {
          items: [],
          usedVectorRecommendations: false
        };
    const recommended = vectorRecommendations.items.length > 0
      ? vectorRecommendations
      : await services.hybridSearchPapers({
          query: aiParsed.rewrittenQuery || query || 'world models',
          filters: aiParsed.filters || {},
          keywords: aiParsed.keywords || [],
          focusAreas: aiParsed.focusAreas || [],
          excludeTerms: aiParsed.excludeTerms || [],
          timePreference: aiParsed.timePreference || 'balanced',
          weights: {
            semantic: favoritePapers.length > 0 ? 0.45 : 0.55,
            keyword: 0.25,
            recency: favoritePapers.length > 0 ? 0.3 : 0.2
          },
          limit: Math.max(limit * 2, 12)
        });

    const favoriteAuthors = new Set(
      favoritePapers.flatMap((paper) => (paper.authors || []).map((author) => author.toLowerCase()))
    );
    const favoriteTags = new Set(
      favoritePapers.flatMap((paper) => (paper.tags || []).map((tag) => tag.toLowerCase()))
    );

    const items = recommended.items
      .filter((paper) => !favoriteSet.has(Number(paper.id)))
      .map((paper) => {
        const authorAffinity = (paper.authors || []).some((author) => favoriteAuthors.has(author.toLowerCase()));
        const tagAffinity = (paper.tags || []).some((tag) => favoriteTags.has(tag.toLowerCase()));
        const recommendationReasons = [
          ...(paper.match_reasons || []),
          ...(authorAffinity ? ['aligned with authors from your favorites'] : []),
          ...(tagAffinity ? ['aligned with tags from your favorites'] : []),
          ...(vectorRecommendations.items.length > 0
            ? ['recommended from embedding similarity to your favorites']
            : favoritePapers.length === 0
              ? ['recommended from your current AI search intent']
              : ['recommended from your favorites + current AI intent'])
        ];

        return {
          ...paper,
          match_reasons: Array.from(new Set(recommendationReasons)).slice(0, 5)
        };
      })
      .slice(0, limit);

    return {
      query,
      ai: aiParsed,
      items,
      basedOnFavorites: favoritePapers.length > 0,
      usedVectorRecommendations: Boolean(vectorRecommendations.items.length > 0)
    };
  }

  router.get('/papers', async (_req, res) => {
    try {
      const papers = await database.getAllPapers();
      res.json(papers);
    } catch (err) {
      console.error('Error getting papers:', err);
      res.status(500).json({ message: 'Failed to get papers' });
    }
  });

  router.get('/papers/trends', async (_req, res) => {
    try {
      const trends = await database.getPaperTrends();
      res.json(trends);
    } catch (err) {
      console.error('Error getting trends:', err);
      res.status(500).json({ message: 'Failed to get trends' });
    }
  });

  router.get('/tags', async (_req, res) => {
    try {
      const tags = await database.getAllTags();
      res.json(tags);
    } catch (err) {
      console.error('Error getting tags:', err);
      res.status(500).json({ message: 'Failed to get tags', error: err.message });
    }
  });

  router.post('/papers', async (req, res) => {
    try {
      await database.addPaper(req.body);
      res.status(201).json({ message: 'Paper added successfully' });
    } catch (err) {
      console.error('Error adding paper:', err);
      res.status(500).json({ message: 'Failed to add paper' });
    }
  });

  router.post('/scrape', async (req, res) => {
    try {
      const fullBackfill = req.query.type === 'full';

      if (fullBackfill) {
        services.scrapeArxiv(true).catch(err => console.error('Full backfill failed:', err));
        res.json({
          message: 'Full backfill started in background.',
          status: 'processing'
        });
        return;
      }

      const result = await services.scrapeArxiv(false);
      res.json({ message: 'Scraping completed', stats: result });
    } catch (err) {
      console.error('Scraping error:', err);
      res.status(500).json({ message: 'Scraping failed' });
    }
  });

  router.post('/papers/:id/analyze', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const paper = await database.getPaperById(id);

      if (!paper) {
        res.status(404).json({ message: 'Paper not found' });
        return;
      }

      if (paper.summary && paper.contribution) {
        res.json({
          message: 'Analysis retrieved from cache',
          analysis: {
            summary: paper.summary,
            contribution: paper.contribution,
            limitations: paper.limitations || 'Not explicitly stated'
          }
        });
        return;
      }

      const analysis = await services.generatePaperAnalysis(paper.title, paper.abstract);
      if (analysis) {
        await database.updatePaperSummary(id, analysis);
      }

      res.json({ message: 'Analysis generated', analysis });
    } catch (err) {
      console.error('Analysis error:', err);
      res.status(500).json({ message: 'Analysis failed' });
    }
  });

  router.post('/search/semantic', async (req, res) => {
    try {
      const { query, limit, filters } = req.body || {};

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ message: 'Query is required' });
        return;
      }

      const parsed = services.parseSearchQuery(query);
      const mergedFilters = {
        ...parsed.filters,
        ...(filters || {})
      };

      const result = await services.semanticSearchPapers({
        query: parsed.general || query,
        filters: mergedFilters,
        limit: Number(limit) || undefined
      });

      res.json({
        query,
        parsed,
        ...result
      });
    } catch (err) {
      console.error('Semantic search error:', err);
      res.status(500).json({ message: 'Semantic search failed' });
    }
  });

  router.post('/search/parse-query', async (req, res) => {
    try {
      const { query } = req.body || {};
      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ message: 'Query is required' });
        return;
      }

      const parsed = services.parseSearchQuery(query);
      const aiParsed = await services.parseSearchIntentWithAI(query);

      res.json({
        raw: parsed,
        ai: aiParsed
      });
    } catch (err) {
      console.error('Search query parsing error:', err);
      res.status(500).json({ message: 'Search query parsing failed' });
    }
  });

  router.post('/search/hybrid', async (req, res) => {
    try {
      const { query, limit, filters, weights } = req.body || {};

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ message: 'Query is required' });
        return;
      }

      const parsed = services.parseSearchQuery(query);
      const aiParsed = await services.parseSearchIntentWithAI(query);
      const mergedFilters = {
        ...parsed.filters,
        ...aiParsed.filters,
        ...(filters || {})
      };

      const result = await services.hybridSearchPapers({
        query: aiParsed.rewrittenQuery || parsed.general || query,
        filters: mergedFilters,
        keywords: aiParsed.keywords || [],
        focusAreas: aiParsed.focusAreas || [],
        excludeTerms: aiParsed.excludeTerms || [],
        timePreference: aiParsed.timePreference || 'balanced',
        weights,
        limit: Number(limit) || undefined
      });

      res.json({
        query,
        parsed,
        ai: aiParsed,
        ...result
      });
    } catch (err) {
      console.error('Hybrid search error:', err);
      res.status(500).json({ message: 'Hybrid search failed' });
    }
  });

  router.post('/recommendations', async (req, res) => {
    try {
      const { query = '', favorites = [], limit } = req.body || {};
      const result = await buildAiRecommendations({
        query: typeof query === 'string' ? query : '',
        favorites: Array.isArray(favorites) ? favorites : [],
        limit: Number(limit) || 6
      });

      res.json(result);
    } catch (err) {
      console.error('Recommendation error:', err);
      res.status(500).json({ message: 'Recommendation generation failed' });
    }
  });

  router.post('/recommendations/similar-paper', async (req, res) => {
    try {
      const { paperId, query = '', limit } = req.body || {};
      const targetPaperId = Number(paperId);

      if (!Number.isInteger(targetPaperId)) {
        res.status(400).json({ message: 'Valid paperId is required' });
        return;
      }

      const basePaper = await database.getPaperById(targetPaperId);
      if (!basePaper) {
        res.status(404).json({ message: 'Paper not found' });
        return;
      }

      const seedQuery = query || [basePaper.title, ...(basePaper.tags || [])].join(' ');
      const aiParsed = await services.parseSearchIntentWithAI(seedQuery);
      const vectorRecommendations = await services.recommendPapersFromFavorites({
        sourcePaperIds: [targetPaperId],
        query: aiParsed.rewrittenQuery || seedQuery,
        filters: aiParsed.filters || {},
        keywords: aiParsed.keywords || [],
        focusAreas: aiParsed.focusAreas || [],
        excludeTerms: aiParsed.excludeTerms || [],
        timePreference: aiParsed.timePreference || 'balanced',
        limit: Number(limit) || 6,
        reasonLabel: 'embedding similarity to this paper'
      });

      res.json({
        paperId: targetPaperId,
        paperTitle: basePaper.title,
        ai: aiParsed,
        items: vectorRecommendations.items,
        usedVectorRecommendations: vectorRecommendations.usedVectorRecommendations
      });
    } catch (err) {
      console.error('Similar paper recommendation error:', err);
      res.status(500).json({ message: 'Similar paper recommendation failed' });
    }
  });

  return router;
}

export default createPapersRouter();
