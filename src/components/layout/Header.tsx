import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sun, Moon, Pause, Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  const { pauseState, setActivePauseModalOpen, generalSettings, setGeneralSettings } = useApp();

  const toggleTheme = () => {
    const nextTheme = generalSettings.theme === 'dark' ? 'light' : 'dark';
    setGeneralSettings({ ...generalSettings, theme: nextTheme });
  };

  return (
    <header className="md:hidden sticky top-0 z-30 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[var(--text-primary)] text-[var(--bg-page)] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <span className="font-bold text-sm text-[var(--text-primary)]">EyeFlow</span>
      </div>

      <div className="flex items-center gap-2">
        {pauseState.isPaused && (
          <button
            onClick={() => setActivePauseModalOpen(true)}
            className="px-2.5 py-1 rounded-md bg-[var(--warning-subtle)] text-[var(--warning-primary)] text-[11px] font-semibold flex items-center gap-1.5"
          >
            <Pause className="w-3 h-3" /> Paused
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          title="Toggle theme"
        >
          {generalSettings.theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
