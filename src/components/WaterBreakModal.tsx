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
    skipRealReminder,
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

  const [msRemaining, setMsRemaining] = useState<number>(() =>
    Math.max(0, targetEndTimestamp - Date.now())
  );
  const [isCompleted, setIsCompleted] = useState(false);

  const hasCompletedRef = useRef<boolean>(false);

  const handleSkip = async () => {
    if (isReal && realActiveReminder) {
      await skipRealReminder('water', realActiveReminder.slotId);
    } else {
      finishPreview('water');
    }
  };

  useEffect(() => {
    if (!activeWaterModalOpen || (!isReal && !isPreview)) return;

    hasCompletedRef.current = false;
    setIsCompleted(false);

    const updateTimer = () => {
      const remaining = Math.max(0, targetEndTimestamp - Date.now());
      setMsRemaining(remaining);

      if (remaining === 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setIsCompleted(true);
        notificationEngine.playWaterChime();

        // Auto dismiss after chime
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
    isPreview,
    realActiveReminder,
    completeRealReminder,
    finishPreview,
  ]);

  if (!activeWaterModalOpen || (!isReal && !isPreview)) return null;

  const totalSecsLeft = Math.ceil(msRemaining / 1000);
  const displayMins = Math.floor(totalSecsLeft / 60);
  const displaySecs = totalSecsLeft % 60;
  const formattedTime = `${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(
    2,
    '0'
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Water Break"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--bg-surface)] border border-[var(--water-border)] p-8 shadow-[var(--shadow-elevated)] text-center space-y-6 z-10 animate-scale-up">
        {isCompleted ? (
          <div className="space-y-3 py-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Water Break Complete</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Returning to your workspace...
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 💧 Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[var(--water-subtle)] text-[var(--water-primary)] mx-auto flex items-center justify-center border border-[var(--water-border)] shadow-sm">
              <Droplets className="w-8 h-8" />
            </div>

            {/* Title */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-[var(--water-primary)] uppercase tracking-widest block">
                WATER BREAK
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Time to drink water
              </h2>
            </div>

            {/* Countdown (Large readable font-mono) */}
            <div className="py-2">
              <span className="text-5xl font-black text-[var(--water-primary)] font-mono tracking-tight">
                {formattedTime}
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] font-medium">
              Take a slow sip. Window closes automatically when complete.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] transition-colors"
              >
                Skip Break
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
