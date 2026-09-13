// src/services/lookOutsideConfigService.ts
// EyeFlow V2 — Official Supabase Look Outside Configuration Service

import { supabase } from './supabaseClient.ts';
import { storageEngine } from '../engine/storageEngine.ts';
import { SUPABASE_DEFAULTS } from '../config/supabase.config.ts';
import type { LookOutsideConfigEntity } from '../types/index.ts';

export class LookOutsideConfigService {
  /**
   * Returns user-scoped local storage key for look outside configuration
   */
  public getScopedLookOutsideKey(userId: string): string {
    return `eyeflow:v2:${userId}:lookOutside`;
  }

  /**
   * Fetch authenticated user's look outside configuration with local cache fallback
   */
  public async getLookOutsideConfig(userId: string): Promise<{ config: LookOutsideConfigEntity | null; error: string | null }> {
    if (!userId) {
      return { config: null, error: 'User ID is required to fetch look outside configuration.' };
    }

    try {
      const { data, error } = await supabase
        .from('look_outside_configurations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && !error) {
        const config = data[0] as LookOutsideConfigEntity;
        await storageEngine.set(this.getScopedLookOutsideKey(userId), config);
        return { config, error: null };
      }

      // Offline fallback: check local user-scoped cache
      const cached = await storageEngine.get<LookOutsideConfigEntity | null>(
        this.getScopedLookOutsideKey(userId),
        null
      );
      if (cached) {
        return { config: cached, error: null };
      }

      return { config: null, error: error ? error.message : 'Look outside configuration not found.' };
    } catch (err: any) {
      const cached = await storageEngine.get<LookOutsideConfigEntity | null>(
        this.getScopedLookOutsideKey(userId),
        null
      );
      if (cached) {
        return { config: cached, error: null };
      }
      return { config: null, error: err?.message || 'Failed to fetch look outside config.' };
    }
  }

  /**
   * Create default look outside configuration in Supabase
   */
  public async createDefaultLookOutsideConfig(
    userId: string,
    customDefaults?: Partial<LookOutsideConfigEntity>
  ): Promise<{ config: LookOutsideConfigEntity | null; error: string | null }> {
    if (!userId) {
      return { config: null, error: 'User ID is required to create look outside configuration.' };
    }

    const payload = {
      user_id: userId,
      enabled: customDefaults?.enabled !== undefined ? customDefaults.enabled : SUPABASE_DEFAULTS.lookOutside.enabled,
      interval_minutes: customDefaults?.interval_minutes || SUPABASE_DEFAULTS.lookOutside.interval_minutes,
      start_time: customDefaults?.start_time || SUPABASE_DEFAULTS.lookOutside.start_time,
      end_time: customDefaults?.end_time || SUPABASE_DEFAULTS.lookOutside.end_time,
      duration_seconds: customDefaults?.duration_seconds || SUPABASE_DEFAULTS.lookOutside.duration_seconds,
      active_days: customDefaults?.active_days || SUPABASE_DEFAULTS.lookOutside.active_days,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await ((supabase
        .from('look_outside_configurations') as any)
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .limit(1) as any);

      if (error) {
        return { config: null, error: error.message };
      }

      const created = (Array.isArray(data) ? data[0] : data) as LookOutsideConfigEntity || (payload as unknown as LookOutsideConfigEntity);
      await storageEngine.set(this.getScopedLookOutsideKey(userId), created);
      return { config: created, error: null };
    } catch (err: any) {
      return { config: null, error: err?.message || 'Failed to create default look outside configuration.' };
    }
  }

