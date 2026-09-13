import React, { useState, useEffect, useRef } from 'react';
import { Droplets, Eye, Wind } from 'lucide-react';
import { notificationService } from '../platform';
import { reminderService } from '../services/reminderService';
import { authService } from '../services/authService';

export interface ActiveReminderItem {
  type: 'water' | 'screen';
  category: 'water' | 'screen';
  occurrenceId: string;
  slotId: string;
  durationSeconds: number;
  durationMs: number;
  endTimestamp: number;
  scheduledAt?: string;
  triggeredAt?: number;
  isPreview?: boolean;
}

export const StandaloneReminder: React.FC = () => {
  const [activeReminders, setActiveReminders] = useState<ActiveReminderItem[]>(() => {
    // Initial parse from URL params as fallback
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const type = (searchParams.get('type') as 'water' | 'screen') || null;
      if (type) {
        const duration = Number(searchParams.get('duration')) || (type === 'water' ? 120 : 300);
        const endTimestamp =
          Number(searchParams.get('endTimestamp')) || Date.now() + duration * 1000;
        const slotId = searchParams.get('slotId') || `${type}:${Date.now()}`;
        const isPreview = searchParams.get('isPreview') === 'true';
        return [
          {
            type,
            category: type,
            occurrenceId: slotId,
            slotId,
            durationSeconds: duration,
            durationMs: duration * 1000,
            endTimestamp,
            isPreview,
          },
        ];
      }
    }
    return [];
  });

  const completedSlotsRef = useRef<Set<string>>(new Set());
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(Date.now());

  const handleCompleteItem = async (item: ActiveReminderItem) => {
    if (completedSlotsRef.current.has(item.slotId)) return;
    completedSlotsRef.current.add(item.slotId);

    // Play audio chime for this specific completion
    if (item.type === 'water') {
      notificationService.playWaterChime();
    } else {
      notificationService.playScreenBell();
    }

    // Direct event recording in reminderService for 100% data reliability
    if (!item.isPreview) {
      try {
        const user = await authService.getCurrentUser();
        const userId = user?.id || '';
        if (userId) {
          const cat = item.type === 'screen' ? 'look_outside' : item.type;
          await reminderService.recordCompleted(userId, cat, item.slotId, item.scheduledAt);
        }
      } catch (err) {
        console.warn('[StandaloneReminder] Event persistence error:', err);
      }
    }

    // Complete reminder in native main process immediately
    if ((window as any).eyeflowNative?.completeReminderItem) {
      (window as any).eyeflowNative.completeReminderItem(
        item.type,
        item.slotId,
        item.isPreview
      );
    }
  };

  const handleSkipItem = async (item: ActiveReminderItem) => {
    if (completedSlotsRef.current.has(item.slotId)) return;
    completedSlotsRef.current.add(item.slotId);

    // Direct event recording in reminderService for 100% data reliability
    if (!item.isPreview) {
      try {
        const user = await authService.getCurrentUser();
        const userId = user?.id || '';
        if (userId) {
          const cat = item.type === 'screen' ? 'look_outside' : item.type;
          await reminderService.recordExpired(userId, cat, item.slotId);
        }
      } catch (err) {
        console.warn('[StandaloneReminder] Event expiration persistence error:', err);
      }
    }

    // Skip reminder in native main process immediately
    if ((window as any).eyeflowNative?.skipReminderItem) {
      (window as any).eyeflowNative.skipReminderItem(
        item.type,
        item.slotId,
        item.isPreview
      );
    }
  };

  // 1. Fetch initial active reminders from Native Electron Bridge & listen to dynamic updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).eyeflowNative?.getActiveReminders) {
      (window as any).eyeflowNative.getActiveReminders().then((items: ActiveReminderItem[]) => {
        if (items) {
          setActiveReminders(items);
        }
      });
    }

    const cleanup = (window as any).eyeflowNative?.onActiveRemindersUpdated?.(
      (items: ActiveReminderItem[]) => {
        if (items) {
          setActiveReminders(items);
        }
      }
    );

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // 2. High-frequency reactive clock pulse (100ms) for smooth timestamp countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // 3. Monitor independent countdown completions for each active reminder
  useEffect(() => {
    activeReminders.forEach((item) => {
      const remaining = Math.max(0, item.endTimestamp - currentTimestamp);

      if (remaining === 0 && !completedSlotsRef.current.has(item.slotId)) {
        handleCompleteItem(item);
      }
    });
  }, [currentTimestamp, activeReminders]);

  // Set dark theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  if (activeReminders.length === 0) {
    return null;
  }

  const isSimultaneous = activeReminders.length >= 2;

  // Single reminder card renderer
  const renderCard = (item: ActiveReminderItem) => {
    const remainingMs = Math.max(0, item.endTimestamp - currentTimestamp);
    const totalSecsLeft = Math.ceil(remainingMs / 1000);
    const displayMins = Math.floor(totalSecsLeft / 60);
    const displaySecs = totalSecsLeft % 60;
    const formattedTime = `${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(
      2,
      '0'
    )}`;

    if (item.type === 'water') {
      return (
        <div
          key={item.slotId}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={`flex-1 rounded-3xl bg-slate-900/95 border border-sky-500/30 p-7 text-center space-y-6 shadow-2xl transition-all ${
            isSimultaneous ? 'max-w-md w-full' : 'max-w-sm w-full'
          }`}
        >
          <div className="space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/15 text-sky-400 mx-auto flex items-center justify-center border border-sky-500/30 shadow-md">
              <Droplets className="w-7 h-7 animate-pulse" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-widest block">
                {item.isPreview ? 'PREVIEW WATER' : 'WATER BREAK'}
              </span>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Drink some water.
              </h2>
            </div>

            <div className="py-2">
              <span className="text-5xl font-black text-sky-400 font-mono tracking-tight">
                {formattedTime}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              {item.isPreview
                ? `Preview closes in ${formattedTime}`
                : `Take a slow sip • Window closes automatically in ${formattedTime}`}
            </p>

            <div className="pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkipItem(item);
                }}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-colors"
              >
                Skip Break
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Look Outside Card
    const totalDurationMs = item.durationSeconds * 1000;
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    const progressRatio = Math.max(0, Math.min(1, 1 - remainingMs / totalDurationMs));
    const strokeDashoffset = circumference * (1 - progressRatio);

    return (
      <div
        key={item.slotId}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex-1 rounded-3xl bg-slate-900/95 border border-indigo-500/30 p-7 text-center space-y-6 shadow-2xl transition-all ${
          isSimultaneous ? 'max-w-md w-full' : 'max-w-md w-full'
        }`}
      >
        <div className="space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 text-indigo-400 mx-auto flex items-center justify-center border border-indigo-500/30 shadow-md">
            <Eye className="w-7 h-7 animate-pulse" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest block">
              {item.isPreview ? 'PREVIEW BREAK' : 'LOOK OUTSIDE'}
            </span>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Give your eyes a short break.
            </h2>
          </div>

          {/* Circular Progress Ring */}
          <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-indigo-500 transition-all duration-200 ease-out"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
              <span className="text-3xl font-black text-white font-mono tracking-tight">
                {formattedTime}
              </span>
              <span className="text-[10px] font-semibold text-indigo-300 flex items-center gap-1">
                <Wind className="w-3 h-3" /> Relax & breathe
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium">
            Look 20+ feet away • Ends in {formattedTime}
          </p>

          <div className="pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSkipItem(item);
              }}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-colors"
            >
              Skip Break
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 w-screen h-screen min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950/75 backdrop-blur-2xl select-none overflow-hidden font-sans cursor-default"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {isSimultaneous ? (
        /* ========================================================
           SIMULTANEOUS DUAL REMINDER LAYOUT (SIDE-BY-SIDE)
           ======================================================== */
        <div className="w-full max-w-4xl space-y-5 animate-scale-up">
          {/* Header */}
          <div className="text-center space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              PauseFlow
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              TIME FOR A BREAK
            </h1>
          </div>

          {/* Side-by-side cards */}
          <div className="flex flex-col md:flex-row items-stretch justify-center gap-5">
            {activeReminders.map(renderCard)}
          </div>

          {/* Footer Note */}
          <div className="text-center pt-1">
            <span className="text-xs font-medium text-slate-400 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Both reminders are active • Timers run independently
            </span>
          </div>
        </div>
      ) : (
        /* ========================================================
           SINGLE REMINDER LAYOUT
           ======================================================== */
        <div className="w-full flex items-center justify-center animate-scale-up">
          {activeReminders.map(renderCard)}
        </div>
      )}
    </div>
  );
};
