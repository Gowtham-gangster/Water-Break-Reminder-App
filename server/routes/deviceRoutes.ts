import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const deviceRouter = Router();

// Get registered devices for current user
deviceRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const devices = db.getDevicesByUserId(userId);
  res.json({ devices });
});

// Register or Heartbeat Device
deviceRouter.post('/register', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { device_id, platform, device_name } = req.body;

  if (!device_id || !platform) {
    return res.status(400).json({ error: 'device_id and platform required' });
  }

  const device = db.registerDevice(userId, {
    device_id,
    platform,
    device_name: device_name || `${platform}-device`,
  });

  res.json({ device });
});
