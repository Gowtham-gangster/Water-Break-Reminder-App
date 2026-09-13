import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { notificationEngine } from '../engine/notificationEngine';
import { Droplets, Eye, CheckCircle2, Sparkles, Wind } from 'lucide-react';

export const CombinedBreakModal: React.FC = () => {
  const {
    activeBreakModalOpen,
    activeWaterModalOpen,
    realActiveReminder,
    previewReminder,
    completeRealReminder,
    skipRealReminder,
    finishPreview,
    waterConfig,
    screenBreakConfig,
  } = useApp();

  const isReal = realActiveReminder?.category === 'both';
  const isPreview = previewReminder?.category === 'both';

  const defaultWaterDuration = (waterConfig.durationMinutes || 2) * 60;
  const defaultScreenDuration = (screenBreakConfig.breakDurationMinutes || 5) * 60;

  const now = Date.now();
  const waterEndTimestamp = isReal
    ? realActiveReminder.waterEndTimestamp || (realActiveReminder.startTimestamp ? realActiveReminder.startTimestamp + (realActiveReminder.waterDurationSeconds || defaultWaterDuration) * 1000 : now + defaultWaterDuration * 1000)
    : isPreview
    ? previewReminder.waterEndTimestamp || now + (previewReminder.waterDurationSeconds || defaultWaterDuration) * 1000
    : now + defaultWaterDuration * 1000;

  const screenEndTimestamp = isReal
    ? realActiveReminder.screenEndTimestamp || (realActiveReminder.startTimestamp ? realActiveReminder.startTimestamp + (realActiveReminder.screenDurationSeconds || defaultScreenDuration) * 1000 : now + defaultScreenDuration * 1000)
    : isPreview
    ? previewReminder.screenEndTimestamp || now + (previewReminder.screenDurationSeconds || defaultScreenDuration) * 1000
    : now + defaultScreenDuration * 1000;

  const [waterMsRemaining, setWaterMsRemaining] = useState<number>(() =>
    Math.max(0, waterEndTimestamp - Date.now())
  );
  const [screenMsRemaining, setScreenMsRemaining] = useState<number>(() =>
    Math.max(0, screenEndTimestamp - Date.now())
  );

  const [isWaterDone, setIsWaterDone] = useState(false);
  const [isScreenDone, setIsScreenDone] = useState(false);
  const [isAllDone, setIsAllDone] = useState(false);

  const waterCompletedRef = useRef(false);
  const screenCompletedRef = useRef(false);
  const allCompletedRef = useRef(false);

  // Active when both are requested
  const isOpen = (activeBreakModalOpen && activeWaterModalOpen) || isReal || isPreview;

  useEffect(() => {
    if (!isOpen || (!isReal && !isPreview)) return;

    waterCompletedRef.current = false;
    screenCompletedRef.current = false;
    allCompletedRef.current = false;
    setIsWaterDone(false);
    setIsScreenDone(false);
    setIsAllDone(false);

    const updateTimers = () => {
      const nowTs = Date.now();
      const wRemain = Math.max(0, waterEndTimestamp - nowTs);
      const sRemain = Math.max(0, screenEndTimestamp - nowTs);

      setWaterMsRemaining(wRemain);
      setScreenMsRemaining(sRemain);

      if (wRemain === 0 && !waterCompletedRef.current) {
        waterCompletedRef.current = true;
        setIsWaterDone(true);
        notificationEngine.playWaterChime();
        if (isReal && realActiveReminder?.waterSlotId) {
          completeRealReminder('water', realActiveReminder.waterSlotId);
        }
      }

      if (sRemain === 0 && !screenCompletedRef.current) {
        screenCompletedRef.current = true;
        setIsScreenDone(true);
        notificationEngine.playScreenBell();
        if (isReal && realActiveReminder?.screenSlotId) {
          completeRealReminder('screen', realActiveReminder.screenSlotId);
        }
      }

      if (wRemain === 0 && sRemain === 0 && !allCompletedRef.current) {
        allCompletedRef.current = true;
        setIsAllDone(true);

        setTimeout(() => {
          if (isPreview) {
            finishPreview('water');
            finishPreview('screen');
          }
        }, 2000);
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 200);
    return () => clearInterval(interval);
  }, [
    isOpen,
    waterEndTimestamp,
    screenEndTimestamp,
    isReal,
    isPreview,
    realActiveReminder,
    completeRealReminder,
    finishPreview,
  ]);

  if (!isOpen || (!isReal && !isPreview)) return null;

  const formatSecs = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-fade-in select-none pt-[env(safe-area-inset-top,1rem)] pb-[env(safe-area-inset-bottom,1rem)]"
      role="dialog"
      aria-modal="true"
      aria-label="Combined Water and Look Outside Break"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-xl)] bg-slate-900 border border-indigo-500/25 p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] text-center space-y-6 z-10 animate-scale-up">
        {isAllDone ? (
          <div className="space-y-4 py-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ✓ Both Breaks Complete
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Hydrated & eyes refreshed! Returning to your apps...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest block">
                {isPreview ? 'PREVIEW COMBINED BREAK' : 'TIME FOR A BREAK'}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Simultaneous Wellness Break
              </h2>
            </div>

            {/* Dual Timer Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WATER CARD */}
              <div
                className={`p-5 rounded-2xl border transition-all duration-300 ${
                  isWaterDone
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-sky-950/40 border-sky-500/30 text-sky-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">Water</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-white py-1">
                  {isWaterDone ? '✓ Hydrated' : formatSecs(waterMsRemaining)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isWaterDone ? 'Completed' : 'Drink some water'}
                </p>
              </div>

              {/* LOOK OUTSIDE CARD */}
              <div
                className={`p-5 rounded-2xl border transition-all duration-300 ${
                  isScreenDone
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Eye className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">Look Outside</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-white py-1">
                  {isScreenDone ? '✓ Refreshed' : formatSecs(screenMsRemaining)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isScreenDone ? 'Completed' : 'Look 20ft away & relax'}
                </p>
              </div>
            </div>

            {/* Micro suggestions */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5 text-left">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Drink a glass of water while resting your eyes in the distance.</span>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Blink gently and stretch your neck.</span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={async () => {
                  if (isReal && realActiveReminder) {
                    await skipRealReminder('both', realActiveReminder.slotId);
                  } else {
                    finishPreview('water');
                    finishPreview('screen');
                  }
                }}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-colors"
              >
                Skip Breaks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
