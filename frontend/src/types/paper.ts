export interface Paper {
  id: number;
  title: string;
  authors: string[];
  abstract: string;
  publication_date: string;
  url: string;
  tags?: string[];
  summary?: string;
  contribution?: string;
  limitations?: string;
  similarity?: number;
  semantic_score?: number;
  keyword_score?: number;
  recency_score?: number;
  hybrid_score?: number;
  match_reasons?: string[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface SearchFilters {
  tag?: string;
  author?: string;
  year?: string;
}

export interface SearchWeights {
  semantic: number;
  keyword: number;
  recency: number;
}

export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export interface ParsedSearchIntent {
  query: string;
  intent: string;
  rewrittenQuery: string;
  filters: SearchFilters;
  keywords: string[];
  focusAreas?: string[];
  excludeTerms?: string[];
  timePreference?: 'recent' | 'balanced' | 'classic';
  explanation: string;
}

export interface SemanticSearchResponse {
  query: string;
  parsed: {
    general: string;
    filters: SearchFilters;
  };
  items: Paper[];
  weights?: SearchWeights;
  usedFallbackEmbedding: boolean;
  status: {
    enabled: boolean;
    dimensions?: number;
    model?: string;
    error?: string | null;
  };
  ai?: ParsedSearchIntent;
}

export interface ParseSearchQueryResponse {
  raw: {
    general: string;
    filters: SearchFilters;
  };
  ai: ParsedSearchIntent;
}

export interface RecommendationResponse {
  query: string;
  ai: ParsedSearchIntent;
  items: Paper[];
  basedOnFavorites: boolean;
  usedVectorRecommendations?: boolean;
}

export interface SimilarPaperRecommendationResponse {
  paperId: number;
  paperTitle: string;
  ai: ParsedSearchIntent;
  items: Paper[];
  usedVectorRecommendations?: boolean;
}
