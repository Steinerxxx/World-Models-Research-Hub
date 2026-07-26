import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, X, Star, AlertTriangle, Brain, Bot, Sparkles, SlidersHorizontal, Calendar, Users, Tag } from "lucide-react";
import { useFilter } from '@/contexts/FilterContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { PaperCard } from '@/components/PaperCard';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL, FRONTEND_VERSION } from '@/config';
import { fetchPapersWithFallback, fetchSimilarPaperRecommendations, hybridSearchPapers, semanticSearchPapers, triggerScrape } from '@/lib/api';
import { getPaginationPages } from '@/lib/papers';
import { SUBJECT_TAGS, ARCHITECTURE_TAGS } from '@/constants/tags';
import { usePaperBrowser } from '@/hooks/usePaperBrowser';
import type { Paper, ParseSearchQueryResponse, SearchFilters, SearchWeights, SemanticSearchResponse, SimilarPaperRecommendationResponse } from '@/types/paper';

const DEFAULT_HYBRID_WEIGHTS: SearchWeights = {
  semantic: 0.55,
  keyword: 0.3,
  recency: 0.15
};

const SEARCH_SETTINGS_KEY = 'ai-search-settings-v4';
const HYBRID_PRESETS: Array<{ key: string; label: string; weights: SearchWeights }> = [
  {
    key: 'balanced',
    label: 'Balanced',
    weights: DEFAULT_HYBRID_WEIGHTS
  },
  {
    key: 'semantic',
    label: 'Semantic First',
    weights: { semantic: 0.75, keyword: 0.15, recency: 0.1 }
  },
  {
    key: 'keyword',
    label: 'Keyword First',
    weights: { semantic: 0.35, keyword: 0.5, recency: 0.15 }
  },
  {
    key: 'recent',
    label: 'Recent First',
    weights: { semantic: 0.35, keyword: 0.2, recency: 0.45 }
  }
];

function formatWeight(value: number) {
  return `${Math.round(value * 100)}%`;
}

function sanitizeFilters(filters?: SearchFilters): SearchFilters {
  return {
    tag: filters?.tag?.trim() || undefined,
    author: filters?.author?.trim() || undefined,
    year: filters?.year?.trim() || undefined
  };
}

function filtersEqual(left: SearchFilters, right: SearchFilters) {
  return (left.tag || '') === (right.tag || '')
    && (left.author || '') === (right.author || '')
    && (left.year || '') === (right.year || '');
}

function weightsEqual(left: SearchWeights, right: SearchWeights) {
  return left.semantic === right.semantic
    && left.keyword === right.keyword
    && left.recency === right.recency;
}

function loadInitialSearchSettings() {
  try {
    const saved = localStorage.getItem(SEARCH_SETTINGS_KEY);
    if (!saved) {
      return {
        filters: {} as SearchFilters,
        weights: DEFAULT_HYBRID_WEIGHTS
      };
    }

    const parsed = JSON.parse(saved) as {
      filters?: SearchFilters;
      weights?: SearchWeights;
    };

    return {
      filters: sanitizeFilters(parsed.filters),
      weights: parsed.weights || DEFAULT_HYBRID_WEIGHTS
    };
  } catch (err) {
    console.warn('Failed to restore AI search settings:', err);
    return {
      filters: {} as SearchFilters,
      weights: DEFAULT_HYBRID_WEIGHTS
    };
  }
}

