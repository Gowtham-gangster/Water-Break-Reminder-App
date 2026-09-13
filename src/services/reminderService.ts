// src/services/reminderService.ts
// EyeFlow V2 — Authoritative Reminder Lifecycle, Database Sync, Statistics & History Service

import { supabase } from './supabaseClient.ts';
import { authService } from './authService.ts';
import { performanceDiagnostics } from './performanceDiagnostics.ts';
import { developmentDiagnostics } from './developmentDiagnostics.ts';
import type { ReminderEventEntity, WaterConfig, ScreenBreakConfig } from '../types/index.ts';

export type ReminderEventType = 'water' | 'look_outside';
export type ReminderEventStatus = 'scheduled' | 'triggered' | 'completed' | 'expired' | 'cancelled';

export interface LocalReminderEvent extends ReminderEventEntity {
  sync_status?: 'synced' | 'pending' | 'failed';
}

export interface UserStatistics {
  waterCompleted: number;
  waterMissed: number;
  screenCompleted: number;
  screenMissed: number;
  dailyCompletionRate: number;
  weeklyCompletionRate: number;
  currentStreak: number;
  bestStreak: number;
  totalWaterReminders: number;
  totalScreenBreaks: number;
  monthlyTrends: Array<{
    date: string;
    waterCompleted: number;
    waterMissed: number;
    screenCompleted: number;
    screenMissed: number;
    completionRate: number;
  }>;
  today: {
    waterCompleted: number;
    waterMissed: number;
    waterScheduled: number;
    screenCompleted: number;
    screenMissed: number;
    screenScheduled: number;
  };
}

export interface UserHistoryResponse {
  events: ReminderEventEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HistoryQueryOptions {
  range?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom';
  type?: 'all' | 'water' | 'look_outside';
  status?: 'all' | 'completed' | 'expired' | 'cancelled' | 'triggered';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// Helper to generate RFC4122 v4 UUID
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get user's local date string (YYYY-MM-DD) formatted according to the given or detected timezone
 */
export function getLocalDateString(date: Date | string | number = new Date(), timeZone?: string): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch (_) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Authoritative expected reminder count calculation shared across Web, Windows, and Android
 */
export function calculateAuthoritativeExpected(
  cfg?: {
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
    intervalMinutes?: number;
    screenIntervalMinutes?: number;
    activeDays?: number[];
    quietHoursEnabled?: boolean;
    quietStartTime?: string;
    quietEndTime?: string;
  },
  targetDate: Date = new Date(),
  defaultInterval: number = 45
): number {
  if (!cfg || !cfg.enabled) return 0;
  const activeDays = cfg.activeDays && cfg.activeDays.length > 0 ? cfg.activeDays : [0, 1, 2, 3, 4, 5, 6];
  if (!activeDays.includes(targetDate.getDay())) return 0;

  const interval = Math.max(1, cfg.intervalMinutes || cfg.screenIntervalMinutes || defaultInterval);
  const [sh, sm] = (cfg.startTime || '09:00').split(':').map(Number);
  const [eh, em] = (cfg.endTime || '18:00').split(':').map(Number);
  const startM = (isNaN(sh) ? 9 : sh) * 60 + (isNaN(sm) ? 0 : sm);
  const endM = (isNaN(eh) ? 18 : eh) * 60 + (isNaN(em) ? 0 : em);

  if (endM < startM) return 0;

  let quietStart = -1;
  let quietEnd = -1;
  if (cfg.quietHoursEnabled && cfg.quietStartTime && cfg.quietEndTime) {
    const [qsH, qsM] = cfg.quietStartTime.split(':').map(Number);
    const [qeH, qeM] = cfg.quietEndTime.split(':').map(Number);
    quietStart = qsH * 60 + qsM;
    quietEnd = qeH * 60 + qeM;
  }

  let count = 0;
  for (let m = startM; m <= endM; m += interval) {
    if (quietStart !== -1 && quietEnd !== -1) {
      if (quietStart <= quietEnd && m >= quietStart && m <= quietEnd) continue;
      if (quietStart > quietEnd && (m >= quietStart || m <= quietEnd)) continue;
    }
    count++;
  }
  return count;
}

// Convert slot string (e.g. "water:2026-09-12:17:00", "10:00", or ISO) to ISO scheduled_at
export function parseSlotToISO(slotIdOrTime: string | number, baseDate: Date = new Date()): string {
  if (typeof slotIdOrTime === 'number') {
    return new Date(slotIdOrTime).toISOString();
  }
  const str = String(slotIdOrTime);
  // Check if already full ISO string
  if (str.includes('T') && (str.includes('Z') || str.includes('+') || str.includes('-'))) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }

  // Format: category:YYYY-MM-DD:HH:mm (e.g. "water:2026-09-12:17:00")
  const parts = str.split(':');
  if (parts.length >= 4) {
    const dateStr = parts[1]; // YYYY-MM-DD
    const hour = Number(parts[2]);
    const min = Number(parts[3]);
    if (!isNaN(hour) && !isNaN(min)) {
      const d = new Date(baseDate);
      if (dateStr && dateStr.includes('-')) {
        const [yr, mo, dy] = dateStr.split('-').map(Number);
        if (!isNaN(yr) && !isNaN(mo) && !isNaN(dy)) {
          d.setFullYear(yr, mo - 1, dy);
        }
      }
      d.setHours(hour, min, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Format: HH:mm (e.g. "17:00" or "water-17:00")
  const timeMatch = str.match(/(?:^|[^0-9])(\d{1,2}):(\d{2})(?:$|[^0-9])/);
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = Number(timeMatch[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const d = new Date(baseDate);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    }
  }

  return new Date(baseDate).toISOString();
}

export type ReminderEventListener = (event: LocalReminderEvent) => void;

export interface TodayProgress {
  water: {
    completed: number;
    expected: number;
    progressPercentage: number;
  };
  lookOutside: {
    completed: number;
    expected: number;
    progressPercentage: number;
  };
}

class ReminderService {
  private listeners: Set<ReminderEventListener> = new Set();

  public onReminderEvent(listener: ReminderEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(event: LocalReminderEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('[ReminderService] Listener notification error:', err);
      }
    });
  }

  // Key generators for user-scoped local storage
  private getEventsStorageKey(userId: string): string {
    return `eyeflow:v2:${userId}:reminder_events`;
  }

  private getOfflineQueueStorageKey(userId: string): string {
    return `eyeflow:v2:${userId}:offline_reminder_events`;
  }

  private getSlotUUIDMapKey(userId: string): string {
    return `eyeflow:v2:${userId}:slot_uuid_map`;
  }

  private memoryStore: Map<string, string> = new Map();

  private getStorageItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (_) {}
    }
    return this.memoryStore.get(key) || null;
  }

