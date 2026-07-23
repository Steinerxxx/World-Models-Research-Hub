import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.ADMIN_KEY = 'test-admin-key';

const { default: adminRouter } = await import('./admin.js');

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

test('GET /api/admin/vector-status requires admin key', async () => {
  const app = createJsonApp(adminRouter);
  const result = await requestJson(app, '/api/admin/vector-status');

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { message: 'Unauthorized: Admin key required' });
});

test('POST /api/admin/reindex-embeddings exposes readable error payload on failure', async () => {
  const failingRouter = express.Router();
  failingRouter.use(express.json());
  failingRouter.post('/admin/reindex-embeddings', (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      res.status(401).json({ message: 'Unauthorized: Admin key required' });
      return;
    }

    res.status(500).json({
      message: 'Embedding reindex failed',
      error: 'Embedding dimensions mismatch for model "text-embedding-v4". Expected 1536, received 1024.'
    });
  });

  const app = createJsonApp(failingRouter);
  const result = await requestJson(app, '/api/admin/reindex-embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'test-admin-key'
    }
  });

  assert.equal(result.status, 500);
  assert.equal(result.body.message, 'Embedding reindex failed');
  assert.match(result.body.error, /Expected 1536, received 1024/);
});
