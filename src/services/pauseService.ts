// src/services/pauseService.ts
// PauseFlow — Authoritative Reminder Pause State & Cloud Synchronization Engine

import { supabase } from './supabaseClient.ts';
import { storageEngine } from '../engine/storageEngine.ts';
import { realtimeSyncService } from './realtimeSyncService.ts';
import { detectPlatform } from '../platform/systemLifecycle.ts';
import type { PauseState, ReminderPauseStateEntity } from '../types/index.ts';

export type { ReminderPauseStateEntity };

export class PauseService {
  /**
   * User-scoped storage key for local offline pause cache
   */
  public getScopedPauseKey(userId: string): string {
    return `pauseflow:v2:${userId}:pause_state`;
  }

  /**
   * Determines authoritatively whether reminders are actively paused at a given timestamp.
   * Compares the absolute paused_until timestamp against current timestamp.
   */
  public isRemindersPaused(
    pauseState?: PauseState | ReminderPauseStateEntity | null,
    currentTimestamp?: number
  ): boolean {
    if (!pauseState) return false;
    const until = 'pauseUntil' in pauseState ? pauseState.pauseUntil : pauseState.paused_until;
    if (!until) return false;

    const untilMs = new Date(until).getTime();
    if (isNaN(untilMs)) return false;

    const nowMs = currentTimestamp != null ? currentTimestamp : Date.now();
    return nowMs < untilMs;
  }

  /**
   * Returns remaining seconds in the active pause window, or 0 if active/expired.
   */
  public getRemainingPauseSeconds(
    pauseState?: PauseState | ReminderPauseStateEntity | null,
    currentTimestamp?: number
  ): number {
    if (!pauseState) return 0;
    const until = 'pauseUntil' in pauseState ? pauseState.pauseUntil : pauseState.paused_until;
    if (!until) return 0;

    const untilMs = new Date(until).getTime();
    if (isNaN(untilMs)) return 0;

    const nowMs = currentTimestamp != null ? currentTimestamp : Date.now();
    return Math.max(0, Math.floor((untilMs - nowMs) / 1000));
  }

  /**
   * Fetch authoritative pause state from Supabase with local cache fallback
   */
  public async getPauseState(userId: string): Promise<ReminderPauseStateEntity | null> {
    if (!userId) return null;

    try {
      const { data, error } = await (supabase
        .from('reminder_pause_state') as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[PauseFlow][Supabase][Error] Failed to fetch reminder_pause_state:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      }

      if (data && !error) {
        const entity = data as ReminderPauseStateEntity;
        // Update user-scoped local cache
        await storageEngine.set(this.getScopedPauseKey(userId), entity);
        return entity;
      }

      // If query returned null or errored (e.g. offline), fallback to local cache
      const cached = await storageEngine.get<ReminderPauseStateEntity | null>(
        this.getScopedPauseKey(userId),
        null
      );
      return cached;
    } catch (err) {
      console.warn('[PauseFlow][Supabase] getPauseState exception, falling back to local cache:', err);
      const cached = await storageEngine.get<ReminderPauseStateEntity | null>(
        this.getScopedPauseKey(userId),
        null
      );
      return cached;
    }
  }

