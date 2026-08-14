import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'water' | 'screen' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  className,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-[var(--bg-surface)] shadow-[var(--shadow-card)] border border-[var(--border-subtle)]',
    elevated: 'bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-elevated)] border border-[var(--border-subtle)]',
    subtle: 'bg-[var(--bg-subtle)]',
    water: 'bg-[var(--water-subtle)] border border-[var(--water-border)]',
    screen: 'bg-[var(--screen-subtle)] border border-[var(--screen-border)]',
    ghost: 'bg-transparent',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3.5 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
    xl: 'p-8 sm:p-10',
  };

  return (
    <div
      className={clsx(
        'rounded-[var(--radius-xl)] transition-all duration-200',
        variantStyles[variant],
        paddingStyles[padding],
        hoverable && 'hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
