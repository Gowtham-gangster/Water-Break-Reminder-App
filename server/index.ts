import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/authRoutes.ts';
import { settingsRouter } from './routes/settingsRoutes.ts';
import { waterConfigRouter } from './routes/waterConfigRoutes.ts';
import { lookOutsideConfigRouter } from './routes/lookOutsideConfigRoutes.ts';
import { reminderRouter } from './routes/reminderRoutes.ts';
import { deviceRouter } from './routes/deviceRoutes.ts';
import { syncRouter } from './routes/syncRoutes.ts';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      version: '2.0.0-beta',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/water', waterConfigRouter);
  app.use('/api/look-outside', lookOutsideConfigRouter);
  app.use('/api/reminders', reminderRouter);
  app.use('/api/devices', deviceRouter);
  app.use('/api/sync', syncRouter);

  return app;
}

// If executed directly
if (process.argv[1] && (process.argv[1].endsWith('server/index.ts') || process.argv[1].endsWith('server\\index.ts')) && process.env.NODE_ENV !== 'test') {
  const app = createServer();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[EyeFlow V2 Server] Listening on http://localhost:${PORT}`);
  });
}
