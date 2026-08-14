import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  Droplets,
  Eye,
  BarChart3,
  Settings,
  Bell,
  BellOff,
  Pause,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    pauseState,
    setActivePauseModalOpen,
    notificationSettings,
    generalSettings,
    setGeneralSettings,
  } = useApp();

  const navItems = [
    { id: 'dashboard' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'water' as const, label: 'Water', icon: Droplets },
    { id: 'screenbreak' as const, label: 'Look Outside', icon: Eye },
    { id: 'statistics' as const, label: 'Progress', icon: BarChart3 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const toggleTheme = () => {
    const nextTheme = generalSettings.theme === 'dark' ? 'light' : 'dark';
    setGeneralSettings({ ...generalSettings, theme: nextTheme });
  };

  return (
    <aside className="w-52 shrink-0 h-screen sticky top-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col justify-between p-5 select-none z-30">
      {/* Top: Minimal Brand */}
      <div className="space-y-7">
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="w-8 h-8 rounded-xl bg-[var(--text-primary)] text-[var(--bg-page)] flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-[var(--text-primary)] block">
              EyeFlow
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-medium leading-none block mt-0.5">
              Drink. Look Away.
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-150 cursor-pointer',
                  isActive
                    ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                )}
              >
                <Icon
                  className={clsx(
                    'w-4 h-4',
                    isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  )}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Subtle Controls */}
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2">
        {/* Pause Action */}
        <button
          onClick={() => setActivePauseModalOpen(true)}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium transition-all cursor-pointer',
            pauseState.isPaused
              ? 'bg-[var(--warning-subtle)] text-[var(--warning-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
          )}
        >
          <div className="flex items-center gap-2.5">
            <Pause className="w-3.5 h-3.5" />
            <span>{pauseState.isPaused ? 'Reminders Paused' : 'Pause'}</span>
          </div>
          {pauseState.isPaused && (
            <span className="w-2 h-2 rounded-full bg-[var(--warning-primary)] animate-pulse" />
          )}
        </button>

        {/* Notifications & Theme toggles */}
        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            {notificationSettings.enabled ? (
              <Bell className="w-3.5 h-3.5 text-[var(--success-primary)]" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px] font-medium">
              {notificationSettings.enabled ? 'Active' : 'Muted'}
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title="Toggle theme"
          >
            {generalSettings.theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
