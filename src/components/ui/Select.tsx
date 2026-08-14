import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, options, className, disabled, id, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substring(2, 9)}`;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-[var(--text-secondary)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={clsx(
              'w-full min-h-[44px] px-3.5 py-2.5 pr-10 text-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--water-primary)] focus:ring-2 focus:ring-sky-500/20 transition-all outline-none appearance-none cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed bg-[var(--bg-subtle)]',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <span className="absolute right-3.5 text-[var(--text-muted)] pointer-events-none flex items-center">
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>

        {helperText && (
          <span className="text-xs text-[var(--text-muted)]">{helperText}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
