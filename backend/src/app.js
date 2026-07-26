import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import adminRoutes from './routes/admin.js';
import authRoutes from './auth.js';
import chatRoutes from './routes/chat.js';
import favoritesRoutes from './favorites.js';
import healthRoutes from './routes/health.js';
import paperRoutes from './routes/papers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, '../../frontend/dist');

export function createApp() {
  const app = express();
  const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

  app.use(cors({
    origin: allowedOrigin,
    credentials: true
  }));
  app.use(express.json());

  app.use(healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/favorites', favoritesRoutes);
  app.use('/api', paperRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api', adminRoutes);

  app.use(express.static(frontendPath));

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({
        error: 'API endpoint not found',
        hint: 'The backend might be running an outdated version. Please redeploy on Sealos.',
        requested_path: req.path
      });
      return;
    }

    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  app.use((err, _req, res, _next) => {
    console.error('Unhandled Error:', err);
    res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error'
    });
  });

  return app;
}

export default createApp();
