import React from 'react';
import { clsx } from 'clsx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  variant?: 'water' | 'screen';
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  variant = 'water',
  id,
}) => {
  const toggleId = id || `toggle-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <label
          htmlFor={toggleId}
          className={clsx(
            'flex flex-col cursor-pointer select-none',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {label && (
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-[var(--text-secondary)] mt-0.5">
              {description}
            </span>
          )}
        </label>
      )}

      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          checked
            ? variant === 'screen'
              ? 'bg-[var(--screen-primary)]'
              : 'bg-[var(--water-primary)]'
            : 'bg-[var(--border-strong)]'
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
};
