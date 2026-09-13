import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sun, Moon, Pause, LogOut } from 'lucide-react';
import { BrandLogo } from '../ui';

export const Header: React.FC = () => {
  const {
    setActiveTab,
    pauseState,
    setActivePauseModalOpen,
    generalSettings,
    setGeneralSettings,
    currentUser,
    logout,
  } = useApp();

  const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setAvatarLoadFailed(false);
  }, [currentUser?.avatar_url]);

  const userInitial = (currentUser?.display_name || currentUser?.email || 'U')[0].toUpperCase();

  const toggleTheme = () => {
    const nextTheme = generalSettings.theme === 'dark' ? 'light' : 'dark';
    setGeneralSettings({ ...generalSettings, theme: nextTheme });
  };

  return (
    <header className="md:hidden sticky top-0 z-30 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between select-none">
      <BrandLogo size="md" textClassName="text-[var(--text-primary)]" />

      <div className="flex items-center gap-2">
        {currentUser && (
          <button
            onClick={() => setActiveTab('profile')}
            className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px] overflow-hidden cursor-pointer"
            title="Profile"
          >
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
          </button>
        )}

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

        {currentUser && (
          <button
            onClick={logout}
            className="p-2 rounded-md hover:bg-rose-500/10 text-[var(--text-secondary)] hover:text-rose-400 transition-all cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
