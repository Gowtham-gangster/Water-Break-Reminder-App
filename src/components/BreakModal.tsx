import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { notificationEngine } from '../engine/notificationEngine';
import { Eye, CheckCircle2 } from 'lucide-react';

export const BreakModal: React.FC = () => {
  const {
    activeBreakModalOpen,
    realActiveReminder,
    previewReminder,
    completeRealReminder,
    skipRealReminder,
    finishPreview,
    screenBreakConfig,
  } = useApp();

  const isReal = realActiveReminder?.category === 'screen';
  const isPreview = previewReminder?.category === 'screen';

  // Fallback duration if opened directly
  const fallbackDurationMs = (screenBreakConfig.breakDurationMinutes || 5) * 60 * 1000;

  const targetEndTimestamp = isReal
    ? realActiveReminder.endTimestamp
    : isPreview
    ? previewReminder.endTimestamp
    : Date.now() + fallbackDurationMs;

  const totalDurationMs = isReal
    ? realActiveReminder.durationSeconds * 1000
    : isPreview
    ? previewReminder.durationSeconds * 1000
    : fallbackDurationMs;

  const [msRemaining, setMsRemaining] = useState<number>(() =>
    Math.max(0, targetEndTimestamp - Date.now())
  );
  const [isCompleted, setIsCompleted] = useState(false);

  const hasCompletedRef = useRef<boolean>(false);

  const handleSkip = async () => {
    if (isReal && realActiveReminder) {
      await skipRealReminder('screen', realActiveReminder.slotId);
    } else {
      finishPreview('screen');
    }
  };

  useEffect(() => {
    if (!activeBreakModalOpen || (!isReal && !isPreview)) return;

    hasCompletedRef.current = false;
    setIsCompleted(false);

    const updateTimer = () => {
      const remaining = Math.max(0, targetEndTimestamp - Date.now());
      setMsRemaining(remaining);

      if (remaining === 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setIsCompleted(true);
        notificationEngine.playScreenBell();

        setTimeout(async () => {
          if (isReal && realActiveReminder) {
            await completeRealReminder('screen', realActiveReminder.slotId);
          } else {
            finishPreview('screen');
          }
        }, 1800);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 200);
    return () => clearInterval(interval);
  }, [
    activeBreakModalOpen,
    targetEndTimestamp,
    isReal,
    isPreview,
    realActiveReminder,
    completeRealReminder,
    finishPreview,
  ]);

  if (!activeBreakModalOpen || (!isReal && !isPreview)) return null;

  // Formatting minutes & seconds
  const totalSecondsLeft = Math.ceil(msRemaining / 1000);
  const displayMins = Math.floor(totalSecondsLeft / 60);
  const displaySecs = totalSecondsLeft % 60;
  const formattedTime = `${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(
    2,
    '0'
  )}`;

  // SVG circular progress ring calculation (radius = 70)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(0, Math.min(1, 1 - msRemaining / totalDurationMs));
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Look Outside Break"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--bg-surface)] border border-[var(--screen-border)] p-8 shadow-[var(--shadow-elevated)] text-center space-y-6 z-10 animate-scale-up">
        {isCompleted ? (
          <div className="space-y-3 py-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-primary)]">Screen Break Complete</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Returning to your workspace...
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 👁 Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[var(--screen-subtle)] text-[var(--screen-primary)] mx-auto flex items-center justify-center border border-[var(--screen-border)] shadow-sm">
              <Eye className="w-8 h-8" />
            </div>

            {/* Title */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-[var(--screen-primary)] uppercase tracking-widest block">
                LOOK OUTSIDE
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Give your eyes a rest
              </h2>
            </div>

            {/* Circular Progress & Countdown */}
            <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className="stroke-[var(--bg-subtle)]"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className="stroke-[var(--screen-primary)] transition-all duration-300 ease-out"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-[var(--text-primary)] font-mono tracking-tight">
                  {formattedTime}
                </span>
                <span className="text-[11px] font-medium text-[var(--text-muted)] mt-1">
                  Look 20+ ft away
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] font-medium">
              Relax and blink gently. Window closes automatically when complete.
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