  private setStorageItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (_) {}
    }
    this.memoryStore.set(key, value);
  }

  /**
   * Deterministic UUID mapping per reminder occurrence
   */
  public getOrCreateEventId(userId: string, type: string, slotKey: string | number): string {
    const mapKey = this.getSlotUUIDMapKey(userId);
    let map: Record<string, string> = {};
    try {
      const raw = this.getStorageItem(mapKey);
      if (raw) map = JSON.parse(raw);
    } catch (_) {}

    const key = `${type}:${slotKey}`;
    if (map[key]) {
      return map[key];
    }

    const newUUID = generateUUID();
    map[key] = newUUID;
    try {
      const keys = Object.keys(map);
      if (keys.length > 500) {
        delete map[keys[0]];
      }
      this.setStorageItem(mapKey, JSON.stringify(map));
    } catch (_) {}

    return newUUID;
  }

  /**
   * Get cached local events for a user
   */
  public getLocalEvents(userId: string): LocalReminderEvent[] {
    if (!userId) return [];
    try {
      const raw = this.getStorageItem(this.getEventsStorageKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('[ReminderService] Error reading local events:', err);
      return [];
    }
  }

  /**
   * Save local events cache for a user
   */
  public saveLocalEvents(userId: string, events: LocalReminderEvent[]): void {
    if (!userId) return;
    try {
      this.setStorageItem(this.getEventsStorageKey(userId), JSON.stringify(events));
    } catch (err) {
      console.warn('[ReminderService] Error saving local events:', err);
    }
  }

  /**
   * Get offline queue for a user
   */
  public getOfflineQueue(userId: string): LocalReminderEvent[] {
    if (!userId) return [];
    try {
      const raw = this.getStorageItem(this.getOfflineQueueStorageKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('[ReminderService] Error reading offline queue:', err);
      return [];
    }
  }

  /**
   * Save offline queue for a user
   */
  public saveOfflineQueue(userId: string, queue: LocalReminderEvent[]): void {
    if (!userId) return;
    try {
      this.setStorageItem(this.getOfflineQueueStorageKey(userId), JSON.stringify(queue));
    } catch (err) {
      console.warn('[ReminderService] Error saving offline queue:', err);
    }
  }

  /**
   * Core internal method to record or update a reminder event lifecycle state
   */
  private async persistEvent(
    userId: string,
    eventData: {
      id?: string;
      type: 'water' | 'look_outside' | 'screen';
      scheduled_at?: string;
      started_at?: string | null;
      completed_at?: string | null;
      status: ReminderEventStatus;
      slotId?: string | number;
    }
  ): Promise<LocalReminderEvent> {
    const normalizedType: 'water' | 'look_outside' =
      eventData.type === 'screen' || eventData.type === 'look_outside' ? 'look_outside' : 'water';

    const slotKey = eventData.slotId || eventData.scheduled_at || Date.now();
    const eventId = eventData.id || this.getOrCreateEventId(userId, normalizedType, slotKey);
    const nowIso = new Date().toISOString();

    const scheduledAt = eventData.scheduled_at
      ? (eventData.scheduled_at.includes('T') ? eventData.scheduled_at : parseSlotToISO(eventData.scheduled_at))
      : parseSlotToISO(slotKey);

    // Read local cache
    const currentEvents = this.getLocalEvents(userId);
    const existingIndex = currentEvents.findIndex((e) => e.id === eventId);

    let localEvent: LocalReminderEvent;

    if (existingIndex >= 0) {
      localEvent = {
        ...currentEvents[existingIndex],
        status: eventData.status,
        started_at: eventData.started_at !== undefined ? eventData.started_at : currentEvents[existingIndex].started_at,
        completed_at: eventData.completed_at !== undefined ? eventData.completed_at : currentEvents[existingIndex].completed_at,
        updated_at: nowIso,
        sync_status: 'pending',
      };
      currentEvents[existingIndex] = localEvent;
    } else {
      localEvent = {
        id: eventId,
        user_id: userId,
        type: normalizedType,
        scheduled_at: scheduledAt,
        started_at: eventData.started_at || (eventData.status === 'triggered' || eventData.status === 'scheduled' ? nowIso : null),
        completed_at: eventData.completed_at || (eventData.status === 'completed' ? nowIso : null),
        status: eventData.status,
        created_at: nowIso,
        updated_at: nowIso,
        sync_status: 'pending',
      };
      currentEvents.unshift(localEvent);
    }

    const uiStart = performance.now();

    // 1. Save optimistic local state immediately
    this.saveLocalEvents(userId, currentEvents);

    // 2. Queue for offline sync
    const offlineQueue = this.getOfflineQueue(userId);
    const queueIndex = offlineQueue.findIndex((e) => e.id === eventId);
    if (queueIndex >= 0) {
      offlineQueue[queueIndex] = localEvent;
    } else {
      offlineQueue.push(localEvent);
    }
    this.saveOfflineQueue(userId, offlineQueue);

    // 3. Mark Local UI Update duration
    performanceDiagnostics.markLocalUiUpdate(performance.now() - uiStart);

    // 4. Record write start timestamp
    performanceDiagnostics.recordWriteStart(eventId);

    // 5. Attempt background cloud sync immediately (zero blocking)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.syncEventToSupabase(userId, localEvent).catch((err) => {
        console.warn('[ReminderService] Background Supabase sync error:', err);
      });
    }

    // 6. Notify all reactive subscribers immediately
    this.notifyListeners(localEvent);

    return localEvent;
  }

  private async resolveUserId(userId?: string): Promise<string | null> {
    if (userId) return userId;
    try {
      const user = await authService.getCurrentUser();
      if (user?.id) return user.id;
      const session = (await supabase.auth.getSession()).data.session;
      if (session?.user?.id) return session.user.id;
    } catch (_) {}
    return null;
  }

  /**
   * Sync a single event to Supabase with performance tracking
   */
  private async syncEventToSupabase(userId: string, event: LocalReminderEvent): Promise<boolean> {
    try {
      const activeUserId = userId || (await this.resolveUserId()) || '';
      if (!activeUserId) {
        console.warn('[ReminderService] Cannot sync event to Supabase: No active user ID.');
        return false;
      }

      const payload: Partial<ReminderEventEntity> = {
        id: event.id,
        user_id: activeUserId,
        type: event.type,
        scheduled_at: event.scheduled_at,
        started_at: event.started_at,
        completed_at: event.completed_at,
        status: event.status,
        updated_at: new Date().toISOString(),
      };

      console.log('[ReminderService] Upserting event to Supabase reminder_events:', payload);

      const writeStart = performance.now();
      const { data, error } = await supabase.from('reminder_events').upsert(payload as any, { onConflict: 'id' }).select();
      const elapsed = performanceDiagnostics.recordWriteEnd(event.id) || Math.round(performance.now() - writeStart);

      if (error) {
        console.error('[ReminderService] Supabase reminder_events upsert error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return false;
      }

      console.log(`[ReminderService] Supabase reminder_events upsert SUCCESS in ${elapsed}ms:`, data);

      // Mark event as synced locally
      const localEvents = this.getLocalEvents(activeUserId);
      const idx = localEvents.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        localEvents[idx].sync_status = 'synced';
        this.saveLocalEvents(activeUserId, localEvents);
      }

      // Remove from offline queue
      const queue = this.getOfflineQueue(activeUserId);
      const remaining = queue.filter((e) => e.id !== event.id);
      this.saveOfflineQueue(activeUserId, remaining);

      return true;
    } catch (err) {
      console.error('[ReminderService] Network sync exception:', err);
      return false;
    }
  }

  // ========================================================
  // LIFECYCLE METHODS
  // ========================================================

  public async recordScheduled(
    userId: string,
    type: 'water' | 'look_outside' | 'screen',
    slotIdOrTime: string | number
  ): Promise<LocalReminderEvent> {
    const targetUserId = (await this.resolveUserId(userId)) || 'local_user';
    return this.persistEvent(targetUserId, {
      type,
      slotId: slotIdOrTime,
      status: 'scheduled',
    });
  }

  public async recordTriggered(
    userId: string,
    type: 'water' | 'look_outside' | 'screen',
    slotIdOrTime: string | number,
    scheduledAt?: string
  ): Promise<LocalReminderEvent> {
    const targetUserId = (await this.resolveUserId(userId)) || 'local_user';
    return this.persistEvent(targetUserId, {
      type,
      slotId: slotIdOrTime,
      scheduled_at: scheduledAt,
      started_at: new Date().toISOString(),
      status: 'triggered',
    });
  }

  public async recordStarted(
    userId: string,
    type: 'water' | 'look_outside' | 'screen',
    slotIdOrTime: string | number
  ): Promise<LocalReminderEvent> {
    const targetUserId = (await this.resolveUserId(userId)) || 'local_user';
    return this.persistEvent(targetUserId, {
      type,
      slotId: slotIdOrTime,
      started_at: new Date().toISOString(),
      status: 'triggered',
    });
  }

  public async recordCompleted(
    userId: string,
    type: 'water' | 'look_outside' | 'screen',
    slotIdOrTime: string | number,
    scheduledAt?: string,
    completedAt?: string
  ): Promise<LocalReminderEvent> {
    const targetUserId = (await this.resolveUserId(userId)) || 'local_user';
    const nowIso = completedAt || new Date().toISOString();
    return this.persistEvent(targetUserId, {
      type,
      slotId: slotIdOrTime,
      scheduled_at: scheduledAt,
      completed_at: nowIso,
      status: 'completed',
    });
  }

  public async recordExpired(
    userId: string,
    type: 'water' | 'look_outside' | 'screen',
    slotIdOrTime: string | number
  ): Promise<LocalReminderEvent> {
    const targetUserId = (await this.resolveUserId(userId)) || 'local_user';
    return this.persistEvent(targetUserId, {
      type,
      slotId: slotIdOrTime,
      status: 'expired',
    });
  }

  public async recordCancelled(
    userId: string,
    type: 'water' | 'look_outside' | 'screen',
    slotIdOrTime: string | number
  ): Promise<LocalReminderEvent> {
    const targetUserId = (await this.resolveUserId(userId)) || 'local_user';
    return this.persistEvent(targetUserId, {
      type,
      slotId: slotIdOrTime,
      status: 'cancelled',
    });
  }

  // ========================================================
  // OFFLINE SYNC FLUSH (BATCHED HIGH-SPEED OPTIMIZATION)
  // ========================================================

  public async flushOfflineEvents(userId?: string): Promise<number> {
    let currentUserId = userId;
    if (!currentUserId) {
      const user = await authService.getCurrentUser();
      currentUserId = user?.id;
    }
    if (!currentUserId) return 0;

    const queue = this.getOfflineQueue(currentUserId);
    if (queue.length === 0) return 0;

    const flushStart = performance.now();

    // 1. Try Batched Upsert First (1 single network roundtrip for all queued events)
    try {
      const payloads = queue.map((ev) => ({
        id: ev.id,
        user_id: currentUserId,
        type: ev.type,
        scheduled_at: ev.scheduled_at,
        started_at: ev.started_at,
        completed_at: ev.completed_at,
        status: ev.status,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('reminder_events')
        .upsert(payloads as any, { onConflict: 'id' });

      if (!error) {
        const localEvents = this.getLocalEvents(currentUserId);
        const queuedIds = new Set(queue.map((q) => q.id));
        localEvents.forEach((l) => {
          if (queuedIds.has(l.id)) l.sync_status = 'synced';
        });
        this.saveLocalEvents(currentUserId, localEvents);
        this.saveOfflineQueue(currentUserId, []);
        const duration = Math.round(performance.now() - flushStart);
        performanceDiagnostics.markBackgroundSync(duration);
        console.log(`[ReminderService] Batched flush of ${queue.length} events completed in ${duration}ms.`);
        return queue.length;
      }
    } catch (batchErr) {
      console.warn('[ReminderService] Batched flush failed, falling back to sequential item sync:', batchErr);
    }

    // 2. Sequential Fallback
    let successCount = 0;
    const remainingQueue: LocalReminderEvent[] = [];

    for (const ev of queue) {
      const synced = await this.syncEventToSupabase(currentUserId, ev);
      if (synced) {
        successCount++;
      } else {
        remainingQueue.push(ev);
      }
    }

    this.saveOfflineQueue(currentUserId, remainingQueue);
    performanceDiagnostics.markBackgroundSync(Math.round(performance.now() - flushStart));
    return successCount;
  }

  /**
   * Fast incremental delta synchronization (fetches only records changed after cursor)
   */
  public async syncDelta(userId: string, lastSyncTimestamp?: string): Promise<{ updatedCount: number; lastSyncAt: string }> {
    const nowIso = new Date().toISOString();
    if (!userId || typeof navigator === 'undefined' || !navigator.onLine) {
      return { updatedCount: 0, lastSyncAt: nowIso };
    }

    const start = performance.now();
    try {
      const cursor = lastSyncTimestamp || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('reminder_events')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', cursor)
        .order('updated_at', { ascending: true })
        .limit(200);

      if (!error && data && data.length > 0) {
        const local = this.getLocalEvents(userId);
        const localMap = new Map<string, LocalReminderEvent>();
        local.forEach((l) => localMap.set(l.id, l));

        data.forEach((r: any) => {
          const existing = localMap.get(r.id);
          const status = existing?.status === 'completed' ? 'completed' : r.status;
          localMap.set(r.id, {
            id: r.id,
            user_id: r.user_id,
            type: r.type,
            scheduled_at: r.scheduled_at,
            started_at: r.started_at,
            completed_at: r.completed_at || existing?.completed_at || null,
            status,
            created_at: r.created_at,
            updated_at: r.updated_at,
            sync_status: 'synced',
          });
        });

        const merged = Array.from(localMap.values()).sort(
          (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
        );
        this.saveLocalEvents(userId, merged);
        performanceDiagnostics.markBackgroundSync(Math.round(performance.now() - start));
        return { updatedCount: data.length, lastSyncAt: nowIso };
      }
    } catch (err) {
      console.warn('[ReminderService] Delta sync error:', err);
    }
    return { updatedCount: 0, lastSyncAt: nowIso };
  }

  /**
   * Reconciles a remote event received from Supabase Realtime into the local cache immediately
   */
  public ingestRemoteEvent(userId: string, remoteEvent: ReminderEventEntity): LocalReminderEvent {
    const local = this.getLocalEvents(userId);
    const idx = local.findIndex((e) => e.id === remoteEvent.id);
    let updated: LocalReminderEvent;

    if (idx >= 0) {
      // Conflict safety: never downgrade a local completed status
      const existingStatus = local[idx].status;
      const finalStatus = existingStatus === 'completed' ? 'completed' : remoteEvent.status;

      updated = {
        ...local[idx],
        ...remoteEvent,
        status: finalStatus,
        completed_at: remoteEvent.completed_at || local[idx].completed_at,
        sync_status: 'synced',
      };
      local[idx] = updated;
    } else {
      updated = {
        ...remoteEvent,
        sync_status: 'synced',
      };
      local.unshift(updated);
    }

    this.saveLocalEvents(userId, local);
    this.notifyListeners(updated);
    return updated;
  }

  /**
   * Merge local cache events with authoritative cloud events.
   * Remote cloud events take precedence unless the local event has an un-synced pending status with newer timestamp.
   */
  public mergeEvents(localEvents: LocalReminderEvent[], cloudEvents: ReminderEventEntity[]): LocalReminderEvent[] {
    const map = new Map<string, LocalReminderEvent>();

    // First, seed with local events
    localEvents.forEach((l) => map.set(l.id, l));

    // Next, update with authoritative cloud events
    cloudEvents.forEach((c) => {
      const local = map.get(c.id);
      if (!local) {
        map.set(c.id, { ...c, sync_status: 'synced' });
      } else {
        // If local has pending write with newer updated_at timestamp, keep local; otherwise adopt authoritative cloud state
        if (
          local.sync_status === 'pending' &&
          local.updated_at &&
          c.updated_at &&
          new Date(local.updated_at).getTime() > new Date(c.updated_at).getTime()
        ) {
          // Keep local pending write
        } else {
          map.set(c.id, { ...c, sync_status: 'synced' });
        }
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.scheduled_at || b.created_at).getTime() - new Date(a.scheduled_at || a.created_at).getTime()
    );
  }

  // ========================================================
  // TODAY & REAL-TIME QUERIES
  // ========================================================

  /**
   * Get all reminder events for today's local date (timezone aware)
   */
  public async getTodayEvents(userId: string, timeZone?: string): Promise<ReminderEventEntity[]> {
    if (!userId) return [];
    const tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const todayLocal = getLocalDateString(new Date(), tz);

    // 1. Get from local cache
    const local = this.getLocalEvents(userId);
    const localToday = local.filter((e) => {
      const dateKey = getLocalDateString(new Date(e.completed_at || e.scheduled_at || e.created_at), tz);
      return dateKey === todayLocal;
    });

    // 2. If online, fetch recent events and merge with Supabase
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('reminder_events')
          .select('*')
          .eq('user_id', userId)
          .order('scheduled_at', { ascending: false })
          .limit(300);

        if (!error && data) {
          developmentDiagnostics.setReminderEventFetch('SYNCED');
          const merged = this.mergeEvents(local, data as ReminderEventEntity[]);
          this.saveLocalEvents(userId, merged);

          return merged.filter((e) => {
            const dateKey = getLocalDateString(new Date(e.completed_at || e.scheduled_at || e.created_at), tz);
            return dateKey === todayLocal;
          });
        } else if (error) {
          developmentDiagnostics.setReminderEventFetch('ERROR', error.message);
        }
      } catch (err) {
        console.warn('[ReminderService] Failed to fetch today events from cloud:', err);
      }
    }

    return localToday;
  }

  /**
   * Comprehensive user statistics calculated from real reminder events (100% Shared Business Logic)
   */
  public async getStatistics(
    userId?: string,
    configs?: { waterConfig?: WaterConfig; screenBreakConfig?: ScreenBreakConfig; timeZone?: string }
  ): Promise<UserStatistics> {
    let currentUserId = userId;
    if (!currentUserId) {
      const user = await authService.getCurrentUser();
      currentUserId = user?.id;
    }
    const defaultStats: UserStatistics = {
      waterCompleted: 0,
      waterMissed: 0,
      screenCompleted: 0,
      screenMissed: 0,
      dailyCompletionRate: 0,
      weeklyCompletionRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalWaterReminders: 0,
      totalScreenBreaks: 0,
      monthlyTrends: [],
      today: {
        waterCompleted: 0,
        waterMissed: 0,
        waterScheduled: 0,
        screenCompleted: 0,
        screenMissed: 0,
        screenScheduled: 0,
      },
    };

    if (!currentUserId) return defaultStats;

    const tz = configs?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const now = new Date();
    const todayLocal = getLocalDateString(now, tz);

    // 1. Fetch all events for user from Supabase or local cache
    let events: ReminderEventEntity[] = this.getLocalEvents(currentUserId);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('reminder_events')
          .select('*')
          .eq('user_id', currentUserId)
          .order('scheduled_at', { ascending: false })
          .limit(2000);

        if (!error && data) {
          developmentDiagnostics.setReminderEventFetch('SYNCED');
          events = this.mergeEvents(events as LocalReminderEvent[], data as ReminderEventEntity[]);
          this.saveLocalEvents(currentUserId, events as LocalReminderEvent[]);
        }
      } catch (err) {
        console.warn('[ReminderService] Error fetching statistics events from cloud:', err);
      }
    }

    let waterCompleted = 0;
    let waterMissed = 0;
    let screenCompleted = 0;
    let screenMissed = 0;
    let todayWaterCompleted = 0;
    let todayWaterMissed = 0;
    let todayScreenCompleted = 0;
    let todayScreenMissed = 0;

    // Daily breakdown for streak and trends (keyed by local YYYY-MM-DD in user's timezone)
    const dailyMap = new Map<string, { waterCompleted: number; waterMissed: number; screenCompleted: number; screenMissed: number }>();

    for (const ev of events) {
      const eventDate = getLocalDateString(new Date(ev.completed_at || ev.scheduled_at || ev.created_at), tz);
      const isToday = eventDate === todayLocal;

      if (!dailyMap.has(eventDate)) {
        dailyMap.set(eventDate, { waterCompleted: 0, waterMissed: 0, screenCompleted: 0, screenMissed: 0 });
      }
      const dayData = dailyMap.get(eventDate)!;

      if (ev.type === 'water') {
        if (ev.status === 'completed') {
          waterCompleted++;
          dayData.waterCompleted++;
          if (isToday) todayWaterCompleted++;
        } else if (ev.status === 'expired' || ev.status === 'cancelled') {
          waterMissed++;
          dayData.waterMissed++;
          if (isToday) todayWaterMissed++;
        }
      } else if (ev.type === 'look_outside' || (ev.type as any) === 'screen') {
        if (ev.status === 'completed') {
          screenCompleted++;
          dayData.screenCompleted++;
          if (isToday) todayScreenCompleted++;
        } else if (ev.status === 'expired' || ev.status === 'cancelled') {
          screenMissed++;
          dayData.screenMissed++;
          if (isToday) todayScreenMissed++;
        }
      }
    }

    // Expected daily targets calculated authoritatively from schedule configs & active days
    const expectedWaterToday = calculateAuthoritativeExpected(configs?.waterConfig, now, 45);
    const expectedScreenToday = calculateAuthoritativeExpected(configs?.screenBreakConfig, now, 20);

    const totalTodayExpected = expectedWaterToday + expectedScreenToday;
    const totalTodayCompleted = todayWaterCompleted + todayScreenCompleted;

    const dailyCompletionRate =
      totalTodayExpected > 0
        ? Math.min(100, Math.round((totalTodayCompleted / totalTodayExpected) * 100))
        : totalTodayCompleted > 0
        ? 100
        : 0;

    // Calculate Streak (consecutive days with at least 1 completed reminder)
    let bestStreak = 0;
    let tempStreak = 0;

    // Sort days chronologically
    const sortedDays = Array.from(dailyMap.keys()).sort();

    for (let i = 0; i < sortedDays.length; i++) {
      const dayKey = sortedDays[i];
      const data = dailyMap.get(dayKey)!;
      if (data.waterCompleted > 0 || data.screenCompleted > 0) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    // Calculate current streak backwards from today or yesterday
    let checkDate = new Date(now);
    let streakCount = 0;

    while (true) {
      const dKey = getLocalDateString(checkDate, tz);
      const data = dailyMap.get(dKey);
      if (data && (data.waterCompleted > 0 || data.screenCompleted > 0)) {
        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dKey === todayLocal) {
        // If today has 0 completions yet, check if yesterday maintained a streak
        checkDate.setDate(checkDate.getDate() - 1);
        const yData = dailyMap.get(getLocalDateString(checkDate, tz));
        if (yData && (yData.waterCompleted > 0 || yData.screenCompleted > 0)) {
          continue;
        }
        break;
      } else {
        break;
      }
    }
    const currentStreak = streakCount;
    if (currentStreak > bestStreak) bestStreak = currentStreak;

    // Calculate last 7 days weekly rate with per-day expected calculation
    let weeklyCompleted = 0;
    let weeklyTarget = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dKey = getLocalDateString(d, tz);
      const dData = dailyMap.get(dKey);
      if (dData) {
        weeklyCompleted += dData.waterCompleted + dData.screenCompleted;
      }
      weeklyTarget +=
        calculateAuthoritativeExpected(configs?.waterConfig, d, 45) +
        calculateAuthoritativeExpected(configs?.screenBreakConfig, d, 20);
    }
    const weeklyCompletionRate =
      weeklyTarget > 0
        ? Math.min(100, Math.round((weeklyCompleted / weeklyTarget) * 100))
        : weeklyCompleted > 0
        ? 100
        : 0;

    // Monthly trends (past 30 days)
    const monthlyTrends: UserStatistics['monthlyTrends'] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dKey = getLocalDateString(d, tz);
      const dData = dailyMap.get(dKey) || { waterCompleted: 0, waterMissed: 0, screenCompleted: 0, screenMissed: 0 };
      const dayTotal = dData.waterCompleted + dData.screenCompleted;
      const dayExpected =
        calculateAuthoritativeExpected(configs?.waterConfig, d, 45) +
        calculateAuthoritativeExpected(configs?.screenBreakConfig, d, 20);
      monthlyTrends.push({
        date: dKey,
        waterCompleted: dData.waterCompleted,
        waterMissed: dData.waterMissed,
        screenCompleted: dData.screenCompleted,
        screenMissed: dData.screenMissed,
        completionRate:
          dayExpected > 0
            ? Math.min(100, Math.round((dayTotal / dayExpected) * 100))
            : dayTotal > 0
            ? 100
            : 0,
      });
    }

    return {
      waterCompleted,
      waterMissed,
      screenCompleted,
      screenMissed,
      dailyCompletionRate,
      weeklyCompletionRate,
      currentStreak,
      bestStreak,
      totalWaterReminders: events.filter((e) => e.type === 'water').length,
      totalScreenBreaks: events.filter((e) => e.type === 'look_outside' || (e.type as any) === 'screen').length,
      monthlyTrends,
      today: {
        waterCompleted: todayWaterCompleted,
        waterMissed: todayWaterMissed,
        waterScheduled: expectedWaterToday,
        screenCompleted: todayScreenCompleted,
        screenMissed: todayScreenMissed,
        screenScheduled: expectedScreenToday,
      },
    };
  }

  /**
   * Authoritative Today's Progress shared between Home and Statistics
   */
  public async getTodayProgress(
    userId?: string,
    configs?: { waterConfig?: WaterConfig; screenBreakConfig?: ScreenBreakConfig; timeZone?: string }
  ): Promise<TodayProgress> {
    const stats = await this.getStatistics(userId, configs);
    const waterCompleted = stats.today.waterCompleted;
    const waterExpected = stats.today.waterScheduled;
    const screenCompleted = stats.today.screenCompleted;
    const screenExpected = stats.today.screenScheduled;

    return {
      water: {
        completed: waterCompleted,
        expected: waterExpected,
        progressPercentage: waterExpected > 0 ? Math.min(100, Math.round((waterCompleted / waterExpected) * 100)) : 0,
      },
      lookOutside: {
        completed: screenCompleted,
        expected: screenExpected,
        progressPercentage: screenExpected > 0 ? Math.min(100, Math.round((screenCompleted / screenExpected) * 100)) : 0,
      },
    };
  }

  /**
   * Diagnostic summary for cross-device state verification (Dev only, zero sensitive data)
   */
  public async getCrossDeviceDiagnostics(
    userId?: string,
    configs?: { waterConfig?: WaterConfig; screenBreakConfig?: ScreenBreakConfig; timeZone?: string }
  ) {
    const activeUserId = userId || (await this.resolveUserId()) || 'unknown';
    const stats = await this.getStatistics(activeUserId, configs);
    const offlineQueue = this.getOfflineQueue(activeUserId);

    return {
      userId: activeUserId,
      supabaseProject: 'https://hwrsvdrhqenraeuqfqle.supabase.co',
      timeZone: configs?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      lastEvaluatedAt: new Date().toISOString(),
      offlinePendingCount: offlineQueue.length,
      todayWaterCompleted: stats.today.waterCompleted,
      todayWaterExpected: stats.today.waterScheduled,
      todayScreenCompleted: stats.today.screenCompleted,
      todayScreenExpected: stats.today.screenScheduled,
      dailyCompletionRate: stats.dailyCompletionRate,
      weeklyCompletionRate: stats.weeklyCompletionRate,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
    };
  }

  // ========================================================
  // HISTORY QUERIES
  // ========================================================

  public async getHistory(
    userId?: string,
    options: HistoryQueryOptions & { timeZone?: string } = {}
  ): Promise<UserHistoryResponse> {
    let currentUserId = userId;
    if (!currentUserId) {
      const user = await authService.getCurrentUser();
      currentUserId = user?.id;
    }
    const page = options.page || 1;
    const limit = options.limit || 20;

    const defaultResponse: UserHistoryResponse = {
      events: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };

    if (!currentUserId) return defaultResponse;

    const tz = options.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // 1. Fetch events from cloud if online, fallback to local storage
    let allEvents: ReminderEventEntity[] = this.getLocalEvents(currentUserId);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        let query = supabase
          .from('reminder_events')
          .select('*')
          .eq('user_id', currentUserId)
          .order('scheduled_at', { ascending: false });

        if (options.type && options.type !== 'all') {
          query = query.eq('type', options.type);
        }
        if (options.status && options.status !== 'all') {
          query = query.eq('status', options.status);
        }

        const { data, error } = await query;
        if (!error && data) {
          allEvents = this.mergeEvents(allEvents as LocalReminderEvent[], data as ReminderEventEntity[]);
        }
      } catch (err) {
        console.warn('[ReminderService] Error fetching history from cloud:', err);
      }
    }

    // 2. Filter by range and dates respecting user timezone
    const now = new Date();
    const todayLocal = getLocalDateString(now, tz);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLocal = getLocalDateString(yesterday, tz);

    let filtered = allEvents.filter((e) => {
      // Type filter
      if (options.type && options.type !== 'all') {
        const norm = (e.type as string) === 'screen' ? 'look_outside' : e.type;
        if (norm !== options.type) return false;
      }
      // Status filter
      if (options.status && options.status !== 'all') {
        if (e.status !== options.status) return false;
      }

      const eventDate = getLocalDateString(new Date(e.completed_at || e.scheduled_at || e.created_at), tz);

      if (options.range === 'today') {
        return eventDate === todayLocal;
      }
      if (options.range === 'yesterday') {
        return eventDate === yesterdayLocal;
      }
      if (options.range === 'this_week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(e.completed_at || e.scheduled_at || e.created_at) >= weekAgo;
      }
      if (options.range === 'this_month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return new Date(e.completed_at || e.scheduled_at || e.created_at) >= monthAgo;
      }
      if (options.range === 'custom' && (options.startDate || options.endDate)) {
        if (options.startDate && eventDate < options.startDate) return false;
        if (options.endDate && eventDate > options.endDate) return false;
        return true;
      }
      return true;
    });

    // Sort descending by scheduled_at / created_at
    filtered.sort((a, b) => {
      const timeA = new Date(a.scheduled_at || a.created_at).getTime();
      const timeB = new Date(b.scheduled_at || b.created_at).getTime();
      return timeB - timeA;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginatedEvents = filtered.slice(offset, offset + limit);

    return {
      events: paginatedEvents,
      total,
      page,
      limit,
      totalPages,
    };
  }
}

export const reminderService = new ReminderService();
