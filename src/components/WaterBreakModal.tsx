import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { notificationEngine } from '../engine/notificationEngine';
import { Droplets, CheckCircle2 } from 'lucide-react';

export const WaterBreakModal: React.FC = () => {
  const {
    activeWaterModalOpen,
    realActiveReminder,
    previewReminder,
    completeRealReminder,
    finishPreview,
    waterConfig,
  } = useApp();

  const isReal = realActiveReminder?.category === 'water';
  const isPreview = previewReminder?.category === 'water';

  const fallbackDurationMs = (waterConfig.durationMinutes || 2) * 60 * 1000;

  const targetEndTimestamp = isReal
    ? realActiveReminder.endTimestamp
    : isPreview
    ? previewReminder.endTimestamp
    : Date.now() + fallbackDurationMs;

  const totalMs = isReal
    ? realActiveReminder.durationSeconds * 1000
    : isPreview
    ? previewReminder.durationSeconds * 1000
    : fallbackDurationMs;

  const [msRemaining, setMsRemaining] = useState(totalMs);
  const [isCompleted, setIsCompleted] = useState(false);

  const hasCompletedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!activeWaterModalOpen) return;

    hasCompletedRef.current = false;
    setIsCompleted(false);

    const updateTimer = () => {
      const remaining = Math.max(0, targetEndTimestamp - Date.now());
      setMsRemaining(remaining);

      if (remaining === 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setIsCompleted(true);
        notificationEngine.playWaterChime();

        // Separate completion paths
        setTimeout(async () => {
          if (isReal && realActiveReminder) {
            await completeRealReminder('water', realActiveReminder.slotId);
          } else {
            finishPreview('water');
          }
        }, 1800);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 200);
    return () => clearInterval(interval);
  }, [
    activeWaterModalOpen,
    targetEndTimestamp,
    isReal,
    realActiveReminder,
    completeRealReminder,
    finishPreview,
  ]);

  if (!activeWaterModalOpen) return null;

  const totalSecsLeft = Math.ceil(msRemaining / 1000);
  const displayMins = Math.floor(totalSecsLeft / 60);
  const displaySecs = totalSecsLeft % 60;
  const formattedTime = `${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(
    2,
    '0'
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Water Reminder Popup"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] bg-[var(--bg-surface-elevated)] border border-[var(--water-border)] p-6 sm:p-8 shadow-[var(--shadow-elevated)] text-center space-y-5 z-10 animate-scale-up">
        {isCompleted ? (
          <div className="space-y-3 py-2 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Hydrated ✓</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Great job! Returning to your workspace...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--water-subtle)] text-[var(--water-primary)] mx-auto flex items-center justify-center border border-[var(--water-border)] shadow-sm">
              <Droplets className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[var(--water-primary)] uppercase tracking-wider block">
                {isPreview ? 'PREVIEW WATER' : 'WATER BREAK'}
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Time to drink some water.
              </h2>
            </div>

            <div className="py-2">
              <span className="text-4xl sm:text-5xl font-black text-[var(--water-primary)] font-mono tracking-tight">
                {formattedTime}
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] font-medium pt-1">
              {isPreview
                ? `Preview will close automatically in ${formattedTime}`
                : `This reminder will disappear automatically in ${formattedTime}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