export default function Home() {
  const initialSettings = loadInitialSearchSettings();
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [fetchErrorDetail, setFetchErrorDetail] = useState<string>('');
  const [semanticResult, setSemanticResult] = useState<SemanticSearchResponse | null>(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [parsedIntent, setParsedIntent] = useState<ParseSearchQueryResponse | null>(null);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(initialSettings.filters);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(initialSettings.filters);
  const [draftHybridWeights, setDraftHybridWeights] = useState<SearchWeights>(initialSettings.weights);
  const [appliedHybridWeights, setAppliedHybridWeights] = useState<SearchWeights>(initialSettings.weights);
  const [similarPaperResult, setSimilarPaperResult] = useState<SimilarPaperRecommendationResponse | null>(null);
  const [isLoadingSimilarPapers, setIsLoadingSimilarPapers] = useState(false);
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');

  // Use context for filters
  const { searchTerm, setSearchTerm, searchMode, setSearchMode, selectedTags, setSelectedTags, toggleTag, itemsPerPage, sortBy } = useFilter();
  const { favorites, showFavoritesOnly, setShowFavoritesOnly } = useFavorites();

  const updateSearchTerm = (value: string) => {
    setSearchTerm(value);
  };

  const triggerSearch = () => {
    const trimmed = searchTerm.trim();
    setSubmittedSearchTerm(trimmed);
    if (!trimmed) {
      setSemanticResult(null);
      setParsedIntent(null);
    }
  };
  
  const [isLogoZoomed, setIsLogoZoomed] = useState(false);

  useEffect(() => {
    localStorage.setItem(SEARCH_SETTINGS_KEY, JSON.stringify({
      filters: appliedFilters,
      weights: appliedHybridWeights
    }));
  }, [appliedFilters, appliedHybridWeights]);

  const fetchPapers = async () => {
    setLoading(true);
    setFetchErrorDetail('');

    const result = await fetchPapersWithFallback();
    setAllPapers(result.data);
    setPapers(result.data);
    setUsingMockData(result.usingMockData);
    setFetchErrorDetail(result.errorDetail);
    setSemanticResult(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    const loadInitialPapers = async () => {
      const result = await fetchPapersWithFallback();
      setAllPapers(result.data);
      setPapers(result.data);
      setUsingMockData(result.usingMockData);
      setFetchErrorDetail(result.errorDetail);
      setSemanticResult(null);
      setError(null);
      setLoading(false);
    };

    void loadInitialPapers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    triggerScrape()
      .then(() => {
        fetchPapers();
      })
      .catch(err => {
        console.error('Error scraping papers:', err);
        fetchPapers();
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  useEffect(() => {
    const runSemanticSearch = async () => {
      if (searchMode !== 'semantic') {
        if (searchMode === 'keyword') {
          setPapers(allPapers);
          setSemanticResult(null);
          setParsedIntent(null);
          setError(null);
        }
        return;
      }

      const trimmed = submittedSearchTerm;
      if (!trimmed) {
        setPapers(allPapers);
        setSemanticResult(null);
        setParsedIntent(null);
        setError(null);
        return;
      }

      setIsSemanticSearching(true);
      try {
        const result = await semanticSearchPapers(trimmed, appliedFilters);
        setSemanticResult(result);
        setPapers(result.items);
        setUsingMockData(false);
        setFetchErrorDetail('');
        setError(null);
      } catch (err) {
        console.error('Semantic search failed:', err);
        setPapers(allPapers);
        setSemanticResult(null);
        setParsedIntent(null);
        setError('AI semantic search failed');
      } finally {
        setIsSemanticSearching(false);
      }
    };

    runSemanticSearch();
  }, [allPapers, appliedFilters, searchMode, submittedSearchTerm]);

  useEffect(() => {
    const runHybridSearch = async () => {
      if (searchMode !== 'hybrid') {
        if (searchMode === 'keyword') {
          setPapers(allPapers);
          setSemanticResult(null);
          setParsedIntent(null);
          setError(null);
        }
        return;
      }

      const trimmed = submittedSearchTerm;
      if (!trimmed) {
        setPapers(allPapers);
        setSemanticResult(null);
        setParsedIntent(null);
        setError(null);
        return;
      }

      setIsSemanticSearching(true);
      try {
        const result = await hybridSearchPapers(trimmed, appliedFilters, appliedHybridWeights);
        setParsedIntent(result.ai ? {
          raw: result.parsed,
          ai: result.ai
        } : null);
        setSemanticResult(result);
        setPapers(result.items);
        setUsingMockData(false);
        setFetchErrorDetail('');
        setError(null);
      } catch (err) {
        console.error('Hybrid search failed:', err);
        setPapers(allPapers);
        setParsedIntent(null);
        setSemanticResult(null);
        setError('AI hybrid search failed');
      } finally {
        setIsSemanticSearching(false);
      }
    };

    runHybridSearch();
  }, [allPapers, appliedFilters, appliedHybridWeights, searchMode, submittedSearchTerm]);

  const updateDraftFilter = (key: keyof SearchFilters, value: string) => {
    setDraftFilters(prev => ({
      ...prev,
      [key]: value.trim() || undefined
    }));
  };

  const applyDraftFilters = () => {
    setAppliedFilters(sanitizeFilters(draftFilters));
  };

  const clearStructuredFilters = () => {
    setDraftFilters({});
    setAppliedFilters({});
  };

  const applySuggestedFilters = () => {
    const nextFilters = sanitizeFilters(parsedIntent?.ai.filters);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  const updateDraftHybridWeight = (key: keyof SearchWeights, value: number) => {
    setDraftHybridWeights(prev => ({
      ...prev,
      [key]: value / 100
    }));
  };

  const applyDraftHybridWeights = () => {
    setAppliedHybridWeights(draftHybridWeights);
  };

  const applyHybridPreset = (weights: SearchWeights) => {
    setDraftHybridWeights(weights);
    setAppliedHybridWeights(weights);
  };

  const resetHybridWeights = () => {
    setDraftHybridWeights(DEFAULT_HYBRID_WEIGHTS);
    setAppliedHybridWeights(DEFAULT_HYBRID_WEIGHTS);
  };

  const hasPendingFilterChanges = !filtersEqual(draftFilters, appliedFilters);
  const hasPendingWeightChanges = !weightsEqual(draftHybridWeights, appliedHybridWeights);

  const handlePaperUpdate = (updatedPaper: Paper) => {
    setAllPapers(prevPapers =>
      prevPapers.map(p => p.id === updatedPaper.id ? updatedPaper : p)
    );
    setPapers(prevPapers => 
      prevPapers.map(p => p.id === updatedPaper.id ? updatedPaper : p)
    );
  };

  const handleRecommendSimilar = async (paper: Paper) => {
    setIsLoadingSimilarPapers(true);
    try {
      const result = await fetchSimilarPaperRecommendations(paper.id, paper.title, 6);
      setSimilarPaperResult(result);
    } catch (err) {
      console.error('Similar paper recommendations failed:', err);
      setSimilarPaperResult(null);
    } finally {
      setIsLoadingSimilarPapers(false);
    }
  };

  const {
    allHighlights,
    currentPage,
    currentPapers,
    filteredPapers,
    inputPage,
    setInputPage,
    totalPages,
    handleGoToPage,
    handlePageChange,
    copyBibTeX
  } = usePaperBrowser({
    papers,
    searchTerm,
    highlightTerm: searchMode === 'keyword' ? undefined : (semanticResult?.ai?.rewrittenQuery || semanticResult?.parsed.general || searchTerm),
    selectedTags,
    itemsPerPage,
    sortBy,
    favorites,
    showFavoritesOnly,
    disableTextSearch: searchMode !== 'keyword'
  });

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="mb-8 space-y-4 relative">
        {/* Tongji University Logo - Top Right */}
        <div className="absolute -top-6 -right-2 md:right-0 z-10 hidden sm:block">
          <motion.div 
            layoutId="tongji-logo"
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white rounded-full p-2 shadow-lg w-16 h-16 md:w-20 md:h-20 flex items-center justify-center overflow-hidden cursor-pointer will-change-transform"
            onClick={() => setIsLogoZoomed(true)}
          >
            <img 
              src="/tongji-logo.png" 
              alt="Tongji University Logo" 
              className="w-full h-full object-contain"
            />
          </motion.div>
        </div>

        <div className="flex flex-col items-center justify-center gap-6 text-center">
          <div className="px-4 md:px-0">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
              World Models Research Hub
            </h1>
            <div className="flex flex-col items-center gap-2 mt-2">
              <p className="text-muted-foreground text-lg sm:text-xl max-w-3xl mx-auto leading-relaxed">
                Tracking the latest advancements in <span className="text-foreground font-medium whitespace-nowrap">World Models</span> and <span className="text-foreground font-medium whitespace-nowrap">Model-Based RL</span>
              </p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-sm">
                {FRONTEND_VERSION}
              </span>
            </div>
          </div>
          
          {/* Debug Info / Offline Banner */}
          {usingMockData && (
            <div className="w-full max-w-2xl mx-auto bg-amber-50 border-l-4 border-amber-500 p-4 text-left">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-700">
                    <span className="font-bold">Backend Connection Issue.</span> Showing offline cached data.
                    <br/>
                    <span className="text-xs font-mono mt-1 block opacity-75">
                      Target: {API_BASE_URL} | Error: {fetchErrorDetail}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="gap-2 w-full max-w-xs mx-auto bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90 hover:shadow-lg transition-all duration-300"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>
      </header>
      
      <div className="mb-10 max-w-4xl mx-auto space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            type="text"
            placeholder={searchMode === 'keyword' ? 'Search by title, authors, or abstract...' : 'Describe what kind of papers you want...'}
            className="w-full pl-10 pr-24 py-6 text-lg bg-background/50 border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50 rounded-xl shadow-lg backdrop-blur-sm transition-all duration-300"
            value={searchTerm}
            onChange={(e) => updateSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') triggerSearch(); }}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={triggerSearch}
              className="text-muted-foreground hover:text-primary p-2 rounded-full hover:bg-primary/10 transition-colors"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            {searchTerm && (
              <button
                onClick={() => { updateSearchTerm(''); setSubmittedSearchTerm(''); }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant={searchMode === 'keyword' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchMode('keyword')}
            className="rounded-full"
          >
            <Search className="h-4 w-4 mr-1.5" />
            Keyword Search
          </Button>
          <Button
            variant={searchMode === 'semantic' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchMode('semantic')}
            className="rounded-full"
          >
            <Brain className="h-4 w-4 mr-1.5" />
            AI Semantic Search
          </Button>
          <Button
            variant={searchMode === 'hybrid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSearchMode('hybrid')}
            className="rounded-full"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Hybrid Search
          </Button>
        </div>
        {(searchMode === 'semantic' || searchMode === 'hybrid') && (
          <div className="space-y-4 text-center text-sm text-muted-foreground">
            <p>Use natural language to describe the papers you want. Example: recent robot world model papers focused on planning.</p>
            {semanticResult && (
              <p>
                Search source: {semanticResult.status.enabled ? 'pgvector semantic retrieval' : 'fallback semantic matching'}
                {semanticResult.usedFallbackEmbedding ? ' (fallback mode)' : ''}
              </p>
            )}
            <div className="mx-auto grid max-w-3xl gap-4 text-left md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="mb-3 flex items-center gap-2 font-medium text-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                  Structured Filters
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />
                      Tag
                    </span>
                    <Input
                      value={draftFilters.tag || ''}
                      onChange={(e) => updateDraftFilter('tag', e.target.value)}
                      placeholder="robotics"
                      className="h-9"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Author
                    </span>
                    <Input
                      value={draftFilters.author || ''}
                      onChange={(e) => updateDraftFilter('author', e.target.value)}
                      placeholder="Hafner"
                      className="h-9"
                    />
                  </label>
                  <label className="grid gap-1 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Year
                    </span>
                    <Input
                      value={draftFilters.year || ''}
                      onChange={(e) => updateDraftFilter('year', e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                      placeholder="2025"
                      className="h-9"
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Applied: {[
                        appliedFilters.tag ? `tag=${appliedFilters.tag}` : '',
                        appliedFilters.author ? `author=${appliedFilters.author}` : '',
                        appliedFilters.year ? `year=${appliedFilters.year}` : ''
                      ].filter(Boolean).join(' · ') || 'none'}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={clearStructuredFilters} className="h-8 px-2 text-xs">
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={applyDraftFilters}
                        disabled={!hasPendingFilterChanges}
                        className="h-8 px-3 text-xs"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                  {hasPendingFilterChanges && (
                    <p className="text-xs text-amber-600">You have unapplied filter changes.</p>
                  )}
                </div>
              </div>
              {searchMode === 'hybrid' && (
                <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                  <div className="mb-3 flex items-center gap-2 font-medium text-foreground">
                    <Sparkles className="h-4 w-4" />
                    Hybrid Weights
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {HYBRID_PRESETS.map((preset) => (
                      <Button
                        key={preset.key}
                        variant={weightsEqual(appliedHybridWeights, preset.weights) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => applyHybridPreset(preset.weights)}
                        className="h-8 rounded-full px-3 text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <label className="grid gap-1 text-xs">
                      <span className="flex items-center justify-between text-muted-foreground">
                        <span>Semantic</span>
                        <span>{formatWeight(draftHybridWeights.semantic)}</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(draftHybridWeights.semantic * 100)}
                        onChange={(e) => updateDraftHybridWeight('semantic', Number(e.target.value))}
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="flex items-center justify-between text-muted-foreground">
                        <span>Keyword</span>
                        <span>{formatWeight(draftHybridWeights.keyword)}</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(draftHybridWeights.keyword * 100)}
                        onChange={(e) => updateDraftHybridWeight('keyword', Number(e.target.value))}
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="flex items-center justify-between text-muted-foreground">
                        <span>Recency</span>
                        <span>{formatWeight(draftHybridWeights.recency)}</span>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(draftHybridWeights.recency * 100)}
                        onChange={(e) => updateDraftHybridWeight('recency', Number(e.target.value))}
                      />
                    </label>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        Applied: {semanticResult?.weights ? `${formatWeight(semanticResult.weights.semantic)} / ${formatWeight(semanticResult.weights.keyword)} / ${formatWeight(semanticResult.weights.recency)}` : `${formatWeight(appliedHybridWeights.semantic)} / ${formatWeight(appliedHybridWeights.keyword)} / ${formatWeight(appliedHybridWeights.recency)}`}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={resetHybridWeights} className="h-8 px-2 text-xs">
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          onClick={applyDraftHybridWeights}
                          disabled={!hasPendingWeightChanges}
                          className="h-8 px-3 text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                    {hasPendingWeightChanges && (
                      <p className="text-xs text-amber-600">You have unapplied weight changes.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {parsedIntent?.ai && (
              <div className="mx-auto max-w-3xl rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
                <div className="flex items-center gap-2 text-primary font-medium mb-2">
                  <Bot className="h-4 w-4" />
                  AI Query Interpretation
                </div>
                <p className="text-foreground/90">{parsedIntent.ai.explanation}</p>
                <p className="mt-2 text-xs">
                  Rewritten query: <span className="font-medium text-foreground">{parsedIntent.ai.rewrittenQuery}</span>
                </p>
                {parsedIntent.ai.keywords.length > 0 && (
                  <p className="mt-1 text-xs">
                    Keywords: <span className="font-medium text-foreground">{parsedIntent.ai.keywords.join(', ')}</span>
                  </p>
                )}
                {(parsedIntent.ai.filters.tag || parsedIntent.ai.filters.author || parsedIntent.ai.filters.year) && (
                  <>
                    <p className="mt-1 text-xs">
                      Suggested filters:
                      <span className="font-medium text-foreground">
                        {[
                          parsedIntent.ai.filters.tag ? ` tag=${parsedIntent.ai.filters.tag}` : '',
                          parsedIntent.ai.filters.author ? ` author=${parsedIntent.ai.filters.author}` : '',
                          parsedIntent.ai.filters.year ? ` year=${parsedIntent.ai.filters.year}` : ''
                        ].join('')}
                      </span>
                    </p>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={applySuggestedFilters} className="h-8 px-3 text-xs">
                        Apply Suggested Filters
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Active Filter Indicator */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center items-center gap-2">
            {showFavoritesOnly && (
              <div className="flex justify-center items-center gap-2">
                <span className="text-sm text-muted-foreground">Showing:</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFavoritesOnly(false)}
                  className="rounded-full flex items-center gap-2 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border border-yellow-500/20"
                >
                  <Star className="h-3 w-3 fill-current" />
                  Favorites Only <span className="ml-1 text-xs">×</span>
                </Button>
              </div>
            )}
            
            {selectedTags.length > 0 && selectedTags.map(tag => {
              let tagStyle = "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"; // Default
              
              if (SUBJECT_TAGS.includes(tag)) {
                tagStyle = "bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 border-cyan-500/20";
              } else if (ARCHITECTURE_TAGS.includes(tag)) {
                tagStyle = "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/20";
              } else {
                // Style for dynamic AI-generated tags (Emerging Topics)
                tagStyle = "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20";
              }

              return (
                <Button
                  key={tag}
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))}
                  className={`rounded-full h-7 text-xs border ${tagStyle}`}
                >
                  {tag} <span className="ml-1 text-xs">×</span>
                </Button>
              );
            })}
            
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTags([])}
                className="h-7 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors flex items-center gap-1.5"
              >
                <X className="h-3 w-3" />
                Clear All
              </Button>
            )}
          </div>
          {!loading && !error && (
            <p className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
              {isSemanticSearching ? 'Running semantic search...' : `Found ${filteredPapers.length} papers`}
            </p>
          )}
        </div>
      </div>

      <main>
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-lg text-muted-foreground">Loading papers...</p>
          </div>
        )}
        
        {error && (
          <div className="text-center py-20">
            <p className="text-red-400 text-lg bg-red-950/30 py-4 px-6 rounded-lg inline-block border border-red-900/50">
              Error: {error}
            </p>
          </div>
        )}
        
        {!loading && !error && (
          <>
            {(similarPaperResult || isLoadingSimilarPapers) && (
              <section className="mb-10 rounded-2xl border border-border/60 bg-card/60 p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <Brain className="h-4 w-4" />
                      Similar Papers
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {similarPaperResult
                        ? `基于论文《${similarPaperResult.paperTitle}》的相似论文推荐`
                        : '正在生成相似论文推荐'}
                    </p>
                  </div>
                  {isLoadingSimilarPapers && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading
                    </div>
                  )}
                  {similarPaperResult && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSimilarPaperResult(null)}
                      className="h-7 px-2 text-xs text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {similarPaperResult && similarPaperResult.items.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {similarPaperResult.items.map((paper) => (
                      <div key={`similar-${paper.id}`} className="space-y-2">
                        {paper.match_reasons && paper.match_reasons.length > 0 && (
                          <div className="rounded-lg border border-primary/15 bg-background/70 px-3 py-2 text-xs text-left text-muted-foreground">
                            <span className="font-medium text-foreground">Why similar:</span> {paper.match_reasons.join(' · ')}
                          </div>
                        )}
                        <PaperCard
                          paper={paper}
                          allHighlights={paper.match_reasons || []}
                          selectedTags={selectedTags}
                          toggleTag={toggleTag}
                          setSearchTerm={updateSearchTerm}
                          copyBibTeX={copyBibTeX}
                          onPaperUpdate={handlePaperUpdate}
                          onRecommendSimilar={handleRecommendSimilar}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  !isLoadingSimilarPapers && (
                    <p className="text-sm text-muted-foreground">No similar papers were found for this item yet.</p>
                  )
                )}
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentPapers.map(paper => (
                <div key={paper.id} className="space-y-2">
                  {(searchMode === 'semantic' || searchMode === 'hybrid') && paper.match_reasons && paper.match_reasons.length > 0 && (
                    <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-left text-muted-foreground">
                      <span className="font-medium text-foreground">Why it matched:</span> {paper.match_reasons.join(' · ')}
                    </div>
                  )}
                  <PaperCard 
                    paper={paper} 
                    allHighlights={allHighlights}
                    selectedTags={selectedTags}
                    toggleTag={toggleTag}
                    setSearchTerm={updateSearchTerm}
                    copyBibTeX={copyBibTeX}
                    onPaperUpdate={handlePaperUpdate}
                    onRecommendSimilar={handleRecommendSimilar}
                  />
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {filteredPapers.length > itemsPerPage && (
              <div className="flex flex-col sm:flex-row justify-center items-center mt-12 gap-4 sm:gap-2">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="bg-card border-border text-foreground hover:text-primary hover:border-primary/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {getPaginationPages(currentPage, totalPages).map((page, index) => (
                    <Button
                      key={index}
                      variant={page === currentPage ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => typeof page === 'number' && handlePageChange(page)}
                      disabled={page === '...'}
                      className={`min-w-[2.5rem] ${
                        page === currentPage 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                          : 'bg-card border-border text-foreground hover:text-primary hover:border-primary/50'
                      } ${page === '...' ? 'cursor-default hover:bg-card hover:text-muted-foreground' : ''}`}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="bg-card border-border text-foreground hover:text-primary hover:border-primary/50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Jump to Page Input */}
                <div className="flex items-center gap-2 sm:ml-4 sm:pl-4 sm:border-l border-border/50 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 w-full sm:w-auto justify-center sm:justify-start">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Go to:</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={inputPage}
                    onChange={(e) => setInputPage(e.target.value)}
                    placeholder="#"
                    className="w-16 h-8 text-center px-1 bg-card/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleGoToPage();
                      }
                    }}
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleGoToPage}
                    disabled={!inputPage || parseInt(inputPage) < 1 || parseInt(inputPage) > totalPages}
                    className="h-8 px-3"
                  >
                    Go
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        
        {!loading && !error && filteredPapers.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-xl">No papers found matching your search.</p>
          </div>
        )}
      </main>
      
      <footer className="text-center text-muted-foreground py-8 text-sm mt-12 border-t border-border/50 space-y-2">
        <p className="max-w-2xl mx-auto px-4 opacity-80">
          * Note: Dates are displayed based on the original arXiv submission/announcement time (UTC) to ensure consistency across time zones.
        </p>
        <p>&copy; {new Date().getFullYear()} World Models Research Hub. All rights reserved.</p>
      </footer>

      {/* Logo Zoom Modal */}
      <AnimatePresence mode="wait">
        {isLogoZoomed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setIsLogoZoomed(false)}
          >
            <div className="relative w-full max-w-lg flex flex-col items-center justify-center">
              <div className="relative w-full aspect-square flex items-center justify-center">
                <motion.div
                  layoutId="tongji-logo"
                  transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
                  className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden cursor-pointer shadow-2xl will-change-transform"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={() => window.open('https://www.tongji.edu.cn/', '_blank')}
                >
                  <img 
                    src="/tongji-logo.png" 
                    alt="Tongji University Logo" 
                    className="w-full h-full object-contain p-4"
                  />
                </motion.div>
                <button 
                  onClick={() => setIsLogoZoomed(false)}
                  className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
              <p className="text-white/80 mt-4 text-sm font-medium">Double click logo to visit website</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
