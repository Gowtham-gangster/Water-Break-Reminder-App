// src/services/syncService.ts
// PauseFlow V2 — Supabase Cross-Device Synchronization, Offline Cache & Conflict Resolution Engine

import { settingsService } from './settingsService.ts';
import { waterConfigService } from './waterConfigService.ts';
import { lookOutsideConfigService } from './lookOutsideConfigService.ts';
import { profileService } from './profileService.ts';
import { reminderService } from './reminderService.ts';
import { pauseService, type ReminderPauseStateEntity } from './pauseService.ts';
import { deviceService } from './deviceService.ts';
import { realtimeSyncService } from './realtimeSyncService.ts';
import { performanceDiagnostics } from './performanceDiagnostics.ts';
import { developmentDiagnostics } from './developmentDiagnostics.ts';
import { storageEngine } from '../engine/storageEngine.ts';
import type {
  UserSettingsEntity,
  WaterConfigEntity,
  LookOutsideConfigEntity,
  ProfileEntity,
  ReminderEventEntity,
} from '../types/index.ts';

export interface UserFullSyncResult {
  success: boolean;
  profile: ProfileEntity | null;
  settings: UserSettingsEntity | null;
  waterConfig: WaterConfigEntity | null;
  lookOutsideConfig: LookOutsideConfigEntity | null;
  pauseState: ReminderPauseStateEntity | null;
  todayEvents: ReminderEventEntity[];
  flushedOfflineEventsCount: number;
  lastSyncAt: string;
  isOffline: boolean;
  error?: string;
}

export class SyncService {
  /**
   * Generates strict user-scoped local storage keys
   */
  public getScopedKey(
    userId: string,
    domain: 'profile' | 'settings' | 'water' | 'lookOutside' | 'statistics' | 'activeReminders' | 'pending_sync_queue' | 'pause_state'
  ): string {
    return `pauseflow:v2:${userId}:${domain}`;
  }

