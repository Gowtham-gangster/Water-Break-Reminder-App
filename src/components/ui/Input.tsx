import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      className,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

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
          {leftIcon && (
            <span className="absolute left-3 text-[var(--text-muted)] pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={clsx(
              'w-full min-h-[44px] px-3.5 py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-primary)] border transition-all outline-none',
              errorMessage
                ? 'border-[var(--danger-primary)] focus:border-[var(--danger-primary)] focus:ring-2 focus:ring-red-500/20'
                : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--water-primary)] focus:ring-2 focus:ring-sky-500/20',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              disabled && 'opacity-50 cursor-not-allowed bg-[var(--bg-subtle)]',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 text-[var(--text-muted)] pointer-events-none flex items-center">
              {rightIcon}
            </span>
          )}
        </div>

        {errorMessage ? (
          <span className="text-xs font-medium text-[var(--danger-primary)]">
            {errorMessage}
          </span>
        ) : helperText ? (
          <span className="text-xs text-[var(--text-muted)]">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
