import React from 'react';
import { useApp } from '../context/AppContext';
import { Card, Badge, ProgressBar } from './ui';
import {
  Droplets,
  Eye,
  ArrowRight,
  Pause,
  CheckCircle2,
} from 'lucide-react';

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return 'due now';
  const totalSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;

  if (mins === 0) {
    return `in ${secs}s`;
  }
  if (mins === 1) {
    return 'in 1 minute';
  }
  return `in ${mins} minutes`;
}

export const Dashboard: React.FC = () => {
  const {
    waterConfig,
    screenBreakConfig,
    nextWaterSlot,
    nextScreenSlot,
    waterCompletedCount,
    waterTotalCount,
    screenCompletedCount,
    screenTotalCount,
    waterLogs,
    screenLogs,
    setActiveTab,
    setActivePauseModalOpen,
    pauseState,
    currentDeviceTimestamp,
  } = useApp();

  // Greeting based on device local hour
  const getGreeting = () => {
    const hour = new Date(currentDeviceTimestamp).getHours();
    if (hour < 12) return 'Good morning, Gowtham.';
    if (hour < 17) return 'Good afternoon, Gowtham.';
    return 'Good evening, Gowtham.';
  };

  // Real-time dynamic relative countdowns
  const waterDiffMs = nextWaterSlot
    ? Math.max(0, nextWaterSlot.scheduledTimestamp - currentDeviceTimestamp)
    : null;
  const waterCountdown = waterDiffMs !== null ? formatCountdown(waterDiffMs) : null;

  const screenDiffMs = nextScreenSlot
    ? Math.max(0, nextScreenSlot.scheduledTimestamp - currentDeviceTimestamp)
    : null;
  const screenCountdown = screenDiffMs !== null ? formatCountdown(screenDiffMs) : null;

  // Status determinations
  const isPaused =
    pauseState.isPaused &&
    pauseState.pauseUntil &&
    new Date(pauseState.pauseUntil).getTime() > currentDeviceTimestamp;

  const waterStatus: 'active' | 'paused' | 'disabled' | 'due' = !waterConfig.enabled
    ? 'disabled'
    : isPaused
    ? 'paused'
    : waterDiffMs !== null && waterDiffMs === 0
    ? 'due'
    : 'active';

  const screenStatus: 'active' | 'paused' | 'disabled' | 'due' = !screenBreakConfig.enabled
    ? 'disabled'
    : isPaused
    ? 'paused'
    : screenDiffMs !== null && screenDiffMs === 0
    ? 'due'
    : 'active';

  // Progress calculations
  const waterProgress =
    waterTotalCount > 0 ? Math.round((waterCompletedCount / waterTotalCount) * 100) : 0;
  const screenProgress =
    screenTotalCount > 0 ? Math.round((screenCompletedCount / screenTotalCount) * 100) : 0;

  // Recent completed timeline
  const recentEvents = [
    ...waterLogs
      .filter((l) => l.status === 'completed')
      .map((l) => ({
        id: l.id,
        time: l.time,
        type: 'water' as const,
        label: 'Water Break',
        status: 'completed',
      })),
    ...screenLogs
      .filter((l) => l.status === 'completed')
      .map((l) => ({
        id: l.id,
        time: l.time,
        type: 'screen' as const,
        label: 'Look Outside',
        status: 'completed',
      })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 4);

  return (
    <div className="space-y-9 select-none">
      {/* 1. Header Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          {getGreeting()}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-normal">
          Take a moment for yourself today.
        </p>
      </div>

      {/* 2. Primary Section: NEXT REMINDERS (Equal Side-by-Side Cards) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            NEXT REMINDERS
          </span>
          {isPaused && (
            <Badge variant="warning" dot>
              Reminders Paused
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: 💧 WATER */}
          <Card
            variant="default"
            padding="lg"
            className="flex flex-col justify-between space-y-6 border-[var(--border-subtle)] hover:border-[var(--water-border)] transition-all"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--water-subtle)] text-[var(--water-primary)] flex items-center justify-center border border-[var(--water-border)]">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] tracking-tight block">
                      WATER
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Hydration reminder
                    </span>
                  </div>
                </div>

                <Badge
                  variant={
                    waterStatus === 'active'
                      ? 'water'
                      : waterStatus === 'due'
                      ? 'warning'
                      : 'neutral'
                  }
                  dot
                >
                  {waterStatus === 'active'
                    ? 'Active'
                    : waterStatus === 'due'
                    ? 'Due Now'
                    : waterStatus === 'paused'
                    ? 'Paused'
                    : 'Disabled'}
                </Badge>
              </div>

              {/* Main Time & Countdown */}
              <div className="pt-2">
                {waterStatus === 'disabled' ? (
                  <div className="space-y-1">
                    <span className="text-xl font-bold text-[var(--text-muted)]">
                      Reminders Disabled
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Turn on water reminders in settings.
                    </p>
                  </div>
                ) : waterStatus === 'paused' ? (
                  <div className="space-y-1">
                    <span className="text-xl font-bold text-[var(--warning-primary)]">
                      Paused
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Reminders will resume automatically.
                    </p>
                  </div>
                ) : nextWaterSlot ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight">
                        {nextWaterSlot.time}
                      </span>
                      <span className="text-xs font-bold text-[var(--water-primary)]">
                        {waterCountdown}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Drink some water to stay refreshed.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-xl font-bold text-[var(--text-primary)]">
                      All done for today
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Completed all scheduled water breaks.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setActiveTab('water')}
                className="w-full flex items-center justify-between text-xs font-semibold text-[var(--water-primary)] hover:text-[var(--text-primary)] transition-all cursor-pointer py-1"
              >
                <span>View reminder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* Card 2: 👁 LOOK OUTSIDE */}
          <Card
            variant="default"
            padding="lg"
            className="flex flex-col justify-between space-y-6 border-[var(--border-subtle)] hover:border-[var(--screen-border)] transition-all"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--screen-subtle)] text-[var(--screen-primary)] flex items-center justify-center border border-[var(--screen-border)]">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] tracking-tight block">
                      LOOK OUTSIDE
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Screen break
                    </span>
                  </div>
                </div>

                <Badge
                  variant={
                    screenStatus === 'active'
                      ? 'screen'
                      : screenStatus === 'due'
                      ? 'warning'
                      : 'neutral'
                  }
                  dot
                >
                  {screenStatus === 'active'
                    ? 'Active'
                    : screenStatus === 'due'
                    ? 'Due Now'
                    : screenStatus === 'paused'
                    ? 'Paused'
                    : 'Disabled'}
                </Badge>
              </div>

              {/* Main Time & Countdown */}
              <div className="pt-2">
                {screenStatus === 'disabled' ? (
                  <div className="space-y-1">
                    <span className="text-xl font-bold text-[var(--text-muted)]">
                      Reminders Disabled
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Turn on screen breaks in settings.
                    </p>
                  </div>
                ) : screenStatus === 'paused' ? (
                  <div className="space-y-1">
                    <span className="text-xl font-bold text-[var(--warning-primary)]">
                      Paused
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Screen breaks will resume automatically.
                    </p>
                  </div>
                ) : nextScreenSlot ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight">
                        {nextScreenSlot.time}
                      </span>
                      <span className="text-xs font-bold text-[var(--screen-primary)]">
                        {screenCountdown}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Give your eyes a short break.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-xl font-bold text-[var(--text-primary)]">
                      All done for today
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Completed all scheduled breaks for today.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setActiveTab('screenbreak')}
                className="w-full flex items-center justify-between text-xs font-semibold text-[var(--screen-primary)] hover:text-[var(--text-primary)] transition-all cursor-pointer py-1"
              >
                <span>View reminder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. TODAY'S PROGRESS */}
      <Card variant="default" padding="lg" className="space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            TODAY'S PROGRESS
          </span>
          <button
            onClick={() => setActiveTab('statistics')}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-all cursor-pointer"
          >
            Detailed statistics <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Water Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Droplets className="w-3.5 h-3.5 text-[var(--water-primary)]" />
                <span className="font-semibold text-[var(--text-primary)]">Water</span>
              </div>
              <span className="font-mono text-[var(--text-muted)]">
                {waterCompletedCount} / {waterTotalCount} ({waterProgress}%)
              </span>
            </div>
            <ProgressBar value={waterProgress} variant="water" size="md" />
          </div>

          {/* Look Outside Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-[var(--screen-primary)]" />
                <span className="font-semibold text-[var(--text-primary)]">Look Outside</span>
              </div>
              <span className="font-mono text-[var(--text-muted)]">
                {screenCompletedCount} / {screenTotalCount} ({screenProgress}%)
              </span>
            </div>
            <ProgressBar value={screenProgress} variant="screen" size="md" />
          </div>
        </div>
      </Card>

      {/* 4. QUICK ACTIONS */}
      <div className="space-y-3">
        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
          QUICK ACTIONS
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setActiveTab('water')}
            className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Droplets className="w-4 h-4 text-[var(--water-primary)]" />
              <span>Water schedule</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>

          <button
            onClick={() => setActiveTab('screenbreak')}
            className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-[var(--screen-primary)]" />
              <span>Look Outside settings</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>

          <button
            onClick={() => setActivePauseModalOpen(true)}
            className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Pause className="w-4 h-4 text-[var(--warning-primary)]" />
              <span>{isPaused ? 'Resume reminders' : 'Pause reminders'}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* 5. RECENT ACTIVITY */}
      <div className="space-y-3 pt-2">
        <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
          RECENT ACTIVITY
        </span>

        {recentEvents.length === 0 ? (
          <Card variant="default" padding="md" className="text-center py-6">
            <p className="text-xs text-[var(--text-muted)]">
              No activity logged yet today. Completed reminders will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between py-2.5 px-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[var(--text-muted)] text-[11px]">
                    {evt.time}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {evt.type === 'water' ? (
                      <Droplets className="w-3.5 h-3.5 text-[var(--water-primary)]" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-[var(--screen-primary)]" />
                    )}
                    <span className="font-medium text-[var(--text-primary)]">
                      {evt.label}
                    </span>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-[var(--success-primary)] font-medium text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
