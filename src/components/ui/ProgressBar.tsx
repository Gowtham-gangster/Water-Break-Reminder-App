import React from 'react';
import { clsx } from 'clsx';

export type ProgressVariant = 'water' | 'screen' | 'success' | 'neutral';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  variant?: ProgressVariant;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  variant = 'water',
  showLabel = false,
  label,
  size = 'md',
  className,
  ...props
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const heightStyles: Record<string, string> = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const fillVariants: Record<ProgressVariant, string> = {
    water: 'bg-[var(--water-primary)]',
    screen: 'bg-[var(--screen-primary)]',
    success: 'bg-[var(--success-primary)]',
    neutral: 'bg-slate-400',
  };

  return (
    <div className={clsx('w-full flex flex-col gap-1.5', className)} {...props}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs font-semibold select-none">
          {label && <span className="text-[var(--text-primary)]">{label}</span>}
          {showLabel && (
            <span className="text-[var(--text-secondary)] font-mono">{clampedValue}%</span>
          )}
        </div>
      )}

      <div
        className={clsx(
          'w-full bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border-subtle)]/50',
          heightStyles[size]
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out',
            fillVariants[variant]
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
