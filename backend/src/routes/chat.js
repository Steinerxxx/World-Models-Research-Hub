import express from 'express';
import { chatWithAgent } from '../chat_service.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, favorites = [], context = '', history = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await chatWithAgent(message.trim(), favorites, context, history);
    res.json(result);
  } catch (err) {
    console.error('Chat agent error:', err);
    res.status(500).json({ error: 'Agent failed to process your request' });
  }
});

export default router;
