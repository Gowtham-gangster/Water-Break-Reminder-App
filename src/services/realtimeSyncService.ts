// src/services/realtimeSyncService.ts
// PauseFlow V2 — Supabase Realtime Multi-Device Synchronization Channel Manager

import { supabase } from './supabaseClient.ts';
import { SUPABASE_CONFIG } from '../config/supabase.config.ts';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  WaterConfigEntity,
  LookOutsideConfigEntity,
  UserSettingsEntity,
  ProfileEntity,
  ReminderEventEntity,
} from '../types/index.ts';
import type { ReminderPauseStateEntity } from './pauseService.ts';

export type RealtimeSyncCallback<T> = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
}) => void;

export type RealtimeChannelStatus = 'SUBSCRIBED' | 'CONNECTING' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export class RealtimeSyncService {
  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;
  private currentStatus: RealtimeChannelStatus = 'CLOSED';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private lastEventTimestamp: string | null = null;
  private lastEventTable: string | null = null;

  private waterConfigListeners: Set<RealtimeSyncCallback<WaterConfigEntity>> = new Set();
  private lookOutsideConfigListeners: Set<RealtimeSyncCallback<LookOutsideConfigEntity>> = new Set();
  private settingsListeners: Set<RealtimeSyncCallback<UserSettingsEntity>> = new Set();
  private profileListeners: Set<RealtimeSyncCallback<ProfileEntity>> = new Set();
  private reminderEventListeners: Set<RealtimeSyncCallback<ReminderEventEntity>> = new Set();
  private pauseStateListeners: Set<RealtimeSyncCallback<ReminderPauseStateEntity>> = new Set();
  private statusListeners: Set<(status: RealtimeChannelStatus) => void> = new Set();

  public getStatus(): RealtimeChannelStatus {
    return this.currentStatus;
  }

  public getLastEvent(): { timestamp: string | null; table: string | null } {
    return {
      timestamp: this.lastEventTimestamp,
      table: this.lastEventTable,
    };
  }

  private setStatus(status: RealtimeChannelStatus): void {
    this.currentStatus = status;
    console.log(`[Realtime] Subscription status: ${status}`);
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (_) {}
    });
  }

  /**
   * Subscribe to user-scoped Realtime postgres changes
   */
  public subscribe(userId: string): RealtimeChannel | null {
    if (!userId) return null;

    // If already actively subscribed or actively connecting to this exact user channel, reuse
    if (this.channel && this.currentUserId === userId && (this.currentStatus === 'SUBSCRIBED' || this.currentStatus === 'CONNECTING')) {
      return this.channel;
    }

    // Clean up previous subscription if switching user or reconnecting
    this.unsubscribe();
    this.currentUserId = userId;
    this.setStatus('CONNECTING');

    const channelName = `user_sync_${userId}`;
    const projectHost = new URL(SUPABASE_CONFIG.url).hostname;
    console.log(`[PauseFlow][Realtime][Pause] creating channel = ${channelName}`);
    console.log(`[PauseFlow][Realtime][Pause] userId = ${userId}`);
    console.log(`[PauseFlow][Realtime][Pause] project = ${projectHost}`);

    try {
      this.channel = supabase
        .channel(channelName)
        // 1. Water Configurations
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'water_configurations',
          },
          (payload: any) => {
            const rowUserId = payload?.new?.user_id || payload?.old?.user_id;
            if (rowUserId && rowUserId !== this.currentUserId) return;

            console.log('[Realtime] water UPDATE received:', payload.new || payload.old);
            this.lastEventTimestamp = new Date().toISOString();
            this.lastEventTable = 'water_configurations';
            this.waterConfigListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (e) {
                console.warn('[Realtime] Water listener error:', e);
              }
            });
          }
        )
        // 2. Look Outside Configurations
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'look_outside_configurations',
          },
          (payload: any) => {
            const rowUserId = payload?.new?.user_id || payload?.old?.user_id;
            if (rowUserId && rowUserId !== this.currentUserId) return;

            console.log('[Realtime] look_outside UPDATE received:', payload.new || payload.old);
            this.lastEventTimestamp = new Date().toISOString();
            this.lastEventTable = 'look_outside_configurations';
            this.lookOutsideConfigListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (e) {
                console.warn('[Realtime] Look Outside listener error:', e);
              }
            });
          }
        )
        // 3. User Settings
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_settings',
          },
          (payload: any) => {
            const rowUserId = payload?.new?.user_id || payload?.old?.user_id;
            if (rowUserId && rowUserId !== this.currentUserId) return;

            console.log('[Realtime] settings UPDATE received:', payload.new || payload.old);
            this.lastEventTimestamp = new Date().toISOString();
            this.lastEventTable = 'user_settings';
            this.settingsListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (e) {
                console.warn('[Realtime] Settings listener error:', e);
              }
            });
          }
        )
        // 4. Profiles (Avatar, Display Name, Timezone)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
          },
          (payload: any) => {
            const rowId = payload?.new?.id || payload?.old?.id;
            if (rowId && rowId !== this.currentUserId) {
              console.log(`[PROFILE REALTIME] IGNORED FOREIGN USER: ${rowId} !== ${this.currentUserId}`);
              return;
            }

            console.log('[PROFILE REALTIME] UPDATE RECEIVED:', payload.new || payload.old);
            this.lastEventTimestamp = new Date().toISOString();
            this.lastEventTable = 'profiles';
            this.profileListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (e) {
                console.warn('[PROFILE REALTIME] Profile listener error:', e);
              }
            });
          }
        )
        // 5. Reminder Events
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reminder_events',
          },
          (payload: any) => {
            const rowUserId = payload?.new?.user_id || payload?.old?.user_id;
            if (rowUserId && rowUserId !== this.currentUserId) return;

            console.log('[Realtime] reminder_event INSERT/UPDATE received:', payload.new || payload.old);
            this.lastEventTimestamp = new Date().toISOString();
            this.lastEventTable = 'reminder_events';
            this.reminderEventListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (e) {
                console.warn('[Realtime] Reminder event listener error:', e);
              }
            });
          }
        )
        // 6a. Global Reminder Pause State - Postgres Changes
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reminder_pause_state',
          },
          (payload: any) => {
            const rowUserId = payload?.new?.user_id || payload?.old?.user_id;
            if (rowUserId && rowUserId !== this.currentUserId) return;

            console.log('[PauseFlow][Realtime][Pause] event = POSTGRES_UPDATE user_id =', rowUserId, 'paused_until =', payload.new?.paused_until);
            this.lastEventTimestamp = new Date().toISOString();
            this.lastEventTable = 'reminder_pause_state';
            this.pauseStateListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (e) {
                console.warn('[Realtime] Pause state listener error:', e);
              }
            });
          }
        )
        // 6b. Global Reminder Pause State - Broadcast Channel
        .on(
          'broadcast',
          { event: 'pause_state' },
          (msg: any) => {
            const payload = msg?.payload;
            if (!payload || payload.user_id !== this.currentUserId) return;

            console.log('[PauseFlow][Realtime][Pause] event = BROADCAST_UPDATE user_id =', payload.user_id, 'paused_until =', payload.paused_until);
            this.lastEventTimestamp = new Date().toISOString();
            this.lastEventTable = 'reminder_pause_state';
            this.pauseStateListeners.forEach((cb) => {
              try {
                cb({
                  eventType: payload.paused_until ? 'UPDATE' : 'DELETE',
                  new: payload,
                  old: {},
                });
              } catch (e) {
                console.warn('[Realtime] Pause broadcast listener error:', e);
              }
            });
          }
        )
        .subscribe((status, err) => {
          if (err) {
            console.warn('[PauseFlow][Realtime][Pause] Subscription warning/error:', err);
          }
          if (status === 'SUBSCRIBED') {
            this.setStatus('SUBSCRIBED');
            console.log(`[PauseFlow][Realtime][Pause] channel = ${channelName} status = SUBSCRIBED`);
            this.reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            this.setStatus('CHANNEL_ERROR');
            console.error(`[PauseFlow][Realtime][Pause] channel = ${channelName} status = CHANNEL_ERROR:`, err);
            this.scheduleReconnect();
          } else if (status === 'TIMED_OUT') {
            this.setStatus('TIMED_OUT');
            console.warn(`[PauseFlow][Realtime][Pause] channel = ${channelName} status = TIMED_OUT`);
            this.scheduleReconnect();
          } else if (status === 'CLOSED') {
            this.setStatus('CLOSED');
            console.log(`[PauseFlow][Realtime][Pause] channel = ${channelName} status = CLOSED`);
          }
        });

      return this.channel;
    } catch (err) {
      console.warn('[Realtime] Failed to initialize Realtime channel:', err);
      this.setStatus('CHANNEL_ERROR');
      console.error('[PROFILE REALTIME] CHANNEL ERROR on init:', err);
      this.scheduleReconnect();
      return null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.currentUserId) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const backoffMs = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000 + Math.random() * 500);
    this.reconnectAttempts++;
    console.log(`[Realtime] Scheduling reconnection attempt in ${Math.round(backoffMs)}ms...`);

    this.reconnectTimer = setTimeout(() => {
      if (this.currentUserId) {
        console.log('[Realtime] Attempting scheduled reconnection...');
        this.subscribe(this.currentUserId);
      }
    }, backoffMs);
  }

  /**
   * Cleanly unsubscribe and remove the channel
   */
  public unsubscribe(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) {
      try {
        console.log(`[Realtime] Unsubscribing channel for user: ${this.currentUserId}`);
        supabase.removeChannel(this.channel);
      } catch (err) {
        console.warn('[Realtime] Unsubscribe exception:', err);
      }
      this.channel = null;
    }
    this.currentUserId = null;
    this.setStatus('CLOSED');
  }

  // Listener registration hooks
  public onWaterConfigChange(cb: RealtimeSyncCallback<WaterConfigEntity>): () => void {
    this.waterConfigListeners.add(cb);
    return () => this.waterConfigListeners.delete(cb);
  }

  public onLookOutsideConfigChange(cb: RealtimeSyncCallback<LookOutsideConfigEntity>): () => void {
    this.lookOutsideConfigListeners.add(cb);
    return () => this.lookOutsideConfigListeners.delete(cb);
  }

  public onSettingsChange(cb: RealtimeSyncCallback<UserSettingsEntity>): () => void {
    this.settingsListeners.add(cb);
    return () => this.settingsListeners.delete(cb);
  }

  public onProfileChange(cb: RealtimeSyncCallback<ProfileEntity>): () => void {
    this.profileListeners.add(cb);
    return () => this.profileListeners.delete(cb);
  }

  public onReminderEventChange(cb: RealtimeSyncCallback<ReminderEventEntity>): () => void {
    this.reminderEventListeners.add(cb);
    return () => this.reminderEventListeners.delete(cb);
  }

  public onPauseStateChange(cb: RealtimeSyncCallback<ReminderPauseStateEntity>): () => void {
    this.pauseStateListeners.add(cb);
    return () => this.pauseStateListeners.delete(cb);
  }

  /**
   * Broadcasts a pause/resume update to all active devices of the authenticated user
   */
  public async broadcastPauseState(payload: ReminderPauseStateEntity): Promise<boolean> {
    if (!payload?.user_id) return false;

    let activeChannel = this.channel;
    if (!activeChannel || this.currentUserId !== payload.user_id) {
      console.log(`[PauseFlow][Realtime][Pause] Initializing channel for user ${payload.user_id} before broadcast`);
      activeChannel = this.subscribe(payload.user_id);
    }

    if (!activeChannel) {
      console.warn('[PauseFlow][Realtime][Pause] No active channel available for user:', payload.user_id);
      return false;
    }

    // If channel is connecting, wait up to 3.5s for subscription readiness
    if (this.currentStatus !== 'SUBSCRIBED') {
      console.log(`[PauseFlow][Realtime][Pause] Channel is in state [${this.currentStatus}], awaiting SUBSCRIBED...`);
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 3500);
        const check = () => {
          if (this.currentStatus === 'SUBSCRIBED' || this.currentStatus === 'CHANNEL_ERROR') {
            clearTimeout(timeout);
            resolve();
          }
        };
        const unsub = this.onStatusChange(() => {
          check();
          unsub();
        });
      });
    }

    try {
      console.log(`[PauseFlow][Realtime][Pause] Broadcasting pause_state to user_sync_${payload.user_id}:`, payload);
      const res = await activeChannel.send({
        type: 'broadcast',
        event: 'pause_state',
        payload,
      });
      console.log(`[PauseFlow][Realtime][Pause] Broadcast delivery status: ${res}`);
      return res === 'ok';
    } catch (err) {
      console.warn('[PauseFlow][Realtime][Pause] Failed to broadcast pause state:', err);
      return false;
    }
  }

  public onStatusChange(cb: (status: RealtimeChannelStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }
}

export const realtimeSyncService = new RealtimeSyncService();

