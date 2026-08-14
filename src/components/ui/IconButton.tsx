import React from 'react';
import { clsx } from 'clsx';
import type { ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-[var(--radius-md)] transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 shrink-0';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-11 h-11 p-2.5',
    lg: 'w-13 h-13 p-3.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[var(--text-primary)] text-[var(--bg-page)] hover:opacity-90 shadow-sm border border-transparent',
    water:
      'bg-[var(--water-primary)] text-white hover:opacity-90 shadow-sm border border-transparent',
    screen:
      'bg-[var(--screen-primary)] text-white hover:opacity-90 shadow-sm border border-transparent',
    secondary:
      'bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-muted)] border border-transparent',
    outline:
      'bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] border border-transparent',
    danger:
      'bg-[var(--danger-primary)] text-white hover:opacity-90 shadow-sm border border-transparent',
  };

  return (
    <button
      disabled={disabled}
      className={clsx(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      {...props}
    >
      {icon}
    </button>
  );
};
