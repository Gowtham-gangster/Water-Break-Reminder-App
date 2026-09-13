// src/services/waterConfigService.ts
// PauseFlow V2 — Official Supabase Water Configuration Service

import { supabase } from './supabaseClient.ts';
import { storageEngine } from '../engine/storageEngine.ts';
import { SUPABASE_DEFAULTS } from '../config/supabase.config.ts';
import type { WaterConfigEntity } from '../types/index.ts';

export class WaterConfigService {
  /**
   * Returns user-scoped local storage key for water configuration
   */
  public getScopedWaterKey(userId: string): string {
    return `pauseflow:v2:${userId}:water`;
  }

  /**
   * Fetch authenticated user's water configuration with local cache fallback
   */
  public async getWaterConfig(userId: string): Promise<{ config: WaterConfigEntity | null; error: string | null }> {
    if (!userId) {
      return { config: null, error: 'User ID is required to fetch water configuration.' };
    }

    try {
      const { data, error } = await supabase
        .from('water_configurations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && !error) {
        const config = data[0] as WaterConfigEntity;
        await storageEngine.set(this.getScopedWaterKey(userId), config);
        return { config, error: null };
      }

      // Offline fallback: check local user-scoped cache
      const cached = await storageEngine.get<WaterConfigEntity | null>(
        this.getScopedWaterKey(userId),
        null
      );
      if (cached) {
        return { config: cached, error: null };
      }

      return { config: null, error: error ? error.message : 'Water configuration not found.' };
    } catch (err: any) {
      const cached = await storageEngine.get<WaterConfigEntity | null>(
        this.getScopedWaterKey(userId),
        null
      );
      if (cached) {
        return { config: cached, error: null };
      }
      return { config: null, error: err?.message || 'Failed to fetch water config.' };
    }
  }

  /**
   * Create default water configuration in Supabase
   */
  public async createDefaultWaterConfig(
    userId: string,
    customDefaults?: Partial<WaterConfigEntity>
  ): Promise<{ config: WaterConfigEntity | null; error: string | null }> {
    if (!userId) {
      return { config: null, error: 'User ID is required to create water configuration.' };
    }

    const payload = {
      user_id: userId,
      enabled: customDefaults?.enabled !== undefined ? customDefaults.enabled : SUPABASE_DEFAULTS.water.enabled,
      interval_minutes: customDefaults?.interval_minutes || SUPABASE_DEFAULTS.water.interval_minutes,
      start_time: customDefaults?.start_time || SUPABASE_DEFAULTS.water.start_time,
      end_time: customDefaults?.end_time || SUPABASE_DEFAULTS.water.end_time,
      duration_seconds: customDefaults?.duration_seconds || SUPABASE_DEFAULTS.water.duration_seconds,
      active_days: customDefaults?.active_days || SUPABASE_DEFAULTS.water.active_days,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await ((supabase
        .from('water_configurations') as any)
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .limit(1) as any);

      if (error) {
        return { config: null, error: error.message };
      }

      const created = (Array.isArray(data) ? data[0] : data) as WaterConfigEntity || (payload as unknown as WaterConfigEntity);
      await storageEngine.set(this.getScopedWaterKey(userId), created);
      return { config: created, error: null };
    } catch (err: any) {
      return { config: null, error: err?.message || 'Failed to create default water configuration.' };
    }
  }

  /**
   * Update user water configuration in Supabase and local cache
   */
  public async updateWaterConfig(
    userId: string,
    updates: Partial<Omit<WaterConfigEntity, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<{ config: WaterConfigEntity | null; error: string | null }> {
    if (!userId) {
      return { config: null, error: 'User ID is required to update water configuration.' };
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
      // 1. Check if row exists or upsert directly
      const { data, error } = await ((supabase
        .from('water_configurations') as any)
        .upsert({ user_id: userId, ...cleanUpdates }, { onConflict: 'user_id' })
        .select()
        .limit(1) as any);

      if (error) {
        console.warn('[WaterConfigService] Cloud upsert warning, trying fallback update:', error.message);
        // Fallback update
        const { data: updateData, error: updateError } = await ((supabase
          .from('water_configurations') as any)
          .update(cleanUpdates)
          .eq('user_id', userId)
          .select()
          .limit(1) as any);

        if (updateError || !updateData || updateData.length === 0) {
          const cached = await storageEngine.get<WaterConfigEntity | null>(
            this.getScopedWaterKey(userId),
            null
          );
          const merged = { ...(cached || SUPABASE_DEFAULTS.water), user_id: userId, ...cleanUpdates };
          await storageEngine.set(this.getScopedWaterKey(userId), merged);
          return { config: merged as WaterConfigEntity, error: updateError?.message || error.message };
        }

        const updated = updateData[0] as WaterConfigEntity;
        await storageEngine.set(this.getScopedWaterKey(userId), updated);
        return { config: updated, error: null };
      }

      const updated = (Array.isArray(data) ? data[0] : data) as WaterConfigEntity;
      await storageEngine.set(this.getScopedWaterKey(userId), updated);
      console.log('[WaterConfigService] Cloud update confirmed for water_configurations:', updated);
      return { config: updated, error: null };
    } catch (err: any) {
      const cached = await storageEngine.get<WaterConfigEntity | null>(
        this.getScopedWaterKey(userId),
        null
      );
      const merged = { ...(cached || SUPABASE_DEFAULTS.water), user_id: userId, ...cleanUpdates };
      await storageEngine.set(this.getScopedWaterKey(userId), merged);
      return { config: merged as WaterConfigEntity, error: err?.message || 'Failed to update water config.' };
    }
  }

  /**
   * Ensures water configuration exists for the user
   */
  public async ensureWaterConfig(userId: string): Promise<WaterConfigEntity> {
    const { config } = await this.getWaterConfig(userId);
    if (config) {
      return config;
    }

    const createRes = await this.createDefaultWaterConfig(userId);
    if (createRes.config) {
      return createRes.config;
    }

    // Local fallback
    const fallback: WaterConfigEntity = {
      id: `local_water_${userId}`,
      user_id: userId,
      enabled: SUPABASE_DEFAULTS.water.enabled,
      interval_minutes: SUPABASE_DEFAULTS.water.interval_minutes,
      start_time: SUPABASE_DEFAULTS.water.start_time,
      end_time: SUPABASE_DEFAULTS.water.end_time,
      duration_seconds: SUPABASE_DEFAULTS.water.duration_seconds,
      active_days: SUPABASE_DEFAULTS.water.active_days,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await storageEngine.set(this.getScopedWaterKey(userId), fallback);
    return fallback;
  }
}

export const waterConfigService = new WaterConfigService();
