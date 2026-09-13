// src/engine/v2SchedulerEngine.ts
// EyeFlow V2 — Fully User-Scoped Dynamic Reminder Engine
// Pure, deterministic scheduling derived strictly from device timestamp Date.now() and authenticated user context.

import type {
  UserScopedSchedulerInput,
  UserScopedScheduleResult,
  UserReminderOccurrence,
  UserReminderType,
  WaterConfig,
  ScreenBreakConfig,
} from '../types';

export class V2SchedulerEngine {
  /**
   * Generates a deterministic unique ID for each user-scoped reminder occurrence
   */
  public generateOccurrenceId(
    userId: string,
    type: UserReminderType,
    scheduledAtTimestamp: number
  ): string {
    return `${userId}:${type}:${scheduledAtTimestamp}`;
  }

  /**
   * Calculates a complete, reconciled daily schedule for the authenticated user
   */
  public generateUserSchedule(input: UserScopedSchedulerInput): UserScopedScheduleResult {
    if (!input.userId || typeof input.userId !== 'string') {
      throw new Error('V2SchedulerEngine: Authenticated userId is required to generate a schedule.');
    }

    const {
      userId,
      waterConfiguration,
      lookOutsideConfiguration,
      pauseState,
      currentTimestamp,
      existingEvents = [],
    } = input;

    const baseDate = new Date(currentTimestamp);
    const isPaused = Boolean(
      pauseState &&
        pauseState.isPaused &&
        pauseState.pauseUntil !== null &&
        new Date(pauseState.pauseUntil).getTime() > currentTimestamp
    );

    // Map existing event logs by their unique composite ID
    const existingMap = new Map<string, UserReminderOccurrence>();
    for (const ev of existingEvents) {
      if (ev.userId === userId) {
        existingMap.set(ev.id, ev);
      }
    }

    // 1. Water Occurrences Generation
    const waterOccurrences = this.generateOccurrencesForType(
      userId,
      'water',
      waterConfiguration,
      baseDate,
      currentTimestamp,
      existingMap,
      isPaused
    );

    // 2. Look Outside Occurrences Generation
    const lookOutsideOccurrences = this.generateOccurrencesForType(
      userId,
      'look_outside',
      lookOutsideConfiguration,
      baseDate,
      currentTimestamp,
      existingMap,
      isPaused
    );

    // 3. Reconcile Active Occurrences (Window: scheduledAt <= currentTimestamp < scheduledAt + durationSeconds)
    const activeWaterOccurrence =
      !isPaused
        ? waterOccurrences.find((o) => o.status === 'active') || null
        : null;

    const activeLookOutsideOccurrence =
      !isPaused
        ? lookOutsideOccurrences.find((o) => o.status === 'active') || null
        : null;

    // 4. Determine Next Upcoming Occurrences
    const nextWaterOccurrence = this.findNextOccurrenceForType(
      userId,
      'water',
      waterConfiguration,
      waterOccurrences,
      baseDate,
      currentTimestamp,
      isPaused
    );

    const nextLookOutsideOccurrence = this.findNextOccurrenceForType(
      userId,
      'look_outside',
      lookOutsideConfiguration,
      lookOutsideOccurrences,
      baseDate,
      currentTimestamp,
      isPaused
    );

    // 5. Next Overall Occurrence
    let nextOverallOccurrence: UserReminderOccurrence | null = null;
    if (nextWaterOccurrence && nextLookOutsideOccurrence) {
      if (nextWaterOccurrence.scheduledAt <= nextLookOutsideOccurrence.scheduledAt) {
        nextOverallOccurrence = nextWaterOccurrence;
      } else {
        nextOverallOccurrence = nextLookOutsideOccurrence;
      }
    } else if (nextWaterOccurrence) {
      nextOverallOccurrence = nextWaterOccurrence;
    } else if (nextLookOutsideOccurrence) {
      nextOverallOccurrence = nextLookOutsideOccurrence;
    }

    return {
      userId,
      calculatedAt: currentTimestamp,
      isPaused,
      waterOccurrences,
      lookOutsideOccurrences,
      activeWaterOccurrence,
      activeLookOutsideOccurrence,
      nextWaterOccurrence,
      nextLookOutsideOccurrence,
      nextOverallOccurrence,
    };
  }

