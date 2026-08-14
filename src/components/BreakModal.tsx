import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { notificationEngine } from '../engine/notificationEngine';
import {
  Eye,
  CheckCircle2,
  Footprints,
  Wind,
  Sparkles,
} from 'lucide-react';

export const BreakModal: React.FC = () => {
  const {
    activeBreakModalOpen,
    realActiveReminder,
    previewReminder,
    completeRealReminder,
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

  const [msRemaining, setMsRemaining] = useState(totalDurationMs);
  const [isCompleted, setIsCompleted] = useState(false);

  const hasCompletedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!activeBreakModalOpen) return;

    hasCompletedRef.current = false;
    setIsCompleted(false);

    const updateTimer = () => {
      const remaining = Math.max(0, targetEndTimestamp - Date.now());
      setMsRemaining(remaining);

      if (remaining === 0 && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setIsCompleted(true);
        notificationEngine.playScreenBell();

        // Separate completion paths:
        // REAL -> persists completed slot into history & statistics
        // PREVIEW -> 100% ephemeral, zero side effects
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
    realActiveReminder,
    completeRealReminder,
    finishPreview,
  ]);

  if (!activeBreakModalOpen) return null;

  // Formatting minutes & seconds
  const totalSecondsLeft = Math.ceil(msRemaining / 1000);
  const displayMins = Math.floor(totalSecondsLeft / 60);
  const displaySecs = totalSecondsLeft % 60;
  const formattedTime = `${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(
    2,
    '0'
  )}`;

  // SVG circular progress ring calculation (radius = 85)
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(0, Math.min(1, 1 - msRemaining / totalDurationMs));
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-xl animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Look Outside Screen Break"
    >
      {/* Main Break Container */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] bg-slate-900 border border-indigo-500/20 p-8 sm:p-12 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] text-center space-y-8 z-10 animate-scale-up">
        {/* 1. COMPLETION STATE */}
        {isCompleted ? (
          <div className="space-y-5 py-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30 shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
                ✓ BREAK COMPLETE
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Nice work.
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xs mx-auto leading-relaxed pt-1">
                Your break is done. Returning to your workspace...
              </p>
            </div>
          </div>
        ) : (
          /* 2. ACTIVE BREAK STATE */
          <div className="space-y-7">
            {/* Header Icon & Title */}
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/30 shadow-sm">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest block">
                  {isPreview ? 'PREVIEW BREAK' : 'LOOK OUTSIDE'}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
                  Give your eyes a short break.
                </h2>
              </div>
            </div>

            {/* Central Circular Progress Ring & Countdown Timer */}
            <div className="relative w-48 h-48 sm:w-52 sm:h-52 mx-auto flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                {/* Background Ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  className="stroke-slate-800"
                  strokeWidth="7"
                  fill="transparent"
                />
                {/* Active Progress Ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  className="stroke-indigo-500 transition-all duration-300 ease-out"
                  strokeWidth="7"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              {/* Inner Countdown Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
                <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                  {formattedTime}
                </span>
                <span className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1 pt-1">
                  <Wind className="w-3 h-3" /> Relax & breathe
                </span>
              </div>
            </div>

            {/* Calm Suggestions */}
            <div className="bg-slate-950/60 p-4 rounded-[var(--radius-lg)] border border-slate-800 text-xs text-slate-300 space-y-2 text-left">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Look at something in the distance (20+ feet away).</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Wind className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Relax your eyes and blink gently.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Footprints className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Step away from the screen if you can.</span>
              </div>
            </div>

            {/* Informational Status */}
            <div className="pt-1">
              <span className="text-[11px] font-medium text-slate-400 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                {isPreview
                  ? `Preview in progress • Closes automatically in ${formattedTime}`
                  : `Break in progress • Ends automatically in ${formattedTime}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
