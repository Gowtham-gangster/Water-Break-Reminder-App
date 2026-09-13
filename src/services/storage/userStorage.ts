/**
 * PauseFlow V2 User-Scoped Storage Abstraction
 * Enforces key separation: pauseflow:v2:<userId>:<category>
 * Automatically migrates legacy eyeflow:v2:<userId>:<category> keys seamlessly
 */

export interface UserScopedStorage {
  get<T>(key: string, defaultValue: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clearAllForUser(): void;
}

export class UserStorageManager implements UserScopedStorage {
  private userId: string;
  private prefix: string;
  private legacyPrefix: string;

  constructor(userId: string) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('[UserStorageManager] A valid non-empty userId is required for V2 user-scoped storage');
    }
    this.userId = userId;
    // Uses VITE_STORAGE_PREFIX from environment or fallback
    const envPrefix = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STORAGE_PREFIX) || 'pauseflow:v2:';
    this.prefix = `${envPrefix}${this.userId}:`;
    this.legacyPrefix = `eyeflow:v2:${this.userId}:`;
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private legacyFullKey(key: string): string {
    return `${this.legacyPrefix}${key}`;
  }

  public get<T>(key: string, defaultValue: T): T {
    try {
      let raw = localStorage.getItem(this.fullKey(key));
      if (raw === null || raw === undefined) {
        // Fallback and migrate legacy eyeflow key
        const legacyRaw = localStorage.getItem(this.legacyFullKey(key));
        if (legacyRaw !== null && legacyRaw !== undefined) {
          raw = legacyRaw;
          localStorage.setItem(this.fullKey(key), raw);
        }
      }
      if (raw === null || raw === undefined) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (e) {
      console.warn(`[UserStorageManager] Error reading ${this.fullKey(key)}:`, e);
      return defaultValue;
    }
  }

  public set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.fullKey(key), JSON.stringify(value));
    } catch (e) {
      console.error(`[UserStorageManager] Error writing ${this.fullKey(key)}:`, e);
    }
  }

  public remove(key: string): void {
    try {
      localStorage.removeItem(this.fullKey(key));
      localStorage.removeItem(this.legacyFullKey(key));
    } catch (e) {
      console.error(`[UserStorageManager] Error removing ${this.fullKey(key)}:`, e);
    }
  }

  public clearAllForUser(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(this.prefix) || k.startsWith(this.legacyPrefix))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error(`[UserStorageManager] Error clearing data for user ${this.userId}:`, e);
    }
  }

  // Predefined Typed Category Helpers
  public getSettings<T>(defaultValue: T): T {
    return this.get<T>('settings', defaultValue);
  }

  public setSettings<T>(value: T): void {
    this.set<T>('settings', value);
  }

  public getWaterConfig<T>(defaultValue: T): T {
    return this.get<T>('water', defaultValue);
  }

  public setWaterConfig<T>(value: T): void {
    this.set<T>('water', value);
  }

  public getLookOutsideConfig<T>(defaultValue: T): T {
    return this.get<T>('lookOutside', defaultValue);
  }

  public setLookOutsideConfig<T>(value: T): void {
    this.set<T>('lookOutside', value);
  }

  public getStatistics<T>(defaultValue: T): T {
    return this.get<T>('statistics', defaultValue);
  }

  public setStatistics<T>(value: T): void {
    this.set<T>('statistics', value);
  }

  public getActiveReminders<T>(defaultValue: T): T {
    return this.get<T>('activeReminders', defaultValue);
  }

  public setActiveReminders<T>(value: T): void {
    this.set<T>('activeReminders', value);
  }

  public getPauseState<T>(defaultValue: T): T {
    return this.get<T>('pauseState', defaultValue);
  }

  public setPauseState<T>(value: T): void {
    this.set<T>('pauseState', value);
  }

  public getOfflineQueue<T>(defaultValue: T[] = []): T[] {
    return this.get<T[]>('offlineQueue', defaultValue);
  }

  public setOfflineQueue<T>(queue: T[]): void {
    this.set<T[]>('offlineQueue', queue);
  }
}

export function createUserStorage(userId: string): UserStorageManager {
  return new UserStorageManager(userId);
}