  /**
   * Generates all occurrences for a specific reminder type for the given day
   */
  private generateOccurrencesForType(
    userId: string,
    type: UserReminderType,
    config: WaterConfig | ScreenBreakConfig,
    baseDate: Date,
    currentTimestamp: number,
    existingMap: Map<string, UserReminderOccurrence>,
    isPaused: boolean
  ): UserReminderOccurrence[] {
    if (!config || !config.enabled || !config.startTime || !config.endTime) {
      return [];
    }

    const activeDays =
      config.activeDays && config.activeDays.length > 0
        ? config.activeDays
        : [0, 1, 2, 3, 4, 5, 6];

    const isTodayActive = activeDays.includes(baseDate.getDay());
    if (!isTodayActive) {
      // Inactive day: zero pending/future occurrences for today
      return [];
    }

    const [startH, startM] = config.startTime.split(':').map(Number);
    const [endH, endM] = config.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const intervalMinutes =
      type === 'water'
        ? Math.max(1, (config as WaterConfig).intervalMinutes || 60)
        : Math.max(1, (config as ScreenBreakConfig).screenIntervalMinutes || 30);

    const durationSeconds =
      type === 'water'
        ? Math.max(1, ((config as WaterConfig).durationMinutes || 2) * 60)
        : Math.max(1, ((config as ScreenBreakConfig).breakDurationMinutes || 5) * 60);

    const occurrences: UserReminderOccurrence[] = [];
    const seenIds = new Set<string>();

    for (let m = startMinutes; m <= endMinutes; m += intervalMinutes) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      const slotDate = new Date(baseDate);
      slotDate.setHours(hour, minute, 0, 0);
      const scheduledAt = slotDate.getTime();
      const occurrenceId = this.generateOccurrenceId(userId, type, scheduledAt);

      // Duplicate Prevention: Guarantee unique ID per slot
      if (seenIds.has(occurrenceId)) {
        continue;
      }
      seenIds.add(occurrenceId);

      const existing = existingMap.get(occurrenceId);
      const endWindowTimestamp = scheduledAt + durationSeconds * 1000;

      if (existing && (existing.status === 'completed' || existing.status === 'skipped')) {
        occurrences.push(existing);
      } else if (currentTimestamp < scheduledAt) {
        // Strictly in the future -> pending
        occurrences.push({
          id: occurrenceId,
          userId,
          type,
          scheduledAt,
          timeString,
          durationSeconds,
          status: 'pending',
        });
      } else if (currentTimestamp >= scheduledAt && currentTimestamp < endWindowTimestamp) {
        // Inside active countdown window -> active with remaining seconds restored
        const remainingSeconds = Math.max(
          1,
          Math.ceil((endWindowTimestamp - currentTimestamp) / 1000)
        );
        occurrences.push({
          id: occurrenceId,
          userId,
          type,
          scheduledAt,
          timeString,
          durationSeconds,
          status: isPaused ? 'pending' : 'active',
          startedAt: scheduledAt,
          remainingSeconds,
        });
      } else {
        // Expired in previous session or missed while app was closed
        occurrences.push({
          id: occurrenceId,
          userId,
          type,
          scheduledAt,
          timeString,
          durationSeconds,
          status: 'expired',
        });
      }
    }

