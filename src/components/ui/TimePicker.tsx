import React from 'react';
import { clsx } from 'clsx';
import { Clock } from 'lucide-react';

export interface TimePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
}

export const TimePicker = React.forwardRef<HTMLInputElement, TimePickerProps>(
  ({ label, helperText, className, disabled, id, ...props }, ref) => {
    const inputId = id || `time-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[var(--text-secondary)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none flex items-center">
            <Clock className="w-4 h-4" />
          </span>

          <input
            ref={ref}
            id={inputId}
            type="time"
            disabled={disabled}
            className={clsx(
              'w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--water-primary)] focus:ring-2 focus:ring-sky-500/20 transition-all outline-none cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed bg-[var(--bg-subtle)]',
              className
            )}
            {...props}
          />
        </div>

        {helperText && (
          <span className="text-xs text-[var(--text-muted)]">{helperText}</span>
        )}
      </div>
    );
  }
);

TimePicker.displayName = 'TimePicker';
