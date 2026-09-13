import React from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../ui';
import { pauseService } from '../../services/pauseService';
import {
  Home,
  Droplets,
  Eye,
  BarChart3,
  Settings,
  Bell,
  BellOff,
  Pause,
  Play,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    pauseState,
    setActivePauseModalOpen,
    setPauseDuration,
    notificationSettings,
    generalSettings,
    setGeneralSettings,
    currentUser,
    logout,
  } = useApp();

  const navItems = [
    { id: 'dashboard' as const, label: 'Home', icon: Home },
    { id: 'water' as const, label: 'Water', icon: Droplets },
    { id: 'screenbreak' as const, label: 'Look Outside', icon: Eye },
    { id: 'statistics' as const, label: 'Statistics', icon: BarChart3 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const toggleTheme = () => {
    const nextTheme = generalSettings.theme === 'dark' ? 'light' : 'dark';
    setGeneralSettings({ ...generalSettings, theme: nextTheme });
  };

  const isPaused = pauseService.isRemindersPaused(pauseState, Date.now());

  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [currentUser?.avatar_url]);

  const userInitial = (
    currentUser?.display_name ||
    currentUser?.email ||
    'U'
  )[0].toUpperCase();

  const userName =
    currentUser?.display_name ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'User');

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col justify-between p-5 select-none z-30">
      {/* Top: Brand & Main Navigation */}
      <div className="space-y-7">
        <BrandLogo
          size="lg"
          subtitle="Digital Wellness"
          textClassName="text-[var(--text-primary)]"
          className="px-1 pt-1"
        />

        {/* 5 Main Sections */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-150 cursor-pointer min-h-[40px]',
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

      {/* Bottom: Profile Card & Quick Actions */}
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
        {/* Profile Card / Avatar Area */}
        {currentUser && (
          <div
            onClick={() => setActiveTab('profile')}
            className={clsx(
              'flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer group',
              activeTab === 'profile'
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] hover:border-sky-500/20'
            )}
            title="View Profile"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                {currentUser.avatar_url && !avatarLoadFailed ? (
                  <img
                    key={currentUser.avatar_url}
                    src={currentUser.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  userInitial
                )}
              </div>
              <div className="truncate text-left">
                <p className="font-semibold text-xs text-[var(--text-primary)] truncate">
                  {userName}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{currentUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                logout();
              }}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Log Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Pause Action */}
        <button
          type="button"
          onClick={() => {
            if (isPaused) {
              setPauseDuration(null);
            } else {
              setActivePauseModalOpen(true);
            }
          }}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium transition-all cursor-pointer',
            isPaused
              ? 'bg-[var(--warning-subtle)] text-[var(--warning-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
          )}
        >
          <div className="flex items-center gap-2.5">
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Reminders Paused' : 'Pause'}</span>
          </div>
          {isPaused && (
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
            type="button"
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
