import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Badge, ProgressBar } from './ui';
import { reminderService } from '../services/reminderService';
import {
  Droplets,
  Eye,
  ArrowRight,
  Pause,
  Play,
  Sliders,
  CheckCircle2,
  Clock,
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
    return 'in 1 min';
  }
  return `in ${mins} mins`;
}

export const Dashboard: React.FC = () => {
  const {
    authState,
    waterConfig,
    screenBreakConfig,
    generalSettings,
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
    setPauseDuration,
    currentDeviceTimestamp,
    currentUser,
  } = useApp();

  // 1. Personalized Greeting
  const userName =
    currentUser?.display_name ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'there');

  const getGreeting = () => {
    const hour = new Date(currentDeviceTimestamp).getHours();
    if (hour < 12) return `Good morning, ${userName}`;
    if (hour < 17) return `Good afternoon, ${userName}`;
    return `Good evening, ${userName}`;
  };

  // Real-time countdowns
  const waterDiffMs = nextWaterSlot
    ? Math.max(0, nextWaterSlot.scheduledTimestamp - currentDeviceTimestamp)
    : null;
  const waterCountdown = waterDiffMs !== null ? formatCountdown(waterDiffMs) : null;

  const screenDiffMs = nextScreenSlot
    ? Math.max(0, nextScreenSlot.scheduledTimestamp - currentDeviceTimestamp)
    : null;
  const screenCountdown = screenDiffMs !== null ? formatCountdown(screenDiffMs) : null;

  const todayDay = new Date(currentDeviceTimestamp).getDay();
  const waterActiveDays = waterConfig.activeDays && waterConfig.activeDays.length > 0
    ? waterConfig.activeDays
    : [0, 1, 2, 3, 4, 5, 6];
  const isWaterActiveToday = waterActiveDays.includes(todayDay);

  const screenActiveDays = screenBreakConfig.activeDays && screenBreakConfig.activeDays.length > 0
    ? screenBreakConfig.activeDays
    : [0, 1, 2, 3, 4, 5, 6];
  const isScreenActiveToday = screenActiveDays.includes(todayDay);

  // Status determinations
  const isPaused =
    pauseState.isPaused &&
    pauseState.pauseUntil &&
    new Date(pauseState.pauseUntil).getTime() > currentDeviceTimestamp;

  const waterStatus: 'active' | 'paused' | 'disabled' | 'due' | 'inactive_day' = !waterConfig.enabled
    ? 'disabled'
    : isPaused
    ? 'paused'
    : !isWaterActiveToday
    ? 'inactive_day'
    : waterDiffMs !== null && waterDiffMs === 0
    ? 'due'
    : 'active';

  const screenStatus: 'active' | 'paused' | 'disabled' | 'due' | 'inactive_day' = !screenBreakConfig.enabled
    ? 'disabled'
    : isPaused
    ? 'paused'
    : !isScreenActiveToday
    ? 'inactive_day'
    : screenDiffMs !== null && screenDiffMs === 0
    ? 'due'
    : 'active';

  // Authoritative Progress synchronized directly from reminderService
  const [authoritativeProgress, setAuthoritativeProgress] = useState<{
    waterCompleted: number;
    waterTotal: number;
    screenCompleted: number;
    screenTotal: number;
  }>({
    waterCompleted: waterCompletedCount,
    waterTotal: waterTotalCount,
    screenCompleted: screenCompletedCount,
    screenTotal: screenTotalCount,
  });

  const syncAuthoritativeProgress = useCallback(async () => {
    try {
      const userTz = generalSettings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const progress = await reminderService.getTodayProgress(currentUser?.id, { waterConfig, screenBreakConfig, timeZone: userTz });
      setAuthoritativeProgress({
        waterCompleted: progress.water.completed,
        waterTotal: progress.water.expected || waterTotalCount,
        screenCompleted: progress.lookOutside.completed,
        screenTotal: progress.lookOutside.expected || screenTotalCount,
      });
    } catch (_) {}
  }, [currentUser?.id, waterConfig, screenBreakConfig, generalSettings.timezone, waterTotalCount, screenTotalCount]);

  useEffect(() => {
    syncAuthoritativeProgress();
    const unsub = reminderService.onReminderEvent(() => {
      syncAuthoritativeProgress();
    });
    return () => unsub();
  }, [syncAuthoritativeProgress]);

  const effectiveWaterCompleted = authoritativeProgress.waterCompleted;
  const effectiveWaterTotal = authoritativeProgress.waterTotal || waterTotalCount;
  const effectiveScreenCompleted = authoritativeProgress.screenCompleted;
  const effectiveScreenTotal = authoritativeProgress.screenTotal || screenTotalCount;

  // Progress calculations
  const waterProgress =
    effectiveWaterTotal > 0 ? Math.min(100, Math.round((effectiveWaterCompleted / effectiveWaterTotal) * 100)) : 0;
  const screenProgress =
    effectiveScreenTotal > 0 ? Math.min(100, Math.round((effectiveScreenCompleted / effectiveScreenTotal) * 100)) : 0;

  // Recent completed timeline
  const recentEvents = [
    ...waterLogs
      .filter((l) => l.status === 'completed')
      .map((l) => ({
        id: l.id,
        time: l.time,
        type: 'water' as const,
        label: 'Water Break',
      })),
    ...screenLogs
      .filter((l) => l.status === 'completed')
      .map((l) => ({
        id: l.id,
        time: l.time,
        type: 'screen' as const,
        label: 'Look Outside',
      })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 3);

  return (
    <div className="space-y-8 select-none max-w-4xl mx-auto pb-8">
      {/* 1. TOP GREETING */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {getGreeting()}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Take a moment for your eyes and hydration today.
        </p>
      </div>

      {/* 2. NEXT REMINDERS (Desktop: 2 columns, Mobile: 1 column stacked) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            NEXT REMINDERS
          </span>
          {isPaused && (
            <Badge variant="warning" dot>
              Reminders Paused
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Card 1: Water */}
          <Card
            variant="default"
            padding="lg"
            className="flex flex-col justify-between space-y-6 border-[var(--border-subtle)] hover:border-[var(--water-border)] transition-all bg-[var(--bg-surface)]"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--water-subtle)] text-[var(--water-primary)] flex items-center justify-center border border-[var(--water-border)]">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight block">
                      Water
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">Hydration reminder</span>
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
                    : waterStatus === 'inactive_day'
                    ? 'Inactive Today'
                    : 'Disabled'}
                </Badge>
              </div>

              {/* Next Time & Remaining */}
              <div className="pt-2">
                {authState === 'checking' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-muted)] animate-pulse">
                      Loading configuration...
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Synchronizing with cloud.
                    </p>
                  </div>
                ) : waterStatus === 'disabled' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-muted)]">Disabled</span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Water reminders are turned off in settings.
                    </p>
                  </div>
                ) : waterStatus === 'paused' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--warning-primary)]">Paused</span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Reminders will resume automatically.
                    </p>
                  </div>
                ) : waterStatus === 'inactive_day' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-muted)]">
                      Inactive Today
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      No water reminders scheduled for today.
                    </p>
                  </div>
                ) : nextWaterSlot ? (
                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight">
                        {nextWaterSlot.time}
                      </span>
                      <span className="text-xs font-bold text-[var(--water-primary)] px-2 py-0.5 rounded-md bg-[var(--water-subtle)]">
                        {waterCountdown}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {(waterConfig.durationMinutes || 2)} min reminder duration
                    </p>
                  </div>
                ) : waterTotalCount > 0 && waterCompletedCount >= waterTotalCount ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      All done for today
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Completed all {waterTotalCount} scheduled water breaks.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-secondary)]">
                      No Remaining Slots
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Scheduled schedule window ended for today.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Link to Water Settings */}
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setActiveTab('water')}
                className="w-full flex items-center justify-between text-xs font-semibold text-[var(--water-primary)] hover:text-[var(--text-primary)] transition-all cursor-pointer py-1"
              >
                <span>Water settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* Card 2: Look Outside */}
          <Card
            variant="default"
            padding="lg"
            className="flex flex-col justify-between space-y-6 border-[var(--border-subtle)] hover:border-[var(--screen-border)] transition-all bg-[var(--bg-surface)]"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--screen-subtle)] text-[var(--screen-primary)] flex items-center justify-center border border-[var(--screen-border)]">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight block">
                      Look Outside
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">Screen break</span>
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
                    : screenStatus === 'inactive_day'
                    ? 'Inactive Today'
                    : 'Disabled'}
                </Badge>
              </div>

              {/* Next Time & Remaining */}
              <div className="pt-2">
                {authState === 'checking' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-muted)] animate-pulse">
                      Loading configuration...
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Synchronizing with cloud.
                    </p>
                  </div>
                ) : screenStatus === 'disabled' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-muted)]">Disabled</span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Screen breaks are turned off in settings.
                    </p>
                  </div>
                ) : screenStatus === 'paused' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--warning-primary)]">Paused</span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Screen breaks will resume automatically.
                    </p>
                  </div>
                ) : screenStatus === 'inactive_day' ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-muted)]">
                      Inactive Today
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      No screen breaks scheduled for today.
                    </p>
                  </div>
                ) : nextScreenSlot ? (
                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight">
                        {nextScreenSlot.time}
                      </span>
                      <span className="text-xs font-bold text-[var(--screen-primary)] px-2 py-0.5 rounded-md bg-[var(--screen-subtle)]">
                        {screenCountdown}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {(screenBreakConfig.breakDurationMinutes || 5)} min eye break duration
                    </p>
                  </div>
                ) : screenTotalCount > 0 && screenCompletedCount >= screenTotalCount ? (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      All done for today
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Completed all {screenTotalCount} scheduled breaks for today.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-lg font-bold text-[var(--text-secondary)]">
                      No Remaining Slots
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      Scheduled schedule window ended for today.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Link to Look Outside Settings */}
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setActiveTab('screenbreak')}
                className="w-full flex items-center justify-between text-xs font-semibold text-[var(--screen-primary)] hover:text-[var(--text-primary)] transition-all cursor-pointer py-1"
              >
                <span>Look Outside settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. TODAY'S PROGRESS */}
      <Card variant="default" padding="lg" className="space-y-5 bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            TODAY'S PROGRESS
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('statistics')}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-all cursor-pointer"
          >
            View analytics <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Water Progress */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[var(--water-primary)]" />
                <span className="font-semibold text-[var(--text-primary)]">Water</span>
              </div>
              <span className="font-mono font-medium text-[var(--text-secondary)]">
                {effectiveWaterCompleted} / {effectiveWaterTotal} ({waterProgress}%)
              </span>
            </div>
            <ProgressBar value={waterProgress} variant="water" size="md" />
          </div>

          {/* Look Outside Progress */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--screen-primary)]" />
                <span className="font-semibold text-[var(--text-primary)]">Look Outside</span>
              </div>
              <span className="font-mono font-medium text-[var(--text-secondary)]">
                {effectiveScreenCompleted} / {effectiveScreenTotal} ({screenProgress}%)
              </span>
            </div>
            <ProgressBar value={screenProgress} variant="screen" size="md" />
          </div>
        </div>
      </Card>

      {/* 4. QUICK ACTIONS */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
          QUICK ACTIONS
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={() => {
              if (isPaused) {
                setPauseDuration(null);
              } else {
                setActivePauseModalOpen(true);
              }
            }}
            className="min-h-[48px] p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {isPaused ? (
                <Play className="w-4 h-4 text-[var(--success-primary)]" />
              ) : (
                <Pause className="w-4 h-4 text-[var(--warning-primary)]" />
              )}
              <span>{isPaused ? 'Resume reminders' : 'Pause reminders'}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>

          {/* Water Settings */}
          <button
            type="button"
            onClick={() => setActiveTab('water')}
            className="min-h-[48px] p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Droplets className="w-4 h-4 text-[var(--water-primary)]" />
              <span>Water settings</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>

          {/* Look Outside Settings */}
          <button
            type="button"
            onClick={() => setActiveTab('screenbreak')}
            className="min-h-[48px] p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-[var(--screen-primary)]" />
              <span>Look Outside settings</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* 5. RECENT ACTIVITY */}
      <div className="space-y-3 pt-1">
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
          RECENT ACTIVITY
        </span>

        {recentEvents.length === 0 ? (
          <Card variant="default" padding="md" className="text-center py-6 bg-[var(--bg-surface)]">
            <p className="text-xs text-[var(--text-muted)]">
              No activity logged yet today. Completed reminders will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between py-2.5 px-3.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[var(--text-muted)] text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {evt.time}
                  </span>
                  <div className="flex items-center gap-2">
                    {evt.type === 'water' ? (
                      <Droplets className="w-3.5 h-3.5 text-[var(--water-primary)]" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-[var(--screen-primary)]" />
                    )}
                    <span className="font-medium text-[var(--text-primary)]">{evt.label}</span>
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
