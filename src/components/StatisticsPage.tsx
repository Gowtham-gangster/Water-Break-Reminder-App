// src/components/StatisticsPage.tsx
// PauseFlow — Comprehensive User-Scoped Statistics, Compact Recent Daily Summary, Full Daily Report & Completed Reminder History

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button } from './ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Droplets,
  Eye,
  Award,
  Flame,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Calendar,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { reminderService, type UserStatistics, type UserHistoryResponse } from '../services/reminderService';
import { DailyReportModal } from './DailyReportModal';
import { formatUserTime, formatUserDateTime } from '../utils/timeFormat';

type HistoryRange = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom';
type HistoryTypeFilter = 'all' | 'water' | 'look_outside';

export const StatisticsPage: React.FC = () => {
  const {
    currentUser,
    authState,
    waterConfig,
    screenBreakConfig,
    generalSettings,
    waterCompletedCount,
    screenCompletedCount,
  } = useApp();

  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [historyData, setHistoryData] = useState<UserHistoryResponse>({
    events: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const [range, setRange] = useState<HistoryRange>('today');
  const [typeFilter, setTypeFilter] = useState<HistoryTypeFilter>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState<boolean>(false);
  const viewFullReportButtonRef = React.useRef<HTMLButtonElement>(null);

  const fetchStatsAndHistory = useCallback(async (
    selectedRange: HistoryRange,
    selectedType: HistoryTypeFilter,
    pageNum: number,
    start?: string,
    end?: string
  ) => {
    // Strict authentication guard: Never query or load history if no authenticated user
    const userId = currentUser?.id;
    if (!userId || authState === 'unauthenticated') {
      setStats(null);
      setHistoryData({
        events: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userTz = generalSettings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const [fetchedStats, fetchedHistory] = await Promise.all([
        reminderService.getStatistics(userId, {
          waterConfig,
          screenBreakConfig,
          timeZone: userTz,
          accountCreatedAt: currentUser?.created_at,
        }),
        reminderService.getHistory(userId, {
          range: selectedRange,
          type: selectedType,
          status: 'completed',
          page: pageNum,
          limit: 10,
          startDate: selectedRange === 'custom' ? start : undefined,
          endDate: selectedRange === 'custom' ? end : undefined,
          timeZone: userTz,
          accountCreatedAt: currentUser?.created_at,
        }),
      ]);
      setStats(fetchedStats);
      setHistoryData(fetchedHistory);
    } catch (err) {
      console.error('[StatisticsPage] Failed to load statistics/history:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, currentUser?.created_at, authState, waterConfig, screenBreakConfig, generalSettings.timezone]);

  useEffect(() => {
    if (currentUser?.id && authState === 'authenticated') {
      fetchStatsAndHistory(range, typeFilter, currentPage, customStart, customEnd);
    } else {
      setStats(null);
      setHistoryData({
        events: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    }
  }, [currentUser?.id, authState, range, typeFilter, currentPage, fetchStatsAndHistory, waterCompletedCount, screenCompletedCount]);

  const handleRangeChange = (newRange: HistoryRange) => {
    setRange(newRange);
    setCurrentPage(1);
    if (newRange !== 'custom') {
      fetchStatsAndHistory(newRange, typeFilter, 1);
    }
  };

  const handleTypeChange = (newType: HistoryTypeFilter) => {
    setTypeFilter(newType);
    setCurrentPage(1);
    fetchStatsAndHistory(range, newType, 1, customStart, customEnd);
  };

  const handleCustomFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchStatsAndHistory('custom', typeFilter, 1, customStart, customEnd);
  };

  const formatDateLabel = (dateStr: string) => {
    const dParts = dateStr.split('-');
    if (dParts.length < 3) return dateStr;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = parseInt(dParts[1], 10) - 1;
    return `${monthNames[monthIdx] || dParts[1]} ${dParts[2]}`;
  };

  // Format canonical reminder timestamp (e.g. "11:15 PM" for today, or "Sep 13 · 9:32 AM" for other ranges)
  const formatReminderTimestamp = (timestamp?: string | null) => {
    if (!timestamp) return '';
    return range === 'today'
      ? formatUserTime(timestamp, generalSettings.timeFormat, generalSettings.timezone)
      : formatUserDateTime(timestamp, generalSettings.timeFormat, generalSettings.timezone);
  };

  // If user is not authenticated, render clean empty / authentication state
  if (authState === 'unauthenticated' || !currentUser) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto pb-24 md:pb-8 select-none">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            User Statistics & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Real-time tracking, streaks, and personal reminder consistency.
          </p>
        </div>

        <Card variant="default" padding="lg" className="text-center py-16 space-y-4 border-dashed border-[var(--border-subtle)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
              Sign in to view your reminder history
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Your statistics, streaks, daily reports, and completed reminder logs are securely isolated to your account.
            </p>
          </div>
          <div className="pt-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              Sign In to PauseFlow
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const chartData = stats?.monthlyTrends && stats.monthlyTrends.length > 0
    ? stats.monthlyTrends.map((t) => ({
        date: formatDateLabel(t.date),
        rawDate: t.date,
        waterCompleted: t.waterCompleted,
        screenCompleted: t.screenCompleted,
      }))
    : [];

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] shadow-xl text-xs space-y-2 min-w-[190px]">
          <p className="font-bold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-1.5 flex items-center justify-between">
            <span>{label}</span>
          </p>
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-sky-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
                Water Completed:
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{data.waterCompleted}</span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-[var(--border-subtle)]/50">
              <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#6366f1]" />
                Look Completed:
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{data.screenCompleted}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-24 md:pb-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            User Statistics & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Real-time tracking, streaks, and personal reminder consistency.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={() => fetchStatsAndHistory(range, typeFilter, currentPage, customStart, customEnd)}
          className="self-start sm:self-auto cursor-pointer"
        >
          Refresh
        </Button>
      </div>

      {/* Streak & Key Rates Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Streak */}
        <Card variant="default" padding="md" className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-500">
            <span>Current Streak</span>
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] font-mono">
              {stats?.currentStreak ?? 0}
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)]">days</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">Keep it going today!</p>
        </Card>

        {/* Best Streak */}
        <Card variant="default" padding="md" className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
            <span>Best Streak</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] font-mono">
              {stats?.bestStreak ?? 0}
            </span>
            <span className="text-xs font-medium text-[var(--text-muted)]">days</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">All-time record</p>
        </Card>

        {/* Daily Completion Rate */}
        <Card variant="default" padding="md" className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
            <span>Daily Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] font-mono">
              {stats?.dailyCompletionRate ?? 0}%
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">Today's completion</p>
        </Card>

        {/* Weekly Completion Rate */}
        <Card variant="default" padding="md" className="relative overflow-hidden bg-gradient-to-br from-sky-500/10 to-transparent border-sky-500/20">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
            <span>Weekly Rate</span>
            <Award className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] font-mono">
              {stats?.weeklyCompletionRate ?? 0}%
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">Last 7 days consistency</p>
        </Card>
      </div>

      {/* Today's Progress & Recent Daily Summary Grid — PERFECT EQUAL HEIGHT ON DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Today's Progress */}
        <Card variant="default" padding="lg" className="h-full flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="font-bold text-base text-[var(--text-primary)]">Today's Progress</h2>
                <p className="text-xs text-[var(--text-muted)]">Active daily reminder completion</p>
              </div>
              <Badge variant={stats?.today.isWaterActive || stats?.today.isScreenActive ? 'water' : 'neutral'}>
                {stats?.today.isWaterActive || stats?.today.isScreenActive ? 'Active Today' : 'Finalized'}
              </Badge>
            </div>

            <div className="space-y-3">
              {/* Water Progress */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Water Intake</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {stats?.today.isWaterFinalized
                        ? `Finalized · ${stats?.today.waterMissed ?? 0} missed`
                        : 'Completed / Expected'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-mono text-[var(--water-primary)]">
                    {stats?.today.waterCompleted ?? 0}{' '}
                    <span className="text-xs font-normal text-[var(--text-muted)]">
                      / {stats?.today.waterScheduled ?? 0}
                    </span>
                  </p>
                  {stats?.today.isWaterFinalized && (
                    <span className="text-[11px] text-rose-400 font-mono">
                      {stats?.today.waterMissed ?? 0} missed
                    </span>
                  )}
                </div>
              </div>

              {/* Look Outside Progress */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Look Outside</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {stats?.today.isScreenFinalized
                        ? `Finalized · ${stats?.today.screenMissed ?? 0} missed`
                        : 'Completed / Expected'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-mono text-indigo-400">
                    {stats?.today.screenCompleted ?? 0}{' '}
                    <span className="text-xs font-normal text-[var(--text-muted)]">
                      / {stats?.today.screenScheduled ?? 0}
                    </span>
                  </p>
                  {stats?.today.isScreenFinalized && (
                    <span className="text-[11px] text-rose-400 font-mono">
                      {stats?.today.screenMissed ?? 0} missed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Daily Summary — COMPACT FINALIZED DESIGN */}
        <Card variant="default" padding="lg" className="h-full flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="font-bold text-base text-[var(--text-primary)]">Recent Daily Summary</h2>
              <p className="text-xs text-[var(--text-muted)]">Completed & missed totals for recent finalized days</p>
            </div>

            <div className="space-y-2.5 pt-0.5">
              {stats?.recentFinalizedDays && stats.recentFinalizedDays.length > 0 ? (
                stats.recentFinalizedDays.map((day) => (
                  <div key={day.date} className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)] pb-1.5 border-b border-[var(--border-subtle)]/50">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        {formatDateLabel(day.date)}
                      </span>
                      <Badge variant="neutral" className="text-[10px] tracking-wider uppercase font-mono">
                        Finalized
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-0.5">
                      {/* Water */}
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] text-sky-400 font-semibold flex items-center gap-1 mb-1 truncate">
                          <Droplets className="w-3 h-3 shrink-0" /> Water
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-400 truncate">{day.waterCompleted} completed</div>
                        <div className="text-xs font-mono font-medium text-rose-400 truncate">{day.waterMissed} missed</div>
                      </div>

                      {/* Look Outside */}
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1 mb-1 truncate">
                          <Eye className="w-3 h-3 shrink-0" /> Look Outside
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-400 truncate">{day.screenCompleted} completed</div>
                        <div className="text-xs font-mono font-medium text-rose-400 truncate">{day.screenMissed} missed</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[var(--text-muted)] space-y-1">
                  <Calendar className="w-6 h-6 mx-auto opacity-40 mb-1" />
                  <p>No finalized days yet.</p>
                  <p className="text-[11px]">Daily statistics finalize when the schedule window closes.</p>
                </div>
              )}
            </div>
          </div>

          {/* View Full Report Link */}
          <div className="pt-2 flex justify-end border-t border-[var(--border-subtle)]">
            <button
              ref={viewFullReportButtonRef}
              type="button"
              onClick={() => setIsDailyReportOpen(true)}
              className="text-xs font-semibold text-[var(--accent-primary)] hover:underline flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>View full report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>
      </div>

      {/* Daily Activity (Last 7 Days) — COMPLETED ONLY */}
      {chartData.length > 0 && (
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border-subtle)] gap-2">
            <div>
              <h2 className="font-bold text-base text-[var(--text-primary)]">Daily Activity (Last 7 Days)</h2>
              <p className="text-xs text-[var(--text-secondary)]">Successfully completed reminders by day.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
                Water Completed
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                Look Outside Completed
              </span>
            </div>
          </div>

          <div className="h-68 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip content={renderCustomTooltip} />
                <Bar name="Water Completed" dataKey="waterCompleted" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar name="Look Outside Completed" dataKey="screenCompleted" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Reminder History Log — COMPLETED REMINDERS ONLY */}
      <Card variant="default" padding="lg" className="space-y-6">
        <div className="flex flex-col gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-lg text-[var(--text-primary)]">Reminder History</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {historyData.total > 0
                  ? `Showing ${historyData.events.length} of ${historyData.total} completed reminders.`
                  : 'Completed reminder history.'}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {/* Date Range Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['today', 'yesterday', 'this_week', 'this_month', 'all', 'custom'] as HistoryRange[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleRangeChange(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    range === tab
                      ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                      : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {tab === 'this_week' ? 'This Week' : tab === 'this_month' ? 'This Month' : tab === 'all' ? 'All Time' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Sub-Filter: Type */}
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => handleTypeChange(e.target.value as HistoryTypeFilter)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="water">Water</option>
                <option value="look_outside">Look Outside</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {range === 'custom' && (
          <form onSubmit={handleCustomFilterSubmit} className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="block px-3 py-1.5 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="block px-3 py-1.5 text-xs rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                required
              />
            </div>
            <Button type="submit" size="sm" variant="primary">
              Apply
            </Button>
          </form>
        )}

        {/* History List */}
        <div className="space-y-2">
          {historyData.events.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] space-y-1">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-[var(--text-primary)]">No completed reminders yet.</p>
              <p className="text-xs text-[var(--text-secondary)]">Complete your first reminder and it will appear here.</p>
            </div>
          ) : (
            historyData.events.map((ev) => {
              const isWater = ev.type === 'water';
              const canonicalTimestamp = ev.scheduled_at || ev.completed_at || ev.created_at;
              const formattedDisplayTime = formatReminderTimestamp(canonicalTimestamp);

              return (
                <div
                  key={ev.id || `${ev.scheduled_at}-${ev.type}`}
                  className="flex items-center justify-between py-2.5 px-3.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs hover:border-[var(--border-prominent)] transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[var(--text-muted)] text-[11px] flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formattedDisplayTime}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      {isWater ? (
                        <Droplets className="w-3.5 h-3.5 text-[var(--water-primary)] shrink-0" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-[var(--screen-primary)] shrink-0" />
                      )}
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {isWater ? 'Water Break' : 'Look Outside'}
                      </span>
                    </div>
                  </div>

                  <span className="flex items-center gap-1 text-[var(--success-primary)] font-medium text-[11px] shrink-0 ml-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        {historyData.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-muted)]">
              Page {historyData.page} of {historyData.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= historyData.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(historyData.totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dedicated Viewport-Level Full Daily Report Modal */}
      <DailyReportModal
        isOpen={isDailyReportOpen}
        onClose={() => setIsDailyReportOpen(false)}
        reports={stats?.allDailyReports}
        formatDateLabel={formatDateLabel}
        triggerRef={viewFullReportButtonRef}
      />
    </div>
  );
};