  /**
   * Update user look outside configuration in Supabase and local cache
   */
  public async updateLookOutsideConfig(
    userId: string,
    updates: Partial<Omit<LookOutsideConfigEntity, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<{ config: LookOutsideConfigEntity | null; error: string | null }> {
    if (!userId) {
      return { config: null, error: 'User ID is required to update look outside configuration.' };
    }

    const cleanUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.enabled !== undefined) {
      cleanUpdates.enabled = Boolean(updates.enabled);
    }
    if (updates.interval_minutes !== undefined) {
      const interval = Number(updates.interval_minutes);
      if (!isNaN(interval) && interval > 0) {
        cleanUpdates.interval_minutes = interval;
      }
    }
    if (updates.start_time !== undefined && typeof updates.start_time === 'string') {
      cleanUpdates.start_time = updates.start_time;
    }
    if (updates.end_time !== undefined && typeof updates.end_time === 'string') {
      cleanUpdates.end_time = updates.end_time;
    }
    if (updates.duration_seconds !== undefined) {
      const duration = Number(updates.duration_seconds);
      if (!isNaN(duration) && duration > 0) {
        cleanUpdates.duration_seconds = duration;
      }
    }
    if (updates.active_days !== undefined && Array.isArray(updates.active_days)) {
      cleanUpdates.active_days = updates.active_days;
    }

    try {
      const { data, error } = await ((supabase
        .from('look_outside_configurations') as any)
        .upsert({ user_id: userId, ...cleanUpdates }, { onConflict: 'user_id' })
        .select()
        .limit(1) as any);

      if (error) {
        console.warn('[LookOutsideConfigService] Cloud upsert warning, trying fallback update:', error.message);
        const { data: updateData, error: updateError } = await ((supabase
          .from('look_outside_configurations') as any)
          .update(cleanUpdates)
          .eq('user_id', userId)
          .select()
          .limit(1) as any);

        if (updateError || !updateData || updateData.length === 0) {
          const cached = await storageEngine.get<LookOutsideConfigEntity | null>(
            this.getScopedLookOutsideKey(userId),
            null
          );
          const merged = { ...(cached || SUPABASE_DEFAULTS.lookOutside), user_id: userId, ...cleanUpdates };
          await storageEngine.set(this.getScopedLookOutsideKey(userId), merged);
          return { config: merged as LookOutsideConfigEntity, error: updateError?.message || error.message };
        }

        const updated = updateData[0] as LookOutsideConfigEntity;
        await storageEngine.set(this.getScopedLookOutsideKey(userId), updated);
        return { config: updated, error: null };
      }

      const updated = (Array.isArray(data) ? data[0] : data) as LookOutsideConfigEntity;
      await storageEngine.set(this.getScopedLookOutsideKey(userId), updated);
      console.log('[LookOutsideConfigService] Cloud update confirmed for look_outside_configurations:', updated);
      return { config: updated, error: null };
    } catch (err: any) {
      const cached = await storageEngine.get<LookOutsideConfigEntity | null>(
        this.getScopedLookOutsideKey(userId),
        null
      );
      const merged = { ...(cached || SUPABASE_DEFAULTS.lookOutside), user_id: userId, ...cleanUpdates };
      await storageEngine.set(this.getScopedLookOutsideKey(userId), merged);
      return { config: merged as LookOutsideConfigEntity, error: err?.message || 'Failed to update look outside config.' };
    }
  }

  /**
   * Ensures look outside configuration exists for the user
   */
  public async ensureLookOutsideConfig(userId: string): Promise<LookOutsideConfigEntity> {
    const { config } = await this.getLookOutsideConfig(userId);
    if (config) {
      return config;
    }

    const createRes = await this.createDefaultLookOutsideConfig(userId);
    if (createRes.config) {
      return createRes.config;
    }

    // Local fallback
    const fallback: LookOutsideConfigEntity = {
      id: `local_screen_${userId}`,
      user_id: userId,
      enabled: SUPABASE_DEFAULTS.lookOutside.enabled,
      interval_minutes: SUPABASE_DEFAULTS.lookOutside.interval_minutes,
      start_time: SUPABASE_DEFAULTS.lookOutside.start_time,
      end_time: SUPABASE_DEFAULTS.lookOutside.end_time,
      duration_seconds: SUPABASE_DEFAULTS.lookOutside.duration_seconds,
      active_days: SUPABASE_DEFAULTS.lookOutside.active_days,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await storageEngine.set(this.getScopedLookOutsideKey(userId), fallback);
    return fallback;
  }
}

export const lookOutsideConfigService = new LookOutsideConfigService();
