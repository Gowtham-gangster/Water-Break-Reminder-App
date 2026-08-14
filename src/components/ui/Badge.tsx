import React from 'react';
import { clsx } from 'clsx';

export type BadgeVariant = 'neutral' | 'water' | 'screen' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  dot = false,
  className,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold select-none border transition-colors';

  const variantStyles: Record<BadgeVariant, string> = {
    neutral:
      'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
    water:
      'bg-[var(--water-subtle)] text-[var(--water-primary)] border-[var(--water-border)]',
    screen:
      'bg-[var(--screen-subtle)] text-[var(--screen-primary)] border-[var(--screen-border)]',
    success:
      'bg-[var(--success-subtle)] text-[var(--success-primary)] border-[var(--success-primary)]/20',
    warning:
      'bg-[var(--warning-subtle)] text-[var(--warning-primary)] border-[var(--warning-primary)]/20',
    danger:
      'bg-[var(--danger-subtle)] text-[var(--danger-primary)] border-[var(--danger-primary)]/20',
  };

  const dotColors: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-400',
    water: 'bg-[var(--water-primary)]',
    screen: 'bg-[var(--screen-primary)]',
    success: 'bg-[var(--success-primary)]',
    warning: 'bg-[var(--warning-primary)]',
    danger: 'bg-[var(--danger-primary)]',
  };

  return (
    <span className={clsx(baseStyles, variantStyles[variant], className)} {...props}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      <span>{children}</span>
    </span>
  );
};
