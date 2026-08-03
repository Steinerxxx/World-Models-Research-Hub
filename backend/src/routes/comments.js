import express from 'express';
import { verifyToken } from '../auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { getPaperComments, addPaperComment, deletePaperComment } from '../database.js';

const router = express.Router();

router.get('/papers/:id/comments', optionalAuth, async (req, res) => {
  try {
    const comments = await getPaperComments(req.params.id);
    const currentUserId = req.user?.id;
    res.json({
      comments: comments.map(c => ({
        ...c,
        is_owner: currentUserId != null && c.user_id === currentUserId
      }))
    });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ message: 'Failed to get comments' });
  }
});

router.post('/papers/:id/comments', verifyToken, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });
  if (content.length > 2000) return res.status(400).json({ message: 'Comment is too long (max 2000 characters)' });

  try {
    const comment = await addPaperComment(req.params.id, req.user.id, content.trim());
    res.status(201).json({ ...comment, username: req.user.username, is_owner: true });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

router.delete('/papers/comments/:id', verifyToken, async (req, res) => {
  try {
    const deleted = await deletePaperComment(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ message: 'Comment not found' });
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

export default router;
