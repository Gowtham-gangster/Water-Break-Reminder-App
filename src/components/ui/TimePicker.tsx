import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { Clock } from 'lucide-react';
import {
  formatUserTime,
  parseCanonicalTo12h,
  parse12hToCanonical,
  type TimeDisplayFormat,
} from '../../utils/timeFormat';

export interface TimePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  helperText?: string;
  timeFormat?: TimeDisplayFormat;
  value?: string; // Canonical "HH:mm"
  onChange?: (e: { target: { value: string } }) => void;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  helperText,
  timeFormat = '12h',
  value = '08:00',
  onChange,
  className,
  disabled,
  id,
}) => {
  const inputId = id || `time-${Math.random().toString(36).substring(2, 9)}`;

  // Parse canonical value into 12h pieces
  const { hour: h12, minute: m12, period } = useMemo(() => {
    return parseCanonicalTo12h(value);
  }, [value]);

  const handle12hChange = (newHour: number, newMinute: number, newPeriod: 'AM' | 'PM') => {
    const canonical = parse12hToCanonical(newHour, newMinute, newPeriod);
    if (onChange) {
      onChange({ target: { value: canonical } });
    }
  };

  const handle24hDirectChange = (newCanonical: string) => {
    if (onChange) {
      onChange({ target: { value: newCanonical } });
    }
  };

  const formattedDisplay = useMemo(() => {
    return formatUserTime(value, timeFormat);
  }, [value, timeFormat]);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[var(--text-secondary)] select-none flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{label}</span>
          </label>
        )}
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
          {formattedDisplay}
        </span>
      </div>

      {timeFormat === '12h' ? (
        <div
          className={clsx(
            'flex items-center gap-2 p-1.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all',
            disabled && 'opacity-50 cursor-not-allowed bg-[var(--bg-subtle)]',
            className
          )}
        >
          {/* Hour Select (1..12) */}
          <div className="flex-1">
            <select
              id={inputId}
              disabled={disabled}
              value={h12}
              onChange={(e) => handle12hChange(parseInt(e.target.value, 10), m12, period)}
              className="w-full bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm font-semibold py-2 px-2.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] focus:border-[var(--water-primary)] focus:ring-1 focus:ring-sky-500/30 outline-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <span className="text-sm font-bold text-[var(--text-muted)]">:</span>

          {/* Minute Select (00..59) */}
          <div className="flex-1">
            <select
              disabled={disabled}
              value={m12}
              onChange={(e) => handle12hChange(h12, parseInt(e.target.value, 10), period)}
              className="w-full bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm font-semibold py-2 px-2.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] focus:border-[var(--water-primary)] focus:ring-1 focus:ring-sky-500/30 outline-none cursor-pointer font-mono"
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {/* AM / PM Toggle Buttons */}
          <div className="flex items-center bg-[var(--bg-subtle)] p-0.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)]">
            <button
              type="button"
              disabled={disabled}
              onClick={() => handle12hChange(h12, m12, 'AM')}
              className={clsx(
                'px-2.5 py-1.5 text-xs font-bold rounded-[var(--radius-sm)] transition-all cursor-pointer',
                period === 'AM'
                  ? 'bg-[var(--water-primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              AM
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => handle12hChange(h12, m12, 'PM')}
              className={clsx(
                'px-2.5 py-1.5 text-xs font-bold rounded-[var(--radius-sm)] transition-all cursor-pointer',
                period === 'PM'
                  ? 'bg-[var(--water-primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              PM
            </button>
          </div>
        </div>
      ) : (
        /* 24h Mode: 00..23 and 00..59 */
        <div
          className={clsx(
            'relative flex items-center',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <span className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none flex items-center">
            <Clock className="w-4 h-4" />
          </span>

          <input
            id={inputId}
            type="time"
            disabled={disabled}
            value={value}
            onChange={(e) => handle24hDirectChange(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm font-semibold rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--water-primary)] focus:ring-2 focus:ring-sky-500/20 transition-all outline-none cursor-pointer font-mono"
          />
        </div>
      )}

      {helperText && (
        <span className="text-xs text-[var(--text-muted)]">{helperText}</span>
      )}
    </div>
  );
};
