import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const settingsRouter = Router();

// Get User Settings (Strictly scoped to authenticated user)
settingsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const settings = db.getSettingsByUserId(userId) || db.upsertSettings(userId, {});
  res.json({ settings });
});

// Update User Settings (Strictly scoped to authenticated user)
settingsRouter.put('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const {
    theme,
    time_format,
    timezone,
    sound_enabled,
    notifications_enabled,
    water_sound,
    look_outside_sound,
    water_default_duration,
    look_outside_default_duration,
    pause_until,
    pause_minutes,
  } = req.body;

  const settings = db.upsertSettings(userId, {
    ...(theme !== undefined && { theme }),
    ...(time_format !== undefined && { time_format }),
    ...(timezone !== undefined && { timezone }),
    ...(sound_enabled !== undefined && { sound_enabled }),
    ...(notifications_enabled !== undefined && { notifications_enabled }),
    ...(water_sound !== undefined && { water_sound }),
    ...(look_outside_sound !== undefined && { look_outside_sound }),
    ...(water_default_duration !== undefined && { water_default_duration }),
    ...(look_outside_default_duration !== undefined && { look_outside_default_duration }),
    ...(pause_until !== undefined && { pause_until }),
    ...(pause_minutes !== undefined && { pause_minutes }),
  });

  res.json({ settings });
});

