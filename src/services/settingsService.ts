// src/services/settingsService.ts
// EyeFlow V2 — Official Supabase User Settings Service

import { supabase } from './supabaseClient.ts';
import { storageEngine } from '../engine/storageEngine.ts';
import { SUPABASE_DEFAULTS } from '../config/supabase.config.ts';
import type { UserSettingsEntity } from '../types/index.ts';

export class SettingsService {
  /**
   * Returns the user-scoped local cache key for settings
   */
  public getScopedSettingsKey(userId: string): string {
    return `eyeflow:v2:${userId}:settings`;
  }

  /**
   * Fetch authenticated user settings from Supabase with local cache fallback
   */
  public async getSettings(userId?: string): Promise<{ settings: UserSettingsEntity | null; error: string | null }> {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData.user?.id;
    }

    if (!resolvedUserId) {
      return { settings: null, error: 'User ID is required to fetch settings.' };
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', resolvedUserId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && !error) {
        const settings = data[0] as UserSettingsEntity;
        // Update user-scoped local cache
        await storageEngine.set(this.getScopedSettingsKey(resolvedUserId), settings);
        return { settings, error: null };
      }

      // If cloud query failed or not found (e.g. offline), fallback to local user-scoped cache
      const cached = await storageEngine.get<UserSettingsEntity | null>(
        this.getScopedSettingsKey(resolvedUserId),
        null
      );
      if (cached) {
        return { settings: cached, error: null };
      }

