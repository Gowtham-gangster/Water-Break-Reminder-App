import React from 'react';
import { useApp } from '../../context/AppContext';
import { Home, Droplets, Eye, BarChart3, Settings } from 'lucide-react';
import { clsx } from 'clsx';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'dashboard' as const, label: 'Home', icon: Home },
    { id: 'water' as const, label: 'Water', icon: Droplets },
    { id: 'screenbreak' as const, label: 'Look Outside', icon: Eye },
    { id: 'statistics' as const, label: 'Statistics', icon: BarChart3 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-elevated)] select-none min-h-[var(--mobile-nav-height,64px)] flex items-center"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] px-2 py-1 rounded-[var(--radius-md)] transition-all cursor-pointer outline-none active:scale-95',
                isActive
                  ? 'text-[var(--text-primary)] font-bold bg-[var(--bg-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <Icon
                className={clsx(
                  'w-5 h-5',
                  isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                )}
              />
              <span className="text-[10px] font-medium tracking-tight leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
