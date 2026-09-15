// Real-Time Dynamic Scheduler Engine for PauseFlow
// Pure, deterministic, real-time calculation derived from device Date.now()
import type {
  WaterConfig,
  ScreenBreakConfig,
  PauseState,
  WaterReminderLog,
  ScreenBreakLog,
} from '../types';
import { pauseService } from '../services/pauseService.ts';

export interface NextReminderInfo {
  type: 'water' | 'screen';
  id: string;
  time: string;
  scheduledTimestamp: number;
  label: string;
  durationMinutes: number;
}

export interface EngineScheduleResult {
  waterSlots: WaterReminderLog[];
  nextWaterSlot: WaterReminderLog | null;
  waterCompletedCount: number;
  waterTotalCount: number;

  screenSlots: ScreenBreakLog[];
  nextScreenSlot: ScreenBreakLog | null;
  screenCompletedCount: number;
  screenTotalCount: number;
  screenBreakMinutesCompleted: number;

  nextOverallSlot: NextReminderInfo | null;
}

/**
 * Generates a deterministic RFC4122 UUID from an arbitrary input string.
 * Guarantees that Windows, Android, Web, and Supabase share the identical database ID.
 */
export function generateDeterministicUUID(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ (ch << 5), 1597334677);
    h3 = Math.imul(h3 ^ (ch << 11), 3812015801);
    h4 = Math.imul(h4 ^ (ch << 17), 2718281829);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = (h4 >>> 0).toString(16).padStart(8, '0');

  const p1 = hex1;
  const p2 = hex2.slice(0, 4);
  const p3 = '5' + hex2.slice(5, 8);
  const variantNibble = ((parseInt(hex3[0], 16) & 0x3) | 0x8).toString(16);
  const p4 = variantNibble + hex3.slice(1, 4);
  const p5 = hex3.slice(4, 8) + hex4;

  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export class ReminderEngineService {
  private firedReminders: Set<string> = new Set();

  /**
   * Generates a deterministic unique ID for each reminder event
   * Includes type, calendar date, and scheduled time string
   */
  public generateSlotId(type: 'water' | 'screen' | 'look_outside', dateStr: string, timeStr: string): string {
    const norm = type === 'look_outside' ? 'screen' : type;
    return `${norm}:${dateStr}:${timeStr}`;
  }

  /**
   * Generates a canonical occurrence ID recognized across all platforms
   */
  public generateCanonicalOccurrenceId(type: 'water' | 'screen' | 'look_outside', dateStr: string, timeStr: string): string {
    const norm = type === 'screen' ? 'look_outside' : type;
    return `${norm}:${dateStr}:${timeStr}`;
  }

  /**
   * Checks if an event has already fired in the current runtime session
   */
  public hasFired(slotId: string): boolean {
    return this.firedReminders.has(slotId);
  }

  /**
   * Marks an event as fired
   */
  public markFired(slotId: string): void {
    this.firedReminders.add(slotId);
  }

  /**
   * Resets fired set (e.g. on date rollover or clean restart)
   */
  public clearFiredHistory(): void {
    this.firedReminders.clear();
  }

  /**
   * Generates all valid timeline occurrences for a given day
   */
  public generateDailyOccurrences(
    baseDate: Date,
    startTime: string,
    endTime: string,
    intervalMinutes: number
  ): Array<{ timeString: string; timestamp: number }> {
    const [startH, startM] = (startTime || '08:00').split(':').map(Number);
    const [endH, endM] = (endTime || '22:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const interval = Math.max(1, intervalMinutes || 30);

    const occurrences: Array<{ timeString: string; timestamp: number }> = [];

    for (let m = startMinutes; m <= endMinutes; m += interval) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      const slotDate = new Date(baseDate);
      slotDate.setHours(hour, minute, 0, 0);

      occurrences.push({
        timeString,
        timestamp: slotDate.getTime(),
      });
    }

    return occurrences;
  }

  /**
   * Generates a rolling multi-day schedule (e.g. today + tomorrow + day after tomorrow / 72 hours)
   * Guarantees Android AlarmManager has future alarms registered ahead of time so overnight reminders fire
   * without requiring the user to open the app every morning.
   */
  public generateRollingSchedule(
    waterConfig: WaterConfig,
    screenConfig: ScreenBreakConfig,
    pauseState: PauseState,
    userId: string,
    daysAhead: number = 3,
    customNow?: Date
  ): Array<{
    id: string;
    category: 'water' | 'screen' | 'daily_summary';
    title: string;
    body: string;
    scheduledTimestamp: number;
    durationSeconds: number;
    userId: string;
  }> {
    if (!userId || userId === 'default_user' || userId === 'local_user') {
      return [];
    }

    const now = customNow || new Date();
    const currentTimestamp = now.getTime();
    const isCurrentlyPaused = pauseService.isRemindersPaused(pauseState, currentTimestamp);

    if (isCurrentlyPaused) {
      return [];
    }

    const rollingNotifications: Array<{
      id: string;
      category: 'water' | 'screen' | 'daily_summary';
      title: string;
      body: string;
      scheduledTimestamp: number;
      durationSeconds: number;
      userId: string;
    }> = [];

    const waterActiveDays =
      waterConfig.activeDays && waterConfig.activeDays.length > 0
        ? waterConfig.activeDays
        : [0, 1, 2, 3, 4, 5, 6];
    const screenActiveDays =
      screenConfig.activeDays && screenConfig.activeDays.length > 0
        ? screenConfig.activeDays
        : [0, 1, 2, 3, 4, 5, 6];

    let quietStart = -1;
    let quietEnd = -1;
    if (
      waterConfig.quietHoursEnabled &&
      waterConfig.quietStartTime &&
      waterConfig.quietEndTime
    ) {
      const [qsH, qsM] = waterConfig.quietStartTime.split(':').map(Number);
      const [qeH, qeM] = waterConfig.quietEndTime.split(':').map(Number);
      quietStart = qsH * 60 + qsM;
      quietEnd = qeH * 60 + qeM;
    }

    const isQuietTime = (m: number) => {
      if (quietStart === -1 || quietEnd === -1) return false;
      if (quietStart <= quietEnd) {
        return m >= quietStart && m <= quietEnd;
      }
      return m >= quietStart || m <= quietEnd;
    };

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const targetDayOfWeek = targetDate.getDay();
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(targetDate.getDate()).padStart(2, '0')}`;

      // 1. Water Reminders for target day
      if (
        waterConfig.enabled &&
        waterActiveDays.includes(targetDayOfWeek) &&
        waterConfig.startTime &&
        waterConfig.endTime
      ) {
        const interval = Math.max(1, waterConfig.intervalMinutes || 60);
        const occurrences = this.generateDailyOccurrences(
          targetDate,
          waterConfig.startTime,
          waterConfig.endTime,
          interval
        );

        for (const occ of occurrences) {
          const [h, min] = occ.timeString.split(':').map(Number);
          const m = h * 60 + min;
          if (isQuietTime(m)) continue;

          // Strictly future occurrences (> now + 2000ms)
          if (occ.timestamp > currentTimestamp + 2000) {
            const slotId = this.generateSlotId('water', dateStr, occ.timeString);
            rollingNotifications.push({
              id: slotId,
              category: 'water',
              title: '💧 Time for water',
              body: 'Take a 2-minute water break.',
              scheduledTimestamp: occ.timestamp,
              durationSeconds: (waterConfig.durationMinutes || 2) * 60,
              userId,
            });
          }
        }
      }

      // 2. Look Outside Screen Breaks for target day
      if (
        screenConfig.enabled &&
        screenActiveDays.includes(targetDayOfWeek) &&
        screenConfig.startTime &&
        screenConfig.endTime
      ) {
        const interval = Math.max(1, screenConfig.screenIntervalMinutes || 30);
        const breakDuration = screenConfig.breakDurationMinutes || 5;
        const occurrences = this.generateDailyOccurrences(
          targetDate,
          screenConfig.startTime,
          screenConfig.endTime,
          interval
        );

        for (const occ of occurrences) {
          // Strictly future occurrences (> now + 2000ms)
          if (occ.timestamp > currentTimestamp + 2000) {
            const slotId = this.generateSlotId('screen', dateStr, occ.timeString);
            rollingNotifications.push({
              id: slotId,
              category: 'screen',
              title: '👁 Look outside',
              body: 'Give your eyes a short break from the screen.',
              scheduledTimestamp: occ.timestamp,
              durationSeconds: breakDuration * 60,
              userId,
            });
          }
        }
      }

      // 3. Daily Summary Alarm for target day (fires at the end of the day's active schedule)
      const isWaterActiveOnDay = waterConfig.enabled && waterActiveDays.includes(targetDayOfWeek);
      const isScreenActiveOnDay = screenConfig.enabled && screenActiveDays.includes(targetDayOfWeek);

      if (isWaterActiveOnDay || isScreenActiveOnDay) {
        const [wH, wM] = (waterConfig.endTime || '18:00').split(':').map(Number);
        const [sH, sM] = (screenConfig.endTime || '18:00').split(':').map(Number);

        let targetSummaryMinutes = 18 * 60;
        if (isWaterActiveOnDay && isScreenActiveOnDay) {
          const wMinutes = (isNaN(wH) ? 18 : wH) * 60 + (isNaN(wM) ? 0 : wM);
          const sMinutes = (isNaN(sH) ? 18 : sH) * 60 + (isNaN(sM) ? 0 : sM);
          targetSummaryMinutes = Math.max(wMinutes, sMinutes);
        } else if (isWaterActiveOnDay) {
          targetSummaryMinutes = (isNaN(wH) ? 18 : wH) * 60 + (isNaN(wM) ? 0 : wM);
        } else {
          targetSummaryMinutes = (isNaN(sH) ? 18 : sH) * 60 + (isNaN(sM) ? 0 : sM);
        }

        const summaryDate = new Date(targetDate);
        summaryDate.setHours(Math.floor(targetSummaryMinutes / 60), targetSummaryMinutes % 60, 0, 0);

        if (summaryDate.getTime() > currentTimestamp + 2000) {
          const summarySlotId = `daily_summary:${dateStr}`;
          rollingNotifications.push({
            id: summarySlotId,
            category: 'daily_summary',
            title: "Today's Progress",
            body: "Today's Progress",
            scheduledTimestamp: summaryDate.getTime(),
            durationSeconds: 0,
            userId,
          });
        }
      }
    }

    // Sort all rolling notifications chronologically
    rollingNotifications.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
    return rollingNotifications;
  }


  /**
   * Dynamically calculates the next upcoming occurrence based on device clock (Date.now())
   * Handles before-start, mid-day interval anchoring, exact boundaries, after-end, active days, and rollover.
   * STRICT GUARANTEE: Never returns a timestamp in the past.
   */
  public findNextOccurrence(
    now: Date,
    startTime: string,
    endTime: string,
    intervalMinutes: number,
    isQuietTime?: (timeMinutes: number) => boolean,
    isSlotCompleted?: (timestamp: number) => boolean,
    activeDays?: number[]
  ): { timeString: string; timestamp: number; isTomorrow: boolean; daysAway?: number } | null {
    const validDays = activeDays && activeDays.length > 0 ? activeDays : [0, 1, 2, 3, 4, 5, 6];
    const currentTimestamp = now.getTime();
    const [startH, startM] = (startTime || '08:00').split(':').map(Number);
    const [endH, endM] = (endTime || '22:00').split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const interval = Math.max(1, intervalMinutes || 30);
    const intervalMs = interval * 60 * 1000;

    const isTodayActive = validDays.includes(now.getDay());

    if (isTodayActive) {
      const todayStartDate = new Date(now);
      todayStartDate.setHours(startH, startM, 0, 0);
      const todayStartTimestamp = todayStartDate.getTime();

      const todayEndDate = new Date(now);
      todayEndDate.setHours(endH, endM, 0, 0);
      const todayEndTimestamp = todayEndDate.getTime();

      // 1. Before today's start time -> next occurrence is today's start
      if (currentTimestamp < todayStartTimestamp) {
        const m = startMinutes;
        if (!isQuietTime || !isQuietTime(m)) {
          return {
            timeString: startTime,
            timestamp: todayStartTimestamp,
            isTomorrow: false,
            daysAway: 0,
          };
        }
      }

      // 2. Within today's active window [todayStartTimestamp, todayEndTimestamp]
      if (currentTimestamp <= todayEndTimestamp) {
        const elapsedMs = Math.max(0, currentTimestamp - todayStartTimestamp);
        const intervalsElapsed = Math.floor(elapsedMs / intervalMs);

        // Check candidate occurrences starting from the current interval index
        for (let idx = intervalsElapsed; ; idx++) {
          const candidateTimestamp = todayStartTimestamp + idx * intervalMs;

          // If candidate exceeds today's end time, break to next active day calculation
          if (candidateTimestamp > todayEndTimestamp) {
            break;
          }

          // STRICT REQUIREMENT: Candidate MUST be in the future (strictly > currentTimestamp + 1000ms)
          // Never return a past timestamp or a timestamp that was due in a previous session
          if (candidateTimestamp > currentTimestamp + 1000) {
            const candidateDate = new Date(candidateTimestamp);
            const candM = candidateDate.getHours() * 60 + candidateDate.getMinutes();

            const timeString = `${String(candidateDate.getHours()).padStart(2, '0')}:${String(
              candidateDate.getMinutes()
            ).padStart(2, '0')}`;

            if (isQuietTime && isQuietTime(candM)) {
              continue;
            }

            if (isSlotCompleted && isSlotCompleted(candidateTimestamp)) {
              continue;
            }

            return {
              timeString,
              timestamp: candidateTimestamp,
              isTomorrow: false,
              daysAway: 0,
            };
          }
        }
      }
    }

    // 3. Find the nearest future active day (offset 1 to 7)
    for (let offset = 1; offset <= 7; offset++) {
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + offset);
      if (validDays.includes(futureDate.getDay())) {
        futureDate.setHours(startH, startM, 0, 0);
        return {
          timeString: startTime,
          timestamp: futureDate.getTime(),
          isTomorrow: offset === 1,
          daysAway: offset,
        };
      }
    }

    return null;
  }

  /**
   * Pure calculation of all daily slots and next upcoming reminders
   */
  public calculateSchedule(
    waterConfig: WaterConfig,
    screenConfig: ScreenBreakConfig,
    pauseState: PauseState,
    existingWaterLogs: WaterReminderLog[],
    existingScreenLogs: ScreenBreakLog[],
    customNow?: Date
  ): EngineScheduleResult {
    const now = customNow || new Date();
    const currentTimestamp = now.getTime();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')}`;

    const isCurrentlyPaused = pauseService.isRemindersPaused(pauseState, currentTimestamp);

    // ==========================================
    // 1. WATER REMINDER SLOTS CALCULATION
    // ==========================================
    const waterSlots: WaterReminderLog[] = [];
    let nextWaterSlot: WaterReminderLog | null = null;
    let waterCompletedCount = 0;
    let waterTotalCount = 0;

    const waterActiveDays =
      waterConfig.activeDays && waterConfig.activeDays.length > 0
        ? waterConfig.activeDays
        : [0, 1, 2, 3, 4, 5, 6];
    const isWaterActiveToday = waterActiveDays.includes(now.getDay());

    if (waterConfig.enabled && isWaterActiveToday && waterConfig.startTime && waterConfig.endTime) {
      const interval = Math.max(1, waterConfig.intervalMinutes || 60);
      const occurrences = this.generateDailyOccurrences(
        now,
        waterConfig.startTime,
        waterConfig.endTime,
        interval
      );

      const waterLogsMap = new Map<string, WaterReminderLog>();
      existingWaterLogs.forEach((l) => {
        if (l.time) waterLogsMap.set(l.time, l);
        if (l.id) waterLogsMap.set(l.id, l);
      });

      let quietStart = -1;
      let quietEnd = -1;
      if (
        waterConfig.quietHoursEnabled &&
        waterConfig.quietStartTime &&
        waterConfig.quietEndTime
      ) {
        const [qsH, qsM] = waterConfig.quietStartTime.split(':').map(Number);
        const [qeH, qeM] = waterConfig.quietEndTime.split(':').map(Number);
        quietStart = qsH * 60 + qsM;
        quietEnd = qeH * 60 + qeM;
      }

      const isQuietTime = (m: number) => {
        if (quietStart === -1 || quietEnd === -1) return false;
        if (quietStart <= quietEnd) {
          return m >= quietStart && m <= quietEnd;
        }
        return m >= quietStart || m <= quietEnd;
      };

      for (const occ of occurrences) {
        const [h, min] = occ.timeString.split(':').map(Number);
        const m = h * 60 + min;

        if (isQuietTime(m)) continue;

        const slotId = this.generateSlotId('water', todayDateStr, occ.timeString);
        const existing =
          waterLogsMap.get(occ.timeString) ||
          waterLogsMap.get(slotId) ||
          existingWaterLogs.find(
            (l) =>
              l.id === slotId ||
              l.time === occ.timeString ||
              (l.id && l.id.endsWith(`:${occ.timeString}`)) ||
              (l.id && l.id.endsWith(`-${occ.timeString}`))
          );

        if (existing && existing.status === 'completed') {
          waterSlots.push({ ...existing, id: slotId, time: occ.timeString });
        } else if (occ.timestamp <= currentTimestamp) {
          // Past occurrence without recorded completion is marked 'missed'
          waterSlots.push({
            id: slotId,
            time: occ.timeString,
            scheduledTimestamp: occ.timestamp,
            status: 'missed',
          });
        } else {
          // Future occurrence is 'pending'
          waterSlots.push({
            id: slotId,
            time: occ.timeString,
            scheduledTimestamp: occ.timestamp,
            status: 'pending',
          });
        }
      }

      waterCompletedCount = Math.max(
        waterSlots.filter((s) => s.status === 'completed').length,
        existingWaterLogs.filter((s) => s.status === 'completed').length
      );
      waterTotalCount = waterSlots.length;

      if (!isCurrentlyPaused) {
        // Next slot is strictly the first upcoming future occurrence (> currentTimestamp + 1000ms) with pending status
        nextWaterSlot =
          waterSlots.find((slot) => {
            return slot.scheduledTimestamp > currentTimestamp + 1000 && slot.status === 'pending';
          }) || null;
      }
    }

    // ==========================================
    // 2. SCREEN BREAK SLOTS CALCULATION
    // ==========================================
    const screenSlots: ScreenBreakLog[] = [];
    let nextScreenSlot: ScreenBreakLog | null = null;
    let screenCompletedCount = 0;
    let screenTotalCount = 0;
    let screenBreakMinutesCompleted = 0;

    const screenActiveDays =
      screenConfig.activeDays && screenConfig.activeDays.length > 0
        ? screenConfig.activeDays
        : [0, 1, 2, 3, 4, 5, 6];
    const isScreenActiveToday = screenActiveDays.includes(now.getDay());

    if (screenConfig.enabled && isScreenActiveToday && screenConfig.startTime && screenConfig.endTime) {
      const interval = Math.max(1, screenConfig.screenIntervalMinutes || 30);
      const breakDuration = screenConfig.breakDurationMinutes || 5;

      const occurrences = this.generateDailyOccurrences(
        now,
        screenConfig.startTime,
        screenConfig.endTime,
        interval
      );

      const screenLogsMap = new Map<string, ScreenBreakLog>();
      existingScreenLogs.forEach((l) => {
        if (l.time) screenLogsMap.set(l.time, l);
        if (l.id) screenLogsMap.set(l.id, l);
      });

      for (const occ of occurrences) {
        const slotId = this.generateSlotId('screen', todayDateStr, occ.timeString);
        const existing =
          screenLogsMap.get(occ.timeString) ||
          screenLogsMap.get(slotId) ||
          existingScreenLogs.find(
            (l) =>
              l.id === slotId ||
              l.time === occ.timeString ||
              (l.id && l.id.endsWith(`:${occ.timeString}`)) ||
              (l.id && l.id.endsWith(`-${occ.timeString}`))
          );

        if (existing && existing.status === 'completed') {
          screenSlots.push({ ...existing, id: slotId, time: occ.timeString });
        } else if (occ.timestamp <= currentTimestamp) {
          // Past occurrence without recorded completion is marked 'missed'
          screenSlots.push({
            id: slotId,
            time: occ.timeString,
            scheduledTimestamp: occ.timestamp,
            durationMinutes: breakDuration,
            status: 'missed',
          });
        } else {
          // Future occurrence is 'pending'
          screenSlots.push({
            id: slotId,
            time: occ.timeString,
            scheduledTimestamp: occ.timestamp,
            durationMinutes: breakDuration,
            status: 'pending',
          });
        }
      }

      screenCompletedCount = Math.max(
        screenSlots.filter((s) => s.status === 'completed').length,
        existingScreenLogs.filter((s) => s.status === 'completed').length
      );
      screenTotalCount = screenSlots.length;
      screenBreakMinutesCompleted = screenCompletedCount * breakDuration;

      if (!isCurrentlyPaused) {
        // Next slot is strictly the first upcoming future occurrence (> currentTimestamp + 1000ms) with pending status
        nextScreenSlot =
          screenSlots.find((slot) => {
            return slot.scheduledTimestamp > currentTimestamp + 1000 && slot.status === 'pending';
          }) || null;
      }
    }

    // ==========================================
    // 3. NEXT OVERALL REMINDER DETERMINATION
    // ==========================================
    let nextOverallSlot: NextReminderInfo | null = null;

    if (nextWaterSlot && nextScreenSlot) {
      if (nextWaterSlot.scheduledTimestamp <= nextScreenSlot.scheduledTimestamp) {
        nextOverallSlot = {
          type: 'water',
          id: nextWaterSlot.id,
          time: nextWaterSlot.time,
          scheduledTimestamp: nextWaterSlot.scheduledTimestamp,
          label: 'Water Reminder',
          durationMinutes: waterConfig.durationMinutes || 2,
        };
      } else {
        nextOverallSlot = {
          type: 'screen',
          id: nextScreenSlot.id,
          time: nextScreenSlot.time,
          scheduledTimestamp: nextScreenSlot.scheduledTimestamp,
          label: 'Look Outside',
          durationMinutes: screenConfig.breakDurationMinutes || 5,
        };
      }
    } else if (nextWaterSlot) {
      nextOverallSlot = {
        type: 'water',
        id: nextWaterSlot.id,
        time: nextWaterSlot.time,
        scheduledTimestamp: nextWaterSlot.scheduledTimestamp,
        label: 'Water Reminder',
        durationMinutes: waterConfig.durationMinutes || 2,
      };
    } else if (nextScreenSlot) {
      nextOverallSlot = {
        type: 'screen',
        id: nextScreenSlot.id,
        time: nextScreenSlot.time,
        scheduledTimestamp: nextScreenSlot.scheduledTimestamp,
        label: 'Look Outside',
        durationMinutes: screenConfig.breakDurationMinutes || 5,
      };
    }

    return {
      waterSlots,
      nextWaterSlot,
      waterCompletedCount,
      waterTotalCount,
      screenSlots,
      nextScreenSlot,
      screenCompletedCount,
      screenTotalCount,
      screenBreakMinutesCompleted,
      nextOverallSlot,
    };
  }

  /**
   * Sets a single zero-polling setTimeout timer for the next future reminder.
   * Strictly returns null if targetTimestamp is in the past. Never fires past reminders.
   */
  public scheduleTimer(
    targetTimestamp: number,
    onTrigger: () => void
  ): ReturnType<typeof setTimeout> | null {
    const delay = targetTimestamp - Date.now();
    if (delay <= 1000) {
      // Past or immediate threshold -> do NOT trigger past timer
      return null;
    }
    return setTimeout(onTrigger, delay);
  }
}

export const reminderEngine = new ReminderEngineService();
