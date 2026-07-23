import { API_BASE_URL } from '@/config';
import { MOCK_PAPERS } from '@/data/mockData';
import { buildTagCounts, filterNoiseTags, normalizeTagCounts } from '@/lib/papers';
import type { Paper, ParseSearchQueryResponse, RecommendationResponse, SearchFilters, SearchWeights, SemanticSearchResponse, SimilarPaperRecommendationResponse, TagCount } from '@/types/paper';

interface ApiResult<T> {
  data: T;
  usingMockData: boolean;
  errorDetail: string;
}

function getErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Network Error';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchPapersWithFallback(): Promise<ApiResult<Paper[]>> {
  try {
    const papers = await requestJson<Paper[]>('/api/papers');
    return {
      data: filterNoiseTags(papers),
      usingMockData: false,
      errorDetail: ''
    };
  } catch (error) {
    return {
      data: MOCK_PAPERS,
      usingMockData: true,
      errorDetail: getErrorDetail(error)
    };
  }
}

export async function fetchTrendsWithFallback(): Promise<ApiResult<Paper[]>> {
  try {
    const papers = await requestJson<Paper[]>(`/api/papers/trends?t=${Date.now()}`);
    return {
      data: papers,
      usingMockData: false,
      errorDetail: ''
    };
  } catch (error) {
    return {
      data: MOCK_PAPERS,
      usingMockData: true,
      errorDetail: getErrorDetail(error)
    };
  }
}

export async function fetchTagsWithFallback(): Promise<ApiResult<TagCount[]>> {
  try {
    const tags = await requestJson<Array<TagCount | string>>(`/api/tags?t=${Date.now()}`);
    return {
      data: normalizeTagCounts(tags),
      usingMockData: false,
      errorDetail: ''
    };
  } catch (error) {
    return {
      data: buildTagCounts(MOCK_PAPERS),
      usingMockData: true,
      errorDetail: getErrorDetail(error)
    };
  }
}

export async function fetchHealthVersion(): Promise<string | null> {
  try {
    const data = await requestJson<{ version?: string }>('/health');
    return data.version || null;
  } catch {
    return null;
  }
}

export async function triggerScrape(): Promise<void> {
  await requestJson('/api/scrape', { method: 'POST' });
}

export async function analyzePaper(id: number): Promise<Partial<Paper> | null> {
  const data = await requestJson<{ analysis?: Partial<Paper> }>(`/api/papers/${id}/analyze`, {
    method: 'POST'
  });
  return data.analysis || null;
}

export async function semanticSearchPapers(query: string, filters: SearchFilters = {}): Promise<SemanticSearchResponse> {
  return requestJson<SemanticSearchResponse>('/api/search/semantic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, filters })
  });
}

export async function hybridSearchPapers(
  query: string,
  filters: SearchFilters = {},
  weights?: Partial<SearchWeights>
): Promise<SemanticSearchResponse> {
  return requestJson<SemanticSearchResponse>('/api/search/hybrid', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, filters, weights })
  });
}

export async function parseSearchQueryWithAI(query: string): Promise<ParseSearchQueryResponse> {
  return requestJson<ParseSearchQueryResponse>('/api/search/parse-query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
}

export async function fetchAiRecommendations(
  query: string,
  favorites: number[] = [],
  limit = 6
): Promise<RecommendationResponse> {
  return requestJson<RecommendationResponse>('/api/recommendations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, favorites, limit })
  });
}

export async function fetchSimilarPaperRecommendations(
  paperId: number,
  query = '',
  limit = 6
): Promise<SimilarPaperRecommendationResponse> {
  return requestJson<SimilarPaperRecommendationResponse>('/api/recommendations/similar-paper', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ paperId, query, limit })
  });
}
