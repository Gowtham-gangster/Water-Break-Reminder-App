import React from 'react';
import { useApp } from '../context/AppContext';
import { Pause, Play, X, Clock, Calendar } from 'lucide-react';
import { Button } from './ui';

export const PauseModal: React.FC = () => {
  const { activePauseModalOpen, setActivePauseModalOpen, pauseState, setPauseDuration } =
    useApp();

  if (!activePauseModalOpen) return null;

  const handleSelectPause = async (mins: number | 'tomorrow') => {
    await setPauseDuration(mins);
    setActivePauseModalOpen(false);
  };

  const handleResume = async () => {
    await setPauseDuration(null);
    setActivePauseModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0" onClick={() => setActivePauseModalOpen(false)} />

      <div className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-6 sm:p-7 shadow-[var(--shadow-elevated)] space-y-5 z-10 animate-scale-up">
        <button
          onClick={() => setActivePauseModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--warning-subtle)] text-[var(--warning-primary)] flex items-center justify-center">
            <Pause className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[var(--text-primary)]">Pause Reminders</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Temporarily suspend alerts for focus time
            </p>
          </div>
        </div>

        {pauseState.isPaused && (
          <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--warning-subtle)] text-xs text-[var(--warning-primary)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                Paused until{' '}
                {pauseState.pauseUntil
                  ? new Date(pauseState.pauseUntil).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'later'}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleResume} leftIcon={<Play className="w-3 h-3" />}>
              Resume
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { mins: 15, label: '15 Minutes', sub: 'Quick focus' },
            { mins: 30, label: '30 Minutes', sub: 'Short meeting' },
            { mins: 60, label: '1 Hour', sub: 'Deep work' },
            { mins: 'tomorrow' as const, label: 'Until Tomorrow', sub: 'Resume at 8:00 AM' },
          ].map((item) => (
            <button
              key={String(item.mins)}
              onClick={() => handleSelectPause(item.mins)}
              className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-1.5">
                {item.mins === 'tomorrow' && <Calendar className="w-3 h-3 text-[var(--screen-primary)]" />}
                <span className="block font-semibold text-xs text-[var(--text-primary)]">
                  {item.label}
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">{item.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
