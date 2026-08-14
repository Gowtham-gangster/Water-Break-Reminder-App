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
} from '../types';
import { APP_CONFIG } from '../config/app.config';

const DB_NAME = 'eyeflow_db';
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
      } else {
        localStorage.setItem(key, JSON.stringify(val));
      }
    } catch (err) {
      console.warn('DB set error, falling back to localStorage', err);
      localStorage.setItem(key, JSON.stringify(val));
    }
  }

  public async get<T>(key: string, defaultValue: T, storeName = 'keyval'): Promise<T> {
    try {
      if (this.dbPromise) {
        const db = await this.dbPromise;
        const result = await db.get(storeName, key);
        return result !== undefined ? result : defaultValue;
      } else {
        const local = localStorage.getItem(key);
        return local ? JSON.parse(local) : defaultValue;
      }
    } catch (err) {
      console.warn('DB get error, falling back to localStorage', err);
      const local = localStorage.getItem(key);
      return local ? JSON.parse(local) : defaultValue;
    }
  }

  // Helper getters/setters for initial application state
  public async loadWaterConfig(): Promise<WaterConfig> {
    return this.get<WaterConfig>('waterConfig', APP_CONFIG.defaultWaterConfig);
  }

  public async saveWaterConfig(config: WaterConfig): Promise<void> {
    return this.set('waterConfig', config);
  }

  public async loadScreenBreakConfig(): Promise<ScreenBreakConfig> {
    return this.get<ScreenBreakConfig>(
      'screenBreakConfig',
      APP_CONFIG.defaultScreenBreakConfig
    );
  }

  public async saveScreenBreakConfig(config: ScreenBreakConfig): Promise<void> {
    return this.set('screenBreakConfig', config);
  }

  public async loadGeneralSettings(): Promise<GeneralSettings> {
    return this.get<GeneralSettings>('generalSettings', {
      startOnStartup: true,
      minimizeToTray: true,
      language: 'English',
      timeFormat: '12h',
      theme: 'system',
      localOnlyMode: false,
    });
  }

  public async saveGeneralSettings(settings: GeneralSettings): Promise<void> {
    return this.set('generalSettings', settings);
  }

  public async loadNotificationSettings(): Promise<NotificationSettings> {
    return this.get<NotificationSettings>('notificationSettings', {
      enabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      previewMessage: true,
    });
  }

  public async saveNotificationSettings(settings: NotificationSettings): Promise<void> {
    return this.set('notificationSettings', settings);
  }

  public async loadPauseState(): Promise<PauseState> {
    return this.get<PauseState>('pauseState', {
      isPaused: false,
      pauseUntil: null,
      pauseMinutes: null,
    });
  }

  public async savePauseState(state: PauseState): Promise<void> {
    return this.set('pauseState', state);
  }

  public async loadDailyWaterLogs(dateStr: string): Promise<WaterReminderLog[]> {
    return this.get<WaterReminderLog[]>(dateStr, [], 'water_logs');
  }

  public async saveDailyWaterLogs(dateStr: string, logs: WaterReminderLog[]): Promise<void> {
    return this.set(dateStr, logs, 'water_logs');
  }

  public async loadDailyScreenLogs(dateStr: string): Promise<ScreenBreakLog[]> {
    return this.get<ScreenBreakLog[]>(dateStr, [], 'screen_logs');
  }

  public async saveDailyScreenLogs(dateStr: string, logs: ScreenBreakLog[]): Promise<void> {
    return this.set(dateStr, logs, 'screen_logs');
  }

  public async loadUserAccount(): Promise<UserAccount> {
    return this.get<UserAccount>('userAccount', { isLoggedIn: false });
  }

  public async saveUserAccount(account: UserAccount): Promise<void> {
    return this.set('userAccount', account);
  }

  public async getOnboardingStatus(): Promise<boolean> {
    return this.get<boolean>('onboardingCompleted', true);
  }

  public async setOnboardingStatus(completed: boolean): Promise<void> {
    return this.set('onboardingCompleted', completed);
  }
}

export const storageEngine = new StorageEngine();