    return occurrences;
  }

  /**
   * Finds the next upcoming occurrence, rolling over to the next active day if today is complete or inactive
   */
  private findNextOccurrenceForType(
    userId: string,
    type: UserReminderType,
    config: WaterConfig | ScreenBreakConfig,
    todayOccurrences: UserReminderOccurrence[],
    baseDate: Date,
    currentTimestamp: number,
    isPaused: boolean
  ): UserReminderOccurrence | null {
    if (!config || !config.enabled || isPaused || !config.startTime || !config.endTime) {
      return null;
    }

    // 1. Look for next pending slot today
    const nextToday = todayOccurrences.find(
      (o) => o.scheduledAt > currentTimestamp + 1000 && o.status === 'pending'
    );
    if (nextToday) {
      return nextToday;
    }

    // 2. Rollover to next active day
    const activeDays =
      config.activeDays && config.activeDays.length > 0
        ? config.activeDays
        : [0, 1, 2, 3, 4, 5, 6];

    const [startH, startM] = config.startTime.split(':').map(Number);
    const durationSeconds =
      type === 'water'
        ? Math.max(1, ((config as WaterConfig).durationMinutes || 2) * 60)
        : Math.max(1, ((config as ScreenBreakConfig).breakDurationMinutes || 5) * 60);

    for (let offset = 1; offset <= 7; offset++) {
      const futureDate = new Date(baseDate);
      futureDate.setDate(futureDate.getDate() + offset);

      if (activeDays.includes(futureDate.getDay())) {
        futureDate.setHours(startH, startM, 0, 0);
        const scheduledAt = futureDate.getTime();
        const timeString = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

        return {
          id: this.generateOccurrenceId(userId, type, scheduledAt),
          userId,
          type,
          scheduledAt,
          timeString,
          durationSeconds,
          status: 'pending',
        };
      }
    }

    return null;
  }
}

/**
 * UserScopedReminderManager
 * Manages active in-memory timers strictly isolated per authenticated user session.
 */
export class UserScopedReminderManager {
  private activeUserId: string | null = null;
  private runningTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private firedOccurrenceIds: Set<string> = new Set();
  public readonly engine: V2SchedulerEngine;

  constructor(engine = new V2SchedulerEngine()) {
    this.engine = engine;
  }

  public getEngine(): V2SchedulerEngine {
    return this.engine;
  }

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  /**
   * Switches active authenticated user, clearing any existing timers
   */
  public setActiveUser(userId: string): void {
    if (this.activeUserId !== userId) {
      this.cancelAllTimers();
      this.firedOccurrenceIds.clear();
      this.activeUserId = userId;
    }
  }

  /**
   * Cleans up all active timers on logout
   */
  public clearActiveUser(): void {
    this.cancelAllTimers();
    this.firedOccurrenceIds.clear();
    this.activeUserId = null;
  }

  /**
   * Schedules a zero-polling timer for a future occurrence
   */
  public scheduleOccurrence(
    occurrence: UserReminderOccurrence,
    onTrigger: (occ: UserReminderOccurrence) => void
  ): boolean {
    if (!this.activeUserId || occurrence.userId !== this.activeUserId) {
      return false;
    }

    if (this.firedOccurrenceIds.has(occurrence.id)) {
      return false;
    }

    const delay = occurrence.scheduledAt - Date.now();
    if (delay <= 1000) {
      // Past or immediate threshold -> never trigger past reminders
      return false;
    }

    // Cancel existing timer for this ID if already queued
    if (this.runningTimers.has(occurrence.id)) {
      clearTimeout(this.runningTimers.get(occurrence.id)!);
      this.runningTimers.delete(occurrence.id);
    }

    const timer = setTimeout(() => {
      this.firedOccurrenceIds.add(occurrence.id);
      this.runningTimers.delete(occurrence.id);
      onTrigger(occurrence);
    }, delay);

    this.runningTimers.set(occurrence.id, timer);
    return true;
  }

  /**
   * Cancels all timers running for the session
   */
  public cancelAllTimers(): void {
    for (const timer of this.runningTimers.values()) {
      clearTimeout(timer);
    }
    this.runningTimers.clear();
  }

  public getRunningTimerCount(): number {
    return this.runningTimers.size;
  }
}

export const v2SchedulerEngine = new V2SchedulerEngine();
export const v2ReminderManager = new UserScopedReminderManager(v2SchedulerEngine);
