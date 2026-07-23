export const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.AI_API_KEY || '';
export const EMBEDDING_BASE_URL = process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1';
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
export const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || (process.env.EMBEDDING_API_KEY ? 'external-api' : 'fallback-local');
export const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 1536);
export const EMBEDDING_VERSION = process.env.EMBEDDING_VERSION || 'v1';
export const VECTOR_SEARCH_TOP_K = Number(process.env.VECTOR_SEARCH_TOP_K || 24);

export function getEmbeddingConfigSummary() {
  return {
    provider: EMBEDDING_PROVIDER,
    baseUrl: EMBEDDING_BASE_URL,
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    apiConfigured: Boolean(EMBEDDING_API_KEY)
  };
}
