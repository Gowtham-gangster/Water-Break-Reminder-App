import type { WaterConfig, WaterReminderLog, PauseState } from '../types';

export function calculateWaterSchedule(
  config: WaterConfig,
  pauseState: PauseState,
  existingLogs: WaterReminderLog[]
): {
  slots: WaterReminderLog[];
  nextSlot: WaterReminderLog | null;
  completedCount: number;
  totalCount: number;
} {
  if (!config.enabled) {
    return { slots: [], nextSlot: null, completedCount: 0, totalCount: 0 };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = config.startTime.split(':').map(Number);
  const [endH, endM] = config.endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  let quietStart = -1;
  let quietEnd = -1;

  if (config.quietHoursEnabled && config.quietStartTime && config.quietEndTime) {
    const [qhSH, qhSM] = config.quietStartTime.split(':').map(Number);
    const [qhEH, qhEM] = config.quietEndTime.split(':').map(Number);
    quietStart = qhSH * 60 + qhSM;
    quietEnd = qhEH * 60 + qhEM;
  }

  const slots: WaterReminderLog[] = [];
  const logsMap = new Map<string, WaterReminderLog>();

  existingLogs.forEach((log) => {
    logsMap.set(log.time, log);
  });

  const interval = Math.max(15, config.intervalMinutes);

  for (let m = startMinutes; m <= endMinutes; m += interval) {
    // Skip if within quiet hours
    if (quietStart !== -1 && quietEnd !== -1) {
      if (quietStart <= quietEnd) {
        if (m >= quietStart && m <= quietEnd) continue;
      } else {
        // quiet hours span midnight
        if (m >= quietStart || m <= quietEnd) continue;
      }
    }

    const hour = Math.floor(m / 60);
    const minute = m % 60;
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const slotDate = new Date();
    slotDate.setHours(hour, minute, 0, 0);

    const existingLog = logsMap.get(timeString);

    if (existingLog) {
      slots.push(existingLog);
    } else {
      let status: 'completed' | 'skipped' | 'pending' | 'missed' = 'pending';

      // If slot was in past (more than 10 mins ago) and never logged, mark missed
      if (m < currentMinutes - 10) {
        status = 'missed';
      }

      slots.push({
        id: `water-${timeString}`,
        time: timeString,
        scheduledTimestamp: slotDate.getTime(),
        status,
      });
    }
  }

  // Check pause state
  const isCurrentlyPaused =
    pauseState.isPaused &&
    pauseState.pauseUntil &&
    new Date(pauseState.pauseUntil).getTime() > now.getTime();

  let nextSlot: WaterReminderLog | null = null;

  if (!isCurrentlyPaused) {
    nextSlot =
      slots.find((slot) => {
        const slotMin =
          Number(slot.time.split(':')[0]) * 60 + Number(slot.time.split(':')[1]);
        return slotMin >= currentMinutes && slot.status === 'pending';
      }) || null;
  }

  const completedCount = slots.filter((s) => s.status === 'completed').length;
  const totalCount = slots.length;

  return { slots, nextSlot, completedCount, totalCount };
}
