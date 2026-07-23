import express from 'express';
import { APP_VERSION, BUILD_TIME } from '../config.js';
import { getDbStatus, getVectorSearchStatus } from '../database.js';
import { EMBEDDING_PROVIDER, EMBEDDING_MODEL } from '../vector_config.js';

const router = express.Router();

router.get('/health', (_req, res) => {
  const vector = getVectorSearchStatus();
  res.status(200).json({
    status: 'ok',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    db: getDbStatus() ? 'connected' : 'disconnected',
    vector: {
      enabled: vector.enabled,
      model: EMBEDDING_MODEL,
      provider: EMBEDDING_PROVIDER,
      error: vector.error
    }
  });
});

router.get('/api/debug-version', (_req, res) => {
  res.json({
    version: APP_VERSION,
    build_time: BUILD_TIME
  });
});

export default router;
