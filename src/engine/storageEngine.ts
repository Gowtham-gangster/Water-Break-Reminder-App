import { openDB, type IDBPDatabase } from 'idb';
import type {
  WaterConfig,
  ScreenBreakConfig,
  GeneralSettings,
  NotificationSettings,
  PauseState,
  WaterReminderLog,
  ScreenBreakLog,
  UserAccount,
  ProfileEntity,
} from '../types/index.ts';
import { APP_CONFIG } from '../config/app.config.ts';

const DB_NAME = 'pauseflow_db';
const DB_VERSION = 1;

class StorageEngine {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  private initDB() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('keyval')) {
            db.createObjectStore('keyval');
          }
          if (!db.objectStoreNames.contains('water_logs')) {
            db.createObjectStore('water_logs');
          }
          if (!db.objectStoreNames.contains('screen_logs')) {
            db.createObjectStore('screen_logs');
          }
        },
      });
    }
  }

  public async set<T>(key: string, val: T, storeName = 'keyval'): Promise<void> {
    try {
      if (this.dbPromise) {
        const db = await this.dbPromise;
        await db.put(storeName, val, key);
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(val));
      }
    } catch (err) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(key, JSON.stringify(val));
        } catch (_) {}
      }
    }
  }

  public async get<T>(key: string, defaultValue: T, storeName = 'keyval'): Promise<T> {
    try {
      if (this.dbPromise) {
        const db = await this.dbPromise;
        let result = await db.get(storeName, key);
        if (result === undefined && key.startsWith('pauseflow:')) {
          const legacyKey = key.replace('pauseflow:', 'eyeflow:');
          const legacyResult = await db.get(storeName, legacyKey);
          if (legacyResult !== undefined) {
            result = legacyResult;
            try {
              await db.put(storeName, legacyResult, key);
            } catch (_) {}
          }
        }
        if (result !== undefined) return result;
      }
      
      if (typeof window !== 'undefined' && window.localStorage) {
        let local = window.localStorage.getItem(key);
        if (local === null && key.startsWith('pauseflow:')) {
          const legacyKey = key.replace('pauseflow:', 'eyeflow:');
          const legacyLocal = window.localStorage.getItem(legacyKey);
          if (legacyLocal !== null) {
            local = legacyLocal;
            try {
              window.localStorage.setItem(key, legacyLocal);
            } catch (_) {}
          }
        }
        return local ? JSON.parse(local) : defaultValue;
      }
      return defaultValue;
    } catch (err) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const local = window.localStorage.getItem(key);
          return local ? JSON.parse(local) : defaultValue;
        } catch (_) {}
      }
      return defaultValue;
    }
  }

  // Canonical User-scoped key generator
  public getScopedKey(key: string, userId?: string | null): string {
    return userId ? `pauseflow:v2:${userId}:${key}` : key;
  }

  // Helper getters/setters for user-specific application state
  public async loadWaterConfig(userId?: string | null): Promise<WaterConfig> {
    return this.get<WaterConfig>(this.getScopedKey('waterConfig', userId), APP_CONFIG.defaultWaterConfig);
  }

  public async saveWaterConfig(config: WaterConfig, userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey('waterConfig', userId), config);
  }

  public async loadScreenBreakConfig(userId?: string | null): Promise<ScreenBreakConfig> {
    return this.get<ScreenBreakConfig>(
      this.getScopedKey('screenBreakConfig', userId),
      APP_CONFIG.defaultScreenBreakConfig
    );
  }

  public async saveScreenBreakConfig(config: ScreenBreakConfig, userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey('screenBreakConfig', userId), config);
  }

  public async loadGeneralSettings(userId?: string | null): Promise<GeneralSettings> {
    return this.get<GeneralSettings>(this.getScopedKey('generalSettings', userId), {
      startOnStartup: true,
      minimizeToTray: true,
      language: 'English',
      timeFormat: '12h',
      theme: 'system',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      localOnlyMode: false,
    });
  }

  public async saveGeneralSettings(settings: GeneralSettings, userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey('generalSettings', userId), settings);
  }

  public async loadNotificationSettings(userId?: string | null): Promise<NotificationSettings> {
    return this.get<NotificationSettings>(this.getScopedKey('notificationSettings', userId), {
      enabled: true,
      soundEnabled: true,
      waterSound: 'water',
      lookOutsideSound: 'bell',
      vibrationEnabled: true,
      previewMessage: true,
    });
  }

  public async saveNotificationSettings(settings: NotificationSettings, userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey('notificationSettings', userId), settings);
  }

  public async loadPauseState(userId?: string | null): Promise<PauseState> {
    return this.get<PauseState>(this.getScopedKey('pauseState', userId), {
      isPaused: false,
      pauseUntil: null,
      pauseMinutes: null,
      userId: userId || undefined,
    });
  }

  public async savePauseState(state: PauseState, userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey('pauseState', userId), { ...state, userId: userId || undefined });
  }

  public async loadDailyWaterLogs(dateStr: string, userId?: string | null): Promise<WaterReminderLog[]> {
    return this.get<WaterReminderLog[]>(this.getScopedKey(dateStr, userId), [], 'water_logs');
  }

  public async saveDailyWaterLogs(dateStr: string, logs: WaterReminderLog[], userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey(dateStr, userId), logs, 'water_logs');
  }

  public async loadDailyScreenLogs(dateStr: string, userId?: string | null): Promise<ScreenBreakLog[]> {
    return this.get<ScreenBreakLog[]>(this.getScopedKey(dateStr, userId), [], 'screen_logs');
  }

  public async saveDailyScreenLogs(dateStr: string, logs: ScreenBreakLog[], userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey(dateStr, userId), logs, 'screen_logs');
  }

  public async loadUserAccount(): Promise<UserAccount> {
    return this.get<UserAccount>('userAccount', { isLoggedIn: false });
  }

  public async saveUserAccount(account: UserAccount): Promise<void> {
    return this.set('userAccount', account);
  }

  public async loadProfile(userId?: string | null): Promise<Partial<ProfileEntity> | null> {
    return this.get<Partial<ProfileEntity> | null>(this.getScopedKey('profile', userId), null);
  }

  public async saveProfile(profile: Partial<ProfileEntity>, userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey('profile', userId), profile);
  }

  public async getOnboardingStatus(userId?: string | null): Promise<boolean> {
    return this.get<boolean>(this.getScopedKey('onboardingCompleted', userId), true);
  }

  public async setOnboardingStatus(completed: boolean, userId?: string | null): Promise<void> {
    return this.set(this.getScopedKey('onboardingCompleted', userId), completed);
  }

  public async clearUserScopedTransientState(userId?: string | null): Promise<void> {
    if (!userId) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const prefixes = [`usr_${userId}:`, `pauseflow:v2:${userId}:`, `eyeflow:v2:${userId}:`];
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && (prefixes.some((p) => key.startsWith(p)) || key.includes(`:${userId}:`))) {
            if (key.includes('activeReminders') || key.includes('transient') || key.includes('timers')) {
              window.localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[StorageEngine] Error clearing transient state:', e);
    }
  }

  public async clearUserData(userId?: string | null): Promise<void> {
    if (!userId) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const prefixes = [`usr_${userId}:`, `pauseflow:v2:${userId}:`, `eyeflow:v2:${userId}:`];
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && prefixes.some((p) => key.startsWith(p))) {
            window.localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.warn('[StorageEngine] Error clearing user data:', e);
    }
  }
}

export const storageEngine = new StorageEngine();
