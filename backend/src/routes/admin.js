import express from 'express';
import { classifyPaper } from '../classifier.js';
import {
  getAllPapers,
  seedMockData,
  updatePaperTags
} from '../database.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getVectorSearchOverview, indexPaperEmbeddings } from '../vector_service.js';

const router = express.Router();

router.post('/admin/seed', adminAuth, async (_req, res) => {
  try {
    await seedMockData();
    res.json({ message: 'Database seeded successfully' });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ message: 'Seed failed' });
  }
});

router.post('/reclassify', adminAuth, async (_req, res) => {
  try {
    const papers = await getAllPapers();
    let count = 0;

    for (const paper of papers) {
      const tags = await classifyPaper(paper.title, paper.abstract);
      await updatePaperTags(paper.id, tags);
      count += 1;
    }

    res.json({
      message: 'Reclassification completed successfully',
      processed_count: count
    });
  } catch (err) {
    console.error('Error reclassifying papers:', err);
    res.status(500).json({ message: 'Failed to reclassify papers' });
  }
});

router.post('/admin/reindex-embeddings', adminAuth, async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await indexPaperEmbeddings({ force, limit });
    res.json({
      message: 'Embedding reindex completed',
      ...result
    });
  } catch (err) {
    console.error('Embedding reindex error:', err);
    res.status(500).json({
      message: 'Embedding reindex failed',
      error: err.message
    });
  }
});

router.get('/admin/vector-status', adminAuth, async (_req, res) => {
  try {
    const status = await getVectorSearchOverview();
    res.json(status);
  } catch (err) {
    console.error('Vector status error:', err);
    res.status(500).json({ message: 'Failed to get vector status' });
  }
});

export default router;
