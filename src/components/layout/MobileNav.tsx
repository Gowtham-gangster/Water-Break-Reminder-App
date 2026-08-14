import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Droplets, Eye, BarChart3, Settings } from 'lucide-react';
import { clsx } from 'clsx';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'dashboard' as const, label: 'Home', icon: LayoutDashboard },
    { id: 'water' as const, label: 'Water', icon: Droplets },
    { id: 'screenbreak' as const, label: 'Break', icon: Eye },
    { id: 'statistics' as const, label: 'Progress', icon: BarChart3 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-elevated)] select-none"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] px-2 py-1 rounded-[var(--radius-md)] transition-all cursor-pointer outline-none active:scale-95',
                isActive
                  ? 'text-[var(--water-primary)] font-bold bg-[var(--water-subtle)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <Icon className="w-5 h-5" />
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
