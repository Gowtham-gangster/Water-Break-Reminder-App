import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const waterConfigRouter = Router();

// Get Water Configuration (Strictly scoped to authenticated user)
waterConfigRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const config = db.getWaterConfigByUserId(userId) || db.upsertWaterConfig(userId, {});
  res.json({ config });
});

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Update Water Configuration (Strictly scoped to authenticated user)
waterConfigRouter.put('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { enabled, interval_minutes, start_time, end_time, duration_seconds, active_days } = req.body;

  // Validation 1: Interval must be positive integer (> 0)
  if (interval_minutes !== undefined) {
    if (typeof interval_minutes !== 'number' || interval_minutes <= 0 || !Number.isFinite(interval_minutes)) {
      return res.status(400).json({ error: 'Interval must be a positive number greater than 0 minutes' });
    }
  }

  // Validation 2: Duration must be positive integer (> 0)
  if (duration_seconds !== undefined) {
    if (typeof duration_seconds !== 'number' || duration_seconds <= 0 || !Number.isFinite(duration_seconds)) {
      return res.status(400).json({ error: 'Reminder duration must be a positive number greater than 0' });
    }
  }

  // Validation 3: Time formats (HH:mm)
  if (start_time !== undefined && (!TIME_REGEX.test(start_time) || typeof start_time !== 'string')) {
    return res.status(400).json({ error: 'Start time must be a valid 24-hour time format (HH:mm)' });
  }

  if (end_time !== undefined && (!TIME_REGEX.test(end_time) || typeof end_time !== 'string')) {
    return res.status(400).json({ error: 'End time must be a valid 24-hour time format (HH:mm)' });
  }

  // Validation 4: Start time must precede End time
  const currentConfig = db.getWaterConfigByUserId(userId);
  const effectiveStart = start_time || currentConfig?.start_time || '09:00';
  const effectiveEnd = end_time || currentConfig?.end_time || '18:00';
  const [sH, sM] = effectiveStart.split(':').map(Number);
  const [eH, eM] = effectiveEnd.split(':').map(Number);
  const startMins = sH * 60 + sM;
  const endMins = eH * 60 + eM;

  if (startMins >= endMins) {
    return res.status(400).json({ error: 'End time must be later than start time' });
  }

  // Validation 5: Active days must be valid array of days 0-6
  if (active_days !== undefined) {
    if (!Array.isArray(active_days) || active_days.length === 0 || !active_days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return res.status(400).json({ error: 'Active days must be a non-empty array of day numbers (0 for Sunday through 6 for Saturday)' });
    }
  }

  const config = db.upsertWaterConfig(userId, {
    ...(enabled !== undefined && { enabled }),
    ...(interval_minutes !== undefined && { interval_minutes }),
    ...(start_time !== undefined && { start_time }),
    ...(end_time !== undefined && { end_time }),
    ...(duration_seconds !== undefined && { duration_seconds }),
    ...(active_days !== undefined && { active_days }),
  });

  res.json({ config });
});
