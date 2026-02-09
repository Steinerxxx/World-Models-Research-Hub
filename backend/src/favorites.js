import express from 'express';
import { query } from './database.js';
import { verifyToken } from './auth.js';

const router = express.Router();

router.use(verifyToken); // All favorite routes require auth

// Get user favorites (returns list of paper IDs)
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT paper_id FROM favorites WHERE user_id = $1', [req.user.id]);
    res.json(result.rows.map(row => row.paper_id));
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).json({ message: 'Error fetching favorites' });
  }
});

// Add favorite
router.post('/:id', async (req, res) => {
  const paperId = parseInt(req.params.id);
  if (isNaN(paperId)) return res.status(400).json({ message: 'Invalid paper ID' });

  try {
    await query(
      'INSERT INTO favorites (user_id, paper_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, paperId]
    );
    res.json({ message: 'Added to favorites' });
  } catch (err) {
    console.error('Error adding favorite:', err);
    res.status(500).json({ message: 'Error adding favorite' });
  }
});

// Remove favorite
router.delete('/:id', async (req, res) => {
  const paperId = parseInt(req.params.id);
  if (isNaN(paperId)) return res.status(400).json({ message: 'Invalid paper ID' });

  try {
    await query(
      'DELETE FROM favorites WHERE user_id = $1 AND paper_id = $2',
      [req.user.id, paperId]
    );
    res.json({ message: 'Removed from favorites' });
  } catch (err) {
    console.error('Error removing favorite:', err);
    res.status(500).json({ message: 'Error removing favorite' });
  }
});

export default router;