      return { settings: null, error: error ? error.message : 'Settings not found.' };
    } catch (err: any) {
      // Fallback to local user-scoped cache
      const cached = await storageEngine.get<UserSettingsEntity | null>(
        this.getScopedSettingsKey(resolvedUserId),
        null
      );
      if (cached) {
        return { settings: cached, error: null };
      }
      return { settings: null, error: err?.message || 'Failed to fetch settings.' };
    }
  }

  /**
   * Create default user settings in Supabase
   */
  public async createDefaultSettings(
    userId: string,
    customDefaults?: Partial<Pick<UserSettingsEntity, 'theme' | 'time_format' | 'sound_enabled' | 'notifications_enabled' | 'default_water_duration' | 'default_look_outside_duration'>>
  ): Promise<{ settings: UserSettingsEntity | null; error: string | null }> {
    if (!userId) {
      return { settings: null, error: 'User ID is required to create settings.' };
    }

    const payload = {
      user_id: userId,
      theme: customDefaults?.theme || SUPABASE_DEFAULTS.settings.theme,
      time_format: customDefaults?.time_format || SUPABASE_DEFAULTS.settings.time_format,
      sound_enabled: customDefaults?.sound_enabled !== undefined ? customDefaults.sound_enabled : SUPABASE_DEFAULTS.settings.sound_enabled,
      notifications_enabled: customDefaults?.notifications_enabled !== undefined ? customDefaults.notifications_enabled : SUPABASE_DEFAULTS.settings.notifications_enabled,
      default_water_duration: customDefaults?.default_water_duration || SUPABASE_DEFAULTS.settings.default_water_duration,
      default_look_outside_duration: customDefaults?.default_look_outside_duration || SUPABASE_DEFAULTS.settings.default_look_outside_duration,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await ((supabase
        .from('user_settings') as any)
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .limit(1) as any);

      if (error) {
        return { settings: null, error: error.message };
      }

      const created = (Array.isArray(data) ? data[0] : data) as UserSettingsEntity || (payload as unknown as UserSettingsEntity);
      await storageEngine.set(this.getScopedSettingsKey(userId), created);
      return { settings: created, error: null };
    } catch (err: any) {
      return { settings: null, error: err?.message || 'Failed to create default settings.' };
    }
  }

  /**
   * Update user settings in Supabase and local user-scoped cache
   */
  public async updateSettings(
    userIdOrUpdates: string | Partial<UserSettingsEntity>,
    possibleUpdates?: Partial<UserSettingsEntity>
  ): Promise<{ settings: UserSettingsEntity | null; error: string | null }> {
    let resolvedUserId: string | undefined;
    let updates: Partial<UserSettingsEntity>;

    if (typeof userIdOrUpdates === 'string') {
      resolvedUserId = userIdOrUpdates;
      updates = possibleUpdates || {};
    } else {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData.user?.id;
      updates = userIdOrUpdates || {};
    }

    if (!resolvedUserId) {
      return { settings: null, error: 'User ID is required to update settings.' };
    }

    // Clean and validate updates
    const cleanUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.theme !== undefined) {
      if (['system', 'light', 'dark'].includes(updates.theme)) {
        cleanUpdates.theme = updates.theme;
      }
    }
    if (updates.time_format !== undefined) {
      if (['12h', '24h'].includes(updates.time_format)) {
        cleanUpdates.time_format = updates.time_format;
      }
    }
    if (updates.sound_enabled !== undefined) {
      cleanUpdates.sound_enabled = Boolean(updates.sound_enabled);
    }
    if (updates.notifications_enabled !== undefined) {
      cleanUpdates.notifications_enabled = Boolean(updates.notifications_enabled);
    }
    if (updates.default_water_duration !== undefined) {
      const duration = Number(updates.default_water_duration);
      if (!isNaN(duration) && duration > 0) {
        cleanUpdates.default_water_duration = duration;
      }
    }
    if (updates.default_look_outside_duration !== undefined) {
      const duration = Number(updates.default_look_outside_duration);
      if (!isNaN(duration) && duration > 0) {
        cleanUpdates.default_look_outside_duration = duration;
      }
    }

    try {
      const { data, error } = await ((supabase
        .from('user_settings') as any)
        .upsert({ user_id: resolvedUserId, ...cleanUpdates }, { onConflict: 'user_id' })
        .select()
        .limit(1) as any);

      if (error) {
        console.warn('[SettingsService] Cloud upsert warning, trying fallback update:', error.message);
        const { data: updateData, error: updateError } = await ((supabase
          .from('user_settings') as any)
          .update(cleanUpdates)
          .eq('user_id', resolvedUserId)
          .select()
          .limit(1) as any);

        if (updateError || !updateData || updateData.length === 0) {
          const cached = await storageEngine.get<UserSettingsEntity | null>(
            this.getScopedSettingsKey(resolvedUserId),
            null
          );
          const merged = { ...(cached || SUPABASE_DEFAULTS.settings), user_id: resolvedUserId, ...cleanUpdates };
          await storageEngine.set(this.getScopedSettingsKey(resolvedUserId), merged);
          return { settings: merged as UserSettingsEntity, error: updateError?.message || error.message };
        }

        const updated = updateData[0] as UserSettingsEntity;
        await storageEngine.set(this.getScopedSettingsKey(resolvedUserId), updated);
        return { settings: updated, error: null };
      }

      const updated = (Array.isArray(data) ? data[0] : data) as UserSettingsEntity;
      await storageEngine.set(this.getScopedSettingsKey(resolvedUserId), updated);
      console.log('[SettingsService] Cloud update confirmed for user_settings:', updated);
      return { settings: updated, error: null };
    } catch (err: any) {
      const cached = await storageEngine.get<UserSettingsEntity | null>(
        this.getScopedSettingsKey(resolvedUserId),
        null
      );
      const merged = { ...(cached || SUPABASE_DEFAULTS.settings), user_id: resolvedUserId, ...cleanUpdates };
      await storageEngine.set(this.getScopedSettingsKey(resolvedUserId), merged);
      return { settings: merged as UserSettingsEntity, error: err?.message || 'Failed to update settings.' };
    }
  }

  /**
   * Verifies that settings exist for the user; creates defaults if missing
   */
  public async ensureSettings(userId: string): Promise<UserSettingsEntity> {
    const { settings } = await this.getSettings(userId);
    if (settings) {
      return settings;
    }

    const createRes = await this.createDefaultSettings(userId);
    if (createRes.settings) {
      return createRes.settings;
    }

    // Local fallback defaults
    const fallback: UserSettingsEntity = {
      id: `local_settings_${userId}`,
      user_id: userId,
      theme: SUPABASE_DEFAULTS.settings.theme,
      time_format: SUPABASE_DEFAULTS.settings.time_format,
      sound_enabled: SUPABASE_DEFAULTS.settings.sound_enabled,
      notifications_enabled: SUPABASE_DEFAULTS.settings.notifications_enabled,
      default_water_duration: SUPABASE_DEFAULTS.settings.default_water_duration,
      default_look_outside_duration: SUPABASE_DEFAULTS.settings.default_look_outside_duration,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await storageEngine.set(this.getScopedSettingsKey(userId), fallback);
    return fallback;
  }
}

export const settingsService = new SettingsService();