  /**
   * Set Pause for a specified duration in minutes (or 'tomorrow' morning)
   * Sequence:
   *   1. Resolve authenticated user
   *   2. Persist to Supabase Database (reminder_pause_state UPSERT)
   *   3. Confirm persistence & record structured diagnostics
   *   4. Persist to local cache
   *   5. Broadcast Realtime event to other connected devices
   */
  public async setPause(
    requestedUserId: string,
    durationMinutes: number | 'tomorrow',
    deviceId?: string
  ): Promise<ReminderPauseStateEntity> {
    const now = new Date();
    let untilDate: Date;

    if (durationMinutes === 'tomorrow') {
      untilDate = new Date(now);
      untilDate.setDate(untilDate.getDate() + 1);
      untilDate.setHours(8, 0, 0, 0);
    } else {
      untilDate = new Date(now.getTime() + durationMinutes * 60 * 1000);
    }

    const platform = detectPlatform();
    const effectiveDeviceId = deviceId || platform;

    // 1. Authoritative Auth Verification
    let targetUserId = requestedUserId;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authData?.user?.id && !authError) {
        targetUserId = authData.user.id;
        console.log(`[PauseFlow][Auth] authenticated=true user_id=${targetUserId}`);
      } else {
        console.log(`[PauseFlow][Auth] authenticated=false user_id=null`);
      }
    } catch (authErr) {
      console.log(`[PauseFlow][Auth] authenticated=false user_id=null error=${authErr}`);
    }

    console.log('[PauseFlow][Pause]', {
      action: 'PAUSE_REQUESTED',
      platform,
      user_id: targetUserId,
      durationMinutes,
      paused_until: untilDate.toISOString(),
      device_id: effectiveDeviceId,
    });

    const entity: ReminderPauseStateEntity = {
      user_id: targetUserId,
      paused_until: untilDate.toISOString(),
      paused_at: now.toISOString(),
      paused_by_device_id: effectiveDeviceId,
      updated_at: now.toISOString(),
    };

    // 2. Supabase Database Write First
    try {
      console.log('[PauseFlow][Supabase]', {
        operation: 'UPSERT_PAUSE_STATE',
        table: 'reminder_pause_state',
        user_id: targetUserId,
        paused_until: entity.paused_until,
      });

      const { data, error } = await (supabase
        .from('reminder_pause_state') as any)
        .upsert(entity, { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.error('[PauseFlow][Supabase][Error] Table write failed:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.log('[PauseFlow][Supabase][Success] reminder_pause_state persisted:', data);
      }
    } catch (err: any) {
      console.error('[PauseFlow][Supabase][Exception] Cloud database write exception:', {
        message: err?.message || String(err),
      });
    }

    // 3. Local Cache Persistence
    await storageEngine.set(this.getScopedPauseKey(targetUserId), entity);

    // 4. Realtime Broadcast to All Devices
    await realtimeSyncService.broadcastPauseState(entity);

    return entity;
  }

  /**
   * Resume Reminders immediately (clears pause_until)
   * Sequence:
   *   1. Resolve authenticated user
   *   2. Persist to Supabase Database (reminder_pause_state UPSERT with paused_until = null)
   *   3. Confirm persistence & record structured diagnostics
   *   4. Persist to local cache
   *   5. Broadcast Realtime event to other connected devices
   */
  public async resume(requestedUserId: string, deviceId?: string): Promise<ReminderPauseStateEntity> {
    const nowIso = new Date().toISOString();
    const platform = detectPlatform();
    const effectiveDeviceId = deviceId || platform;

    // 1. Authoritative Auth Verification
    let targetUserId = requestedUserId;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authData?.user?.id && !authError) {
        targetUserId = authData.user.id;
        console.log(`[PauseFlow][Auth] authenticated=true user_id=${targetUserId}`);
      } else {
        console.log(`[PauseFlow][Auth] authenticated=false user_id=null`);
      }
    } catch (authErr) {
      console.log(`[PauseFlow][Auth] authenticated=false user_id=null error=${authErr}`);
    }

    console.log('[PauseFlow][Pause]', {
      action: 'RESUME_REQUESTED',
      platform,
      user_id: targetUserId,
      device_id: effectiveDeviceId,
    });

    const entity: ReminderPauseStateEntity = {
      user_id: targetUserId,
      paused_until: null,
      paused_at: null,
      paused_by_device_id: effectiveDeviceId,
      updated_at: nowIso,
    };

    // 2. Supabase Database Write First
    try {
      console.log('[PauseFlow][Supabase]', {
        operation: 'UPSERT_PAUSE_STATE',
        table: 'reminder_pause_state',
        user_id: targetUserId,
        paused_until: null,
      });

      const { data, error } = await (supabase
        .from('reminder_pause_state') as any)
        .upsert(entity, { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) {
        console.error('[PauseFlow][Supabase][Error] Table resume write failed:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.log('[PauseFlow][Supabase][Success] reminder_pause_state resumed in cloud:', data);
      }
    } catch (err: any) {
      console.error('[PauseFlow][Supabase][Exception] Cloud database resume exception:', {
        message: err?.message || String(err),
      });
    }

    // 3. Local Cache Persistence
    await storageEngine.set(this.getScopedPauseKey(targetUserId), entity);

    // 4. Realtime Broadcast to All Devices
    await realtimeSyncService.broadcastPauseState(entity);

    return entity;
  }

  /**
   * Maps a ReminderPauseStateEntity into the UI-compatible PauseState
   */
  public mapToPauseState(entity: ReminderPauseStateEntity | null, currentTimestamp?: number): PauseState {
    if (!entity || !entity.paused_until) {
      return {
        userId: entity?.user_id,
        isPaused: false,
        pauseUntil: null,
        pauseMinutes: null,
      };
    }

    const isPaused = this.isRemindersPaused(entity, currentTimestamp);
    return {
      userId: entity.user_id,
      isPaused,
      pauseUntil: isPaused ? entity.paused_until : null,
      pauseMinutes: isPaused ? Math.round(this.getRemainingPauseSeconds(entity, currentTimestamp) / 60) : null,
    };
  }
}

export const pauseService = new PauseService();
