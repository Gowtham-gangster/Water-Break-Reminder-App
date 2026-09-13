// src/services/v1MigrationService.ts
// EyeFlow V2 — Safe, Explicit, Reversible V1 to V2 User Data Migration Service

import type {
  WaterConfig,
  ScreenBreakConfig,
  GeneralSettings,
  NotificationSettings,
  WaterReminderLog,
  ScreenBreakLog,
} from '../types';
import { storageEngine } from '../engine/storageEngine';
import { settingsService } from './settingsService';
import { waterConfigService } from './waterConfigService';
import { lookOutsideConfigService } from './lookOutsideConfigService';
import { reminderHistoryService } from './reminderHistoryService';

export interface V1DetectedData {
  hasV1Data: boolean;
  waterConfig?: WaterConfig;
  screenConfig?: ScreenBreakConfig;
  generalSettings?: GeneralSettings;
  notificationSettings?: NotificationSettings;
  waterLogsCount: number;
  screenLogsCount: number;
}

export interface V1MigrationResult {
  success: boolean;
  migratedSettings: boolean;
  migratedWaterConfig: boolean;
  migratedLookOutsideConfig: boolean;
  migratedEventsCount: number;
  error?: string;
}

export class V1MigrationService {
  /**
   * Scans local storage / IndexedDB for unscoped V1 configuration and logs
   * Strictly read-only; alters zero records.
   */
  public async detectV1Data(): Promise<V1DetectedData> {
    try {
      const waterConfig = await storageEngine.loadWaterConfig(null);
      const screenConfig = await storageEngine.loadScreenBreakConfig(null);
      const generalSettings = await storageEngine.loadGeneralSettings(null);
      const notificationSettings = await storageEngine.loadNotificationSettings(null);

      const waterLogs = await storageEngine.get<WaterReminderLog[]>('water_logs', []);
      const screenLogs = await storageEngine.get<ScreenBreakLog[]>('screen_logs', []);

      const hasCustomWater = Boolean(waterConfig && waterConfig.enabled !== undefined);
      const hasCustomScreen = Boolean(screenConfig && screenConfig.enabled !== undefined);
      const hasLogs = waterLogs.length > 0 || screenLogs.length > 0;

      const hasV1Data = hasCustomWater || hasCustomScreen || hasLogs;

      return {
        hasV1Data,
        waterConfig,
        screenConfig,
        generalSettings,
        notificationSettings,
        waterLogsCount: waterLogs.length,
        screenLogsCount: screenLogs.length,
      };
    } catch (err) {
      console.warn('[V1MigrationService] Error detecting V1 data:', err);
      return {
        hasV1Data: false,
        waterLogsCount: 0,
        screenLogsCount: 0,
      };
    }
  }