  /**
   * Performs full synchronization between Supabase Cloud and local user-scoped cache
   */
  public async syncUserAccount(
    userId: string,
    deviceInfo?: { deviceId?: string; platform?: 'windows' | 'android' | 'web' | 'macos' | 'linux' | 'ios'; deviceName?: string }
  ): Promise<UserFullSyncResult> {
    const nowIso = new Date().toISOString();
    const syncStart = performance.now();
    let flushedCount = 0;

    if (!userId) {
      return {
        success: false,
        profile: null,
        settings: null,
        waterConfig: null,
        lookOutsideConfig: null,
        pauseState: null,
        todayEvents: [],
        flushedOfflineEventsCount: 0,
        lastSyncAt: nowIso,
        isOffline: true,
        error: 'User ID is required for synchronization.',
      };
    }

    try {
      // 1. Device Registration / Heartbeat
      if (deviceInfo && deviceInfo.deviceId && deviceInfo.platform) {
        await deviceService.registerDevice(
          userId,
          deviceInfo.deviceId,
          deviceInfo.platform,
          deviceInfo.deviceName
        );
      } else {
        await deviceService.registerCurrentDevice(userId);
      }

      // 2. Flush Pending Offline Events Queue (Batched)
      flushedCount = await reminderService.flushOfflineEvents(userId);

      // 3. Fetch Latest Cloud Records in parallel
      const [profileRes, settingsRes, waterRes, screenRes, pauseStateRes, todayEvents] = await Promise.all([
        profileService.getProfile(userId),
        settingsService.getSettings(userId),
        waterConfigService.getWaterConfig(userId),
        lookOutsideConfigService.getLookOutsideConfig(userId),
        pauseService.getPauseState(userId),
        reminderService.getTodayEvents(userId),
      ]);

      const profile = profileRes.profile;
      const settings = settingsRes.settings;
      const waterConfig = waterRes.config;
      const lookOutsideConfig = screenRes.config;
      const pauseState = pauseStateRes;

      // Update diagnostic trackers
      developmentDiagnostics.setProfileFetch(profile ? 'SYNCED' : 'IDLE');
      developmentDiagnostics.setWaterConfigFetch(waterConfig ? 'SYNCED' : 'IDLE');
      developmentDiagnostics.setLookOutsideConfigFetch(lookOutsideConfig ? 'SYNCED' : 'IDLE');
      developmentDiagnostics.setReminderEventFetch('SYNCED');
      developmentDiagnostics.markAuthoritativeSync(nowIso);

      // 4. Conflict Resolution & User-Scoped Cache Persistence
      if (profile) {
        await storageEngine.set(this.getScopedKey(userId, 'profile'), profile);
      }
      if (settings) {
        await storageEngine.set(this.getScopedKey(userId, 'settings'), settings);
      }
      if (waterConfig) {
        await storageEngine.set(this.getScopedKey(userId, 'water'), waterConfig);
      }
      if (lookOutsideConfig) {
        await storageEngine.set(this.getScopedKey(userId, 'lookOutside'), lookOutsideConfig);
      }
      if (pauseState) {
        await storageEngine.set(this.getScopedKey(userId, 'pause_state'), pauseState);
      }

      // 5. Connect Realtime Channel
      realtimeSyncService.subscribe(userId);
      developmentDiagnostics.setProfileRealtime('SUBSCRIBED');
      developmentDiagnostics.setWaterConfigRealtime('SUBSCRIBED');
      developmentDiagnostics.setLookOutsideRealtime('SUBSCRIBED');
      developmentDiagnostics.setReminderEventRealtime('SUBSCRIBED');

      const elapsed = Math.round(performance.now() - syncStart);
      performanceDiagnostics.markBackgroundSync(elapsed);

      return {
        success: true,
        profile,
        settings,
        waterConfig,
        lookOutsideConfig,
        pauseState,
        todayEvents,
        flushedOfflineEventsCount: flushedCount,
        lastSyncAt: nowIso,
        isOffline: false,
      };
    } catch (err: any) {
      console.warn('[SyncService] Cloud sync encountered error, falling back to user-scoped local cache:', err);

      // Fallback to local user-scoped cache
      const cachedProfile = await storageEngine.get<ProfileEntity | null>(this.getScopedKey(userId, 'profile'), null);
      const cachedSettings = await storageEngine.get<UserSettingsEntity | null>(this.getScopedKey(userId, 'settings'), null);
      const cachedWater = await storageEngine.get<WaterConfigEntity | null>(this.getScopedKey(userId, 'water'), null);
      const cachedScreen = await storageEngine.get<LookOutsideConfigEntity | null>(this.getScopedKey(userId, 'lookOutside'), null);
      const cachedPause = await storageEngine.get<ReminderPauseStateEntity | null>(this.getScopedKey(userId, 'pause_state'), null);
      const cachedTodayEvents = await reminderService.getTodayEvents(userId);

      return {
        success: false,
        profile: cachedProfile,
        settings: cachedSettings,
        waterConfig: cachedWater,
        lookOutsideConfig: cachedScreen,
        pauseState: cachedPause,
        todayEvents: cachedTodayEvents,
        flushedOfflineEventsCount: 0,
        lastSyncAt: nowIso,
        isOffline: true,
        error: err?.message || 'Sync failed, running in cached offline mode.',
      };
    }
  }

  /**
   * Fast incremental delta sync for application resume
   */
  public async syncDelta(userId: string, lastSyncTimestamp?: string): Promise<{ updatedCount: number; lastSyncAt: string }> {
    return reminderService.syncDelta(userId, lastSyncTimestamp);
  }

  /**
   * Trigger offline queue flush on network reconnect
   */
  public async handleNetworkReconnect(userId: string): Promise<number> {
    try {
      const flushedCount = await reminderService.flushOfflineEvents(userId);
      await this.syncUserAccount(userId);
      return flushedCount;
    } catch (err) {
      console.warn('[SyncService] Failed to flush and sync on network reconnect:', err);
      return 0;
    }
  }
}

export const syncService = new SyncService();
