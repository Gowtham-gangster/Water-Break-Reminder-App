import React from 'react';
import { clsx } from 'clsx';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: 'pills' | 'segmented';
  fullWidth?: boolean;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = 'segmented',
  fullWidth = false,
}: TabsProps<T>) {
  if (variant === 'segmented') {
    return (
      <div
        className={clsx(
          'inline-flex p-1 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] gap-1 select-none',
          fullWidth && 'w-full'
        )}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={clsx(
                'inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-[var(--radius-sm)] transition-all cursor-pointer outline-none min-h-[36px]',
                fullWidth && 'flex-1',
                isActive
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/50'
              )}
            >
              {tab.icon && <span className="inline-flex shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Pill variant
  return (
    <div className="flex flex-wrap gap-2 select-none" role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full border transition-all cursor-pointer outline-none min-h-[36px]',
              isActive
                ? 'bg-[var(--water-subtle)] text-[var(--water-primary)] border-[var(--water-border)] shadow-sm'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
            )}
          >
            {tab.icon && <span className="inline-flex shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--bg-subtle)]">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
