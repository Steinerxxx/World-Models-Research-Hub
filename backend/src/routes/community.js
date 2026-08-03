import express from 'express';
import { verifyToken } from '../auth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import {
  getCommunityPosts,
  getCommunityPost,
  addCommunityPost,
  deleteCommunityPost,
  addCommunityReply,
  deleteCommunityReply
} from '../database.js';

const router = express.Router();

router.get('/community/posts', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const result = await getCommunityPosts(page, limit);
    res.json(result);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ message: 'Failed to get posts' });
  }
});

router.get('/community/posts/:id', optionalAuth, async (req, res) => {
  try {
    const post = await getCommunityPost(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const currentUserId = req.user?.id;
    res.json({
      ...post,
      is_owner: currentUserId != null && post.user_id === currentUserId,
      replies: post.replies.map(r => ({
        ...r,
        is_owner: currentUserId != null && r.user_id === currentUserId
      }))
    });
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ message: 'Failed to get post' });
  }
});

router.post('/community/posts', verifyToken, async (req, res) => {
  const { title, content } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: 'Title and content are required' });
  }
  if (title.length > 200) return res.status(400).json({ message: 'Title is too long (max 200 characters)' });
  if (content.length > 5000) return res.status(400).json({ message: 'Content is too long (max 5000 characters)' });
  try {
    const post = await addCommunityPost(req.user.id, title.trim(), content.trim());
    res.status(201).json({ ...post, username: req.user.username, reply_count: 0 });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

router.delete('/community/posts/:id', verifyToken, async (req, res) => {
  try {
    const deleted = await deleteCommunityPost(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ message: 'Post not found' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ message: 'Failed to delete post' });
  }
});

router.post('/community/posts/:id/replies', verifyToken, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });
  if (content.length > 2000) return res.status(400).json({ message: 'Reply is too long (max 2000 characters)' });
  try {
    const reply = await addCommunityReply(req.params.id, req.user.id, content.trim());
    res.status(201).json({ ...reply, username: req.user.username, is_owner: true });
  } catch (err) {
    console.error('Add reply error:', err);
    res.status(500).json({ message: 'Failed to add reply' });
  }
});

router.delete('/community/replies/:id', verifyToken, async (req, res) => {
  try {
    const deleted = await deleteCommunityReply(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ message: 'Reply not found' });
    res.json({ message: 'Reply deleted' });
  } catch (err) {
    console.error('Delete reply error:', err);
    res.status(500).json({ message: 'Failed to delete reply' });
  }
});

export default router;
