import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { pauseService } from '../services/pauseService';
import { Pause, Play, X, Clock, Calendar, Sliders } from 'lucide-react';
import { Button } from './ui';
import { formatUserTime } from '../utils/timeFormat';

export const PauseModal: React.FC = () => {
  const { activePauseModalOpen, setActivePauseModalOpen, pauseState, setPauseDuration, generalSettings } =
    useApp();

  const isPaused = pauseService.isRemindersPaused(pauseState, Date.now());

  const [customMinutes, setCustomMinutes] = useState<number>(45);
  const [showCustomInput, setShowCustomInput] = useState(false);

  if (!activePauseModalOpen) return null;

  const handleSelectPause = async (mins: number | 'tomorrow') => {
    await setPauseDuration(mins);
    setActivePauseModalOpen(false);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customMinutes > 0) {
      await setPauseDuration(customMinutes);
      setActivePauseModalOpen(false);
    }
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

        {isPaused && (
          <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--warning-subtle)] text-xs text-[var(--warning-primary)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                Paused until{' '}
                {pauseState.pauseUntil
                  ? formatUserTime(new Date(pauseState.pauseUntil), generalSettings.timeFormat, generalSettings.timezone)
                  : 'later'}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleResume} leftIcon={<Play className="w-3 h-3" />}>
              Resume
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSelectPause(30)}
            className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-left transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[var(--warning-primary)]" />
              <span className="block font-semibold text-xs text-[var(--text-primary)]">
                30 Minutes
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">Short meeting</span>
          </button>

          <button
            onClick={() => handleSelectPause(60)}
            className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-left transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[var(--warning-primary)]" />
              <span className="block font-semibold text-xs text-[var(--text-primary)]">
                1 Hour
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">Deep work</span>
          </button>

          <button
            onClick={() => handleSelectPause('tomorrow')}
            className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-left transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[var(--screen-primary)]" />
              <span className="block font-semibold text-xs text-[var(--text-primary)]">
                Today
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">Resume tomorrow 8 AM</span>
          </button>

          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className={`p-3.5 rounded-[var(--radius-md)] border text-left transition-all cursor-pointer ${
              showCustomInput
                ? 'bg-[var(--bg-muted)] border-[var(--text-primary)]'
                : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3 h-3 text-[var(--water-primary)]" />
              <span className="block font-semibold text-xs text-[var(--text-primary)]">
                Custom
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">Set custom minutes</span>
          </button>
        </div>

        {showCustomInput && (
          <form onSubmit={handleCustomSubmit} className="pt-2 flex items-center gap-2 animate-fade-in">
            <input
              type="number"
              min="1"
              max="1440"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              className="form-input text-xs py-2 px-3 flex-1"
              placeholder="Minutes (e.g. 45)"
            />
            <Button variant="primary" size="sm" type="submit">
              Set Pause
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
