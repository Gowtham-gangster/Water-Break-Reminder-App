import React from 'react';
import { useApp } from '../context/AppContext';
import { APP_CONFIG } from '../config/app.config';
import {
  Droplets,
  Eye,
  PauseCircle,
  PlayCircle,
  Sun,
  Moon,
  Monitor,
  User,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    generalSettings,
    setGeneralSettings,
    pauseState,
    setPauseDuration,
    setActivePauseModalOpen,
    userAccount,
    setActiveAuthModalOpen,
    triggerTestWaterNotification,
    triggerTestScreenNotification,
  } = useApp();

  const toggleTheme = () => {
    const nextTheme =
      generalSettings.theme === 'light'
        ? 'dark'
        : generalSettings.theme === 'dark'
        ? 'system'
        : 'light';
    setGeneralSettings({ ...generalSettings, theme: nextTheme });
  };

  const getThemeIcon = () => {
    if (generalSettings.theme === 'dark') return <Moon className="w-4 h-4 text-indigo-400" />;
    if (generalSettings.theme === 'light') return <Sun className="w-4 h-4 text-amber-500" />;
    return <Monitor className="w-4 h-4 text-sky-400" />;
  };

  return (
    <header className="w-full bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3 sticky top-0 z-40 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Droplets className="w-5 h-5 -mr-1" />
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {APP_CONFIG.name}
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                v{APP_CONFIG.version}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] hidden sm:block">
              {APP_CONFIG.tagline}
            </p>
          </div>
        </div>

        {/* Action Controls & Indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Pause Status Indicator */}
          {pauseState.isPaused ? (
            <button
              onClick={() => setPauseDuration(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
              title="Click to resume reminders"
            >
              <PauseCircle className="w-3.5 h-3.5 animate-pulse" />
              <span>Paused</span>
              <span className="text-[10px] opacity-75 hidden md:inline">
                ({pauseState.pauseUntil ? new Date(pauseState.pauseUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''})
              </span>
              <PlayCircle className="w-3.5 h-3.5 ml-1 text-emerald-500" />
            </button>
          ) : (
            <button
              onClick={() => setActivePauseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--border-hover)] transition-all"
            >
              <PauseCircle className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline">Pause</span>
            </button>
          )}

          {/* Test Notification Quick Menu */}
          <div className="hidden lg:flex items-center gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg border border-[var(--border-color)]">
            <button
              onClick={triggerTestWaterNotification}
              className="px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-[var(--bg-secondary)] rounded transition-all flex items-center gap-1"
              title="Test Water Notification"
            >
              <Droplets className="w-3 h-3" /> Test Water
            </button>
            <button
              onClick={triggerTestScreenNotification}
              className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-[var(--bg-secondary)] rounded transition-all flex items-center gap-1"
              title="Test Look Outside Notification"
            >
              <Eye className="w-3 h-3" /> Test Screen
            </button>
          </div>

          {/* Theme Selector Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--border-hover)] transition-all"
            title={`Current theme: ${generalSettings.theme}. Click to switch.`}
          >
            {getThemeIcon()}
          </button>

          {/* User Account / Sync Badge */}
          <button
            onClick={() => setActiveAuthModalOpen(true)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--border-hover)] transition-all text-xs font-medium"
          >
            <User className="w-4 h-4 text-sky-500" />
            <span className="hidden sm:inline">
              {userAccount.isLoggedIn ? userAccount.name || 'Account' : 'Sign In / Sync'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
