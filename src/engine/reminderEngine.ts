// Real-Time Dynamic Scheduler Engine for EyeFlow
// Pure, deterministic, real-time calculation derived from device Date.now()
import type {
  WaterConfig,
  ScreenBreakConfig,
  PauseState,
  WaterReminderLog,
  ScreenBreakLog,
  ReminderStatus,
} from '../types';

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

export class ReminderEngineService {
  private firedReminders: Set<string> = new Set();

  /**
   * Generates a deterministic unique ID for each reminder event
   */
  public generateSlotId(type: 'water' | 'screen', dateStr: string, timeStr: string): string {
    return `${dateStr}-${type}-${timeStr}`;
  }

  /**
   * Checks if an event has already fired to prevent duplicate alerts
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
   * Resets fired set (useful on date rollover)
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
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const interval = Math.max(5, intervalMinutes);

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
   * Dynamically calculates the next upcoming occurrence based on device clock (Date.now())
   * Handles before-start, mid-day interval anchoring, exact boundaries, after-end, and tomorrow rollover
   */
  public findNextOccurrence(
    now: Date,
    startTime: string,
    endTime: string,
    intervalMinutes: number,
    isQuietTime?: (timeMinutes: number) => boolean,
    isSlotCompleted?: (timestamp: number) => boolean
  ): { timeString: string; timestamp: number; isTomorrow: boolean } | null {
    const currentTimestamp = now.getTime();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const interval = Math.max(5, intervalMinutes);
    const intervalMs = interval * 60 * 1000;

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
        };
      }
    }

    // 2. Within today's active window [todayStartTimestamp, todayEndTimestamp]
    if (currentTimestamp <= todayEndTimestamp) {
      const elapsedMs = Math.max(0, currentTimestamp - todayStartTimestamp);
      const intervalsElapsed = Math.floor(elapsedMs / intervalMs);

      // Check candidate occurrences starting from current/next interval
      for (let idx = intervalsElapsed; ; idx++) {
        const candidateTimestamp = todayStartTimestamp + idx * intervalMs;

        // If candidate exceeds today's end time, break to tomorrow calculation
        if (candidateTimestamp > todayEndTimestamp) {
          break;
        }

        // Must be in future or exactly now (if not already elapsed/fired)
        if (candidateTimestamp >= currentTimestamp) {
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
          };
        }
      }
    }

    // 3. After today's end time -> next occurrence is tomorrow's start time
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    tomorrowDate.setHours(startH, startM, 0, 0);

    return {
      timeString: startTime,
      timestamp: tomorrowDate.getTime(),
      isTomorrow: true,
    };
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

    const isCurrentlyPaused =
      pauseState.isPaused &&
      pauseState.pauseUntil !== null &&
      new Date(pauseState.pauseUntil).getTime() > currentTimestamp;

    // ==========================================
    // 1. WATER REMINDER SLOTS CALCULATION
    // ==========================================
    const waterSlots: WaterReminderLog[] = [];
    let nextWaterSlot: WaterReminderLog | null = null;
    let waterCompletedCount = 0;
    let waterTotalCount = 0;

    if (waterConfig.enabled && waterConfig.startTime && waterConfig.endTime) {
      const interval = Math.max(10, waterConfig.intervalMinutes || 60);
      const occurrences = this.generateDailyOccurrences(
        now,
        waterConfig.startTime,
        waterConfig.endTime,
        interval
      );

      const waterLogsMap = new Map<string, WaterReminderLog>();
      existingWaterLogs.forEach((l) => waterLogsMap.set(l.time, l));

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
        const existing = waterLogsMap.get(occ.timeString);

        if (existing && occ.timestamp <= currentTimestamp) {
          waterSlots.push(existing);
        } else {
          let status: ReminderStatus = 'pending';
          if (occ.timestamp < currentTimestamp - 600000) {
            status = 'missed';
          }

          waterSlots.push({
            id: slotId,
            time: occ.timeString,
            scheduledTimestamp: occ.timestamp,
            status: existing && existing.status === 'completed' && occ.timestamp <= currentTimestamp ? 'completed' : status,
          });
        }
      }

      waterCompletedCount = waterSlots.filter((s) => s.status === 'completed').length;
      waterTotalCount = waterSlots.length;

      if (!isCurrentlyPaused) {
        // Next slot is the first uncompleted occurrence strictly >= currentTimestamp
        nextWaterSlot =
          waterSlots.find((slot) => {
            return slot.scheduledTimestamp >= currentTimestamp && slot.status === 'pending';
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

    if (screenConfig.enabled && screenConfig.startTime && screenConfig.endTime) {
      const interval = Math.max(10, screenConfig.screenIntervalMinutes || 30);
      const breakDuration = screenConfig.breakDurationMinutes || 5;

      const occurrences = this.generateDailyOccurrences(
        now,
        screenConfig.startTime,
        screenConfig.endTime,
        interval
      );

      const screenLogsMap = new Map<string, ScreenBreakLog>();
      existingScreenLogs.forEach((l) => screenLogsMap.set(l.time, l));

      for (const occ of occurrences) {
        const slotId = this.generateSlotId('screen', todayDateStr, occ.timeString);
        const existing = screenLogsMap.get(occ.timeString);

        if (existing && occ.timestamp <= currentTimestamp) {
          screenSlots.push(existing);
        } else {
          let status: ReminderStatus = 'pending';
          if (occ.timestamp < currentTimestamp - 600000) {
            status = 'missed';
          }

          screenSlots.push({
            id: slotId,
            time: occ.timeString,
            scheduledTimestamp: occ.timestamp,
            durationMinutes: breakDuration,
            status: existing && existing.status === 'completed' && occ.timestamp <= currentTimestamp ? 'completed' : status,
          });
        }
      }

      screenCompletedCount = screenSlots.filter((s) => s.status === 'completed').length;
      screenTotalCount = screenSlots.length;
      screenBreakMinutesCompleted = screenCompletedCount * breakDuration;

      if (!isCurrentlyPaused) {
        // Next slot is the first uncompleted occurrence strictly >= currentTimestamp
        nextScreenSlot =
          screenSlots.find((slot) => {
            return slot.scheduledTimestamp >= currentTimestamp && slot.status === 'pending';
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
   * Sets a single zero-polling setTimeout timer for the next reminder
   */
  public scheduleTimer(
    targetTimestamp: number,
    onTrigger: () => void
  ): ReturnType<typeof setTimeout> {
    const delay = Math.max(100, targetTimestamp - Date.now());
    return setTimeout(onTrigger, delay);
  }
}

export const reminderEngine = new ReminderEngineService();
