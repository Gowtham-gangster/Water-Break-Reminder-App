import { Router } from 'express';
import { db } from '../db/database.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

export const syncRouter = Router();

// Full Delta Sync: Pull current server state and push pending offline changes
syncRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const {
    settings,
    waterConfig,
    lookOutsideConfig,
    pendingReminderEvents,
    deviceInfo,
  } = req.body;

  // 1. Conflict Resolution for Settings (LWW based on updated_at)
  if (settings) {
    const currentSettings = db.getSettingsByUserId(userId);
    const clientTime = settings.updated_at ? new Date(settings.updated_at).getTime() : Date.now();
    const serverTime = currentSettings?.updated_at ? new Date(currentSettings.updated_at).getTime() : 0;

    if (!currentSettings || clientTime >= serverTime) {
      db.upsertSettings(userId, settings);
    }
  }

  // 2. Conflict Resolution for Water Config (LWW based on updated_at)
  if (waterConfig) {
    const currentWater = db.getWaterConfigByUserId(userId);
    const clientTime = waterConfig.updated_at ? new Date(waterConfig.updated_at).getTime() : Date.now();
    const serverTime = currentWater?.updated_at ? new Date(currentWater.updated_at).getTime() : 0;

    if (!currentWater || clientTime >= serverTime) {
      db.upsertWaterConfig(userId, waterConfig);
    }
  }

  // 3. Conflict Resolution for Look Outside Config (LWW based on updated_at)
  if (lookOutsideConfig) {
    const currentLookOutside = db.getLookOutsideConfigByUserId(userId);
    const clientTime = lookOutsideConfig.updated_at ? new Date(lookOutsideConfig.updated_at).getTime() : Date.now();
    const serverTime = currentLookOutside?.updated_at ? new Date(currentLookOutside.updated_at).getTime() : 0;

    if (!currentLookOutside || clientTime >= serverTime) {
      db.upsertLookOutsideConfig(userId, lookOutsideConfig);
    }
  }

  // 4. Ingest & Deduplicate Offline Reminder Events
  if (Array.isArray(pendingReminderEvents) && pendingReminderEvents.length > 0) {
    pendingReminderEvents.forEach((ev) => {
      db.insertReminderEvent(userId, {
        id: ev.id,
        type: ev.type,
        scheduled_at: ev.scheduled_at,
        started_at: ev.started_at || null,
        completed_at: ev.completed_at || null,
        status: ev.status || 'completed',
        created_at: ev.created_at,
        updated_at: ev.updated_at,
      });
    });
  }

  if (deviceInfo?.device_id && deviceInfo?.platform) {
    db.registerDevice(userId, deviceInfo);
  }

  // 2. Fetch authoritative state from DB to return to client
  const currentSettings = db.getSettingsByUserId(userId) || db.upsertSettings(userId, {});
  const currentWaterConfig = db.getWaterConfigByUserId(userId) || db.upsertWaterConfig(userId, {});
  const currentLookOutsideConfig = db.getLookOutsideConfigByUserId(userId) || db.upsertLookOutsideConfig(userId, {});
  const recentEvents = db.getReminderEvents(userId, 50);

  res.json({
    syncedAt: new Date().toISOString(),
    settings: currentSettings,
    waterConfig: currentWaterConfig,
    lookOutsideConfig: currentLookOutsideConfig,
    recentEvents,
  });
});
