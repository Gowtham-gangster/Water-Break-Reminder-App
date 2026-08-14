import type { ScreenBreakConfig, ScreenBreakLog, PauseState } from '../types';

export function calculateScreenBreakSchedule(
  config: ScreenBreakConfig,
  pauseState: PauseState,
  existingLogs: ScreenBreakLog[]
): {
  slots: ScreenBreakLog[];
  nextSlot: ScreenBreakLog | null;
  completedCount: number;
  totalCount: number;
  totalBreakMinutesCompleted: number;
} {
  if (!config.enabled) {
    return {
      slots: [],
      nextSlot: null,
      completedCount: 0,
      totalCount: 0,
      totalBreakMinutesCompleted: 0,
    };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = config.startTime.split(':').map(Number);
  const [endH, endM] = config.endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const slots: ScreenBreakLog[] = [];
  const logsMap = new Map<string, ScreenBreakLog>();

  existingLogs.forEach((log) => {
    logsMap.set(log.time, log);
  });

  const interval = Math.max(10, config.screenIntervalMinutes);

  for (let m = startMinutes + interval; m <= endMinutes; m += interval) {
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

      if (m < currentMinutes - 10) {
        status = 'missed';
      }

      slots.push({
        id: `screen-${timeString}`,
        time: timeString,
        scheduledTimestamp: slotDate.getTime(),
        durationMinutes: config.breakDurationMinutes,
        status,
      });
    }
  }

  const isCurrentlyPaused =
    pauseState.isPaused &&
    pauseState.pauseUntil &&
    new Date(pauseState.pauseUntil).getTime() > now.getTime();

  let nextSlot: ScreenBreakLog | null = null;

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
  const totalBreakMinutesCompleted = completedCount * config.breakDurationMinutes;

  return {
    slots,
    nextSlot,
    completedCount,
    totalCount,
    totalBreakMinutesCompleted,
  };
}