  /**
   * Performs an explicit, user-confirmed copy of V1 data to the target V2 user account.
   * STRICT SAFETY GUARANTEE: Does NOT delete or alter V1 local storage keys.
   */
  public async migrateToUserAccount(
    userId: string,
    authToken: string,
    options: {
      includeSettings?: boolean;
      includeWaterConfig?: boolean;
      includeLookOutsideConfig?: boolean;
      includeHistory?: boolean;
    } = {
      includeSettings: true,
      includeWaterConfig: true,
      includeLookOutsideConfig: true,
      includeHistory: true,
    }
  ): Promise<V1MigrationResult> {
    if (!userId || !authToken) {
      return {
        success: false,
        migratedSettings: false,
        migratedWaterConfig: false,
        migratedLookOutsideConfig: false,
        migratedEventsCount: 0,
        error: 'Authenticated userId and token are required for migration.',
      };
    }

    const v1Data = await this.detectV1Data();
    let migratedSettings = false;
    let migratedWaterConfig = false;
    let migratedLookOutsideConfig = false;
    let migratedEventsCount = 0;

    try {
      // 1. Migrate General Settings & Notifications
      if (options.includeSettings && v1Data.generalSettings) {
        const theme = v1Data.generalSettings.theme || 'system';
        const timeFormat = v1Data.generalSettings.timeFormat || '24h';
        const soundEnabled = v1Data.notificationSettings?.soundEnabled ?? true;
        const notifEnabled = v1Data.notificationSettings?.enabled ?? true;

        await settingsService.updateSettings(userId, {
          theme: theme as any,
          time_format: timeFormat as any,
          sound_enabled: soundEnabled,
          notifications_enabled: notifEnabled,
        });

        // Also update user-scoped local cache
        await storageEngine.saveGeneralSettings(v1Data.generalSettings, userId);
        if (v1Data.notificationSettings) {
          await storageEngine.saveNotificationSettings(v1Data.notificationSettings, userId);
        }
        migratedSettings = true;
      }

      // 2. Migrate Water Configuration
      if (options.includeWaterConfig && v1Data.waterConfig) {
        const payload = {
          enabled: v1Data.waterConfig.enabled ?? true,
          interval_minutes: v1Data.waterConfig.intervalMinutes || 45,
          start_time: v1Data.waterConfig.startTime || '09:00',
          end_time: v1Data.waterConfig.endTime || '18:00',
          duration_seconds: (v1Data.waterConfig.durationMinutes || 2) * 60,
          active_days: v1Data.waterConfig.activeDays || [1, 2, 3, 4, 5],
        };

        await waterConfigService.updateWaterConfig(userId, payload);
        await storageEngine.saveWaterConfig(v1Data.waterConfig, userId);
        migratedWaterConfig = true;
      }

      // 3. Migrate Look Outside Configuration
      if (options.includeLookOutsideConfig && v1Data.screenConfig) {
        const payload = {
          enabled: v1Data.screenConfig.enabled ?? true,
          interval_minutes: v1Data.screenConfig.screenIntervalMinutes || 30,
          start_time: v1Data.screenConfig.startTime || '09:00',
          end_time: v1Data.screenConfig.endTime || '18:00',
          duration_seconds: (v1Data.screenConfig.breakDurationMinutes || 5) * 60,
          active_days: v1Data.screenConfig.activeDays || [1, 2, 3, 4, 5],
        };

        await lookOutsideConfigService.updateLookOutsideConfig(userId, payload);
        await storageEngine.saveScreenBreakConfig(v1Data.screenConfig, userId);
        migratedLookOutsideConfig = true;
      }

      // 4. Migrate History Logs (if requested)
      if (options.includeHistory) {
        const waterLogs = await storageEngine.get<WaterReminderLog[]>('water_logs', []);
        const screenLogs = await storageEngine.get<ScreenBreakLog[]>('screen_logs', []);

        for (const log of waterLogs) {
          if (log.status === 'completed') {
            await reminderHistoryService.logEvent(userId, {
              type: 'water',
              scheduled_at: log.completedAt || new Date().toISOString(),
              completed_at: log.completedAt || new Date().toISOString(),
              status: 'completed',
            });
            migratedEventsCount++;
          }
        }

        for (const log of screenLogs) {
          if (log.status === 'completed') {
            await reminderHistoryService.logEvent(userId, {
              type: 'look_outside',
              scheduled_at: log.completedAt || new Date().toISOString(),
              completed_at: log.completedAt || new Date().toISOString(),
              status: 'completed',
            });
            migratedEventsCount++;
          }
        }
      }

      return {
        success: true,
        migratedSettings,
        migratedWaterConfig,
        migratedLookOutsideConfig,
        migratedEventsCount,
      };
    } catch (err: any) {
      console.error('[V1MigrationService] Migration failed:', err);
      return {
        success: false,
        migratedSettings,
        migratedWaterConfig,
        migratedLookOutsideConfig,
        migratedEventsCount,
        error: err?.message || 'Migration encountered an error.',
      };
    }
  }
}

export const v1MigrationService = new V1MigrationService();
