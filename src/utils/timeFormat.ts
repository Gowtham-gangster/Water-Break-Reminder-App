/**
 * PauseFlow Authoritative Central Time Formatter
 * 
 * Supports:
 * - 12-hour format ('12h'): e.g. "12:00 AM", "1:05 AM", "8:30 AM", "12:00 PM", "6:30 PM", "11:45 PM"
 * - 24-hour format ('24h'): e.g. "00:00", "01:05", "08:30", "12:00", "18:30", "23:45"
 * 
 * Canonical storage remains unchanged: "HH:mm" (24h) or ISO timestamps.
 * Timezone and presentation formatting are strictly decoupled.
 */

export type TimeDisplayFormat = '12h' | '24h';

/**
 * Formats a time string (HH:mm), Date object, or numeric epoch timestamp into the user's preferred format.
 */
export function formatUserTime(
  dateOrTime: Date | string | number | null | undefined,
  timeFormat: TimeDisplayFormat = '12h',
  timezone?: string
): string {
  if (dateOrTime === null || dateOrTime === undefined || dateOrTime === '') {
    return '';
  }

  // 1. Direct "HH:mm" or "H:m" string handling
  if (typeof dateOrTime === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(dateOrTime.trim())) {
    const parts = dateOrTime.trim().split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return dateOrTime;

    hours = Math.max(0, Math.min(23, hours));
    const safeMin = Math.max(0, Math.min(59, minutes));
    const minStr = String(safeMin).padStart(2, '0');

    if (timeFormat === '24h') {
      return `${String(hours).padStart(2, '0')}:${minStr}`;
    }

    // 12-Hour conversion
    const period = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12;
    if (h12 === 0) h12 = 12;

    return `${h12}:${minStr} ${period}`;
  }

  // 2. Date object, epoch number, or ISO string
  try {
    const d = typeof dateOrTime === 'number' ? new Date(dateOrTime) : typeof dateOrTime === 'string' ? new Date(dateOrTime) : dateOrTime;

    if (isNaN(d.getTime())) {
      return String(dateOrTime);
    }

    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    if (timeFormat === '24h') {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return formatter.format(d);
    } else {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return formatter.format(d);
    }
  } catch (_) {
    return String(dateOrTime);
  }
}

/**
 * Formats a Date or timestamp into a localized short date + formatted time string.
 * Example: "Sep 15 · 6:30 PM" or "Sep 15 · 18:30"
 */
export function formatUserDateTime(
  dateOrTime: Date | string | number | null | undefined,
  timeFormat: TimeDisplayFormat = '12h',
  timezone?: string
): string {
  if (!dateOrTime) return '';

  try {
    const d = typeof dateOrTime === 'number' ? new Date(dateOrTime) : typeof dateOrTime === 'string' ? new Date(dateOrTime) : dateOrTime;

    if (isNaN(d.getTime())) return '';

    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    // Format month and day according to target timezone
    const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
    });
    const dateLabel = datePartsFormatter.format(d);
    const timeLabel = formatUserTime(d, timeFormat, tz);

    return `${dateLabel} · ${timeLabel}`;
  } catch (_) {
    return '';
  }
}

/**
 * Converts 12h parts (hour 1-12, minute 0-59, period 'AM'|'PM') to canonical 24h "HH:mm".
 */
export function parse12hToCanonical(hour: number, minute: number, period: 'AM' | 'PM'): string {
  let h24 = hour % 12;
  if (period === 'PM') {
    h24 += 12;
  }
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Parses canonical "HH:mm" into 12h component pieces { hour: 1..12, minute: 0..59, period: 'AM' | 'PM' }.
 */
export function parseCanonicalTo12h(timeStr: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const [hStr, mStr] = (timeStr || '08:00').split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h)) h = 8;
  const safeMin = isNaN(m) ? 0 : Math.max(0, Math.min(59, m));

  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return {
    hour: h12,
    minute: safeMin,
    period,
  };
}
