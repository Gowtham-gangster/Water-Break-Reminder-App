// src/components/StatisticsPage.tsx
// EyeFlow V2 — Comprehensive User Statistics, Analytics & Authoritative History Log

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button } from './ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Droplets,
  Eye,
  Award,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { reminderService, type UserStatistics, type UserHistoryResponse } from '../services/reminderService';

type HistoryRange = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom';
type HistoryTypeFilter = 'all' | 'water' | 'look_outside';
type HistoryStatusFilter = 'all' | 'completed' | 'expired' | 'cancelled';

export const StatisticsPage: React.FC = () => {
  const { currentUser, waterConfig, screenBreakConfig, generalSettings, waterCompletedCount, screenCompletedCount } = useApp();

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
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStatsAndHistory = useCallback(async (
    selectedRange: HistoryRange,
    selectedType: HistoryTypeFilter,
    selectedStatus: HistoryStatusFilter,
    pageNum: number,
    start?: string,
    end?: string
  ) => {
    try {
      setLoading(true);
      const userId = currentUser?.id;
      const userTz = generalSettings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const [fetchedStats, fetchedHistory] = await Promise.all([
        reminderService.getStatistics(userId, { waterConfig, screenBreakConfig, timeZone: userTz }),
        reminderService.getHistory(userId, {
          range: selectedRange,
          type: selectedType,
          status: selectedStatus,
          page: pageNum,
          limit: 10,
          startDate: selectedRange === 'custom' ? start : undefined,
          endDate: selectedRange === 'custom' ? end : undefined,
          timeZone: userTz,
        }),
      ]);
      setStats(fetchedStats);
      setHistoryData(fetchedHistory);
    } catch (err) {
      console.error('[StatisticsPage] Failed to load statistics/history:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, waterConfig, screenBreakConfig, generalSettings.timezone]);

  useEffect(() => {
    fetchStatsAndHistory(range, typeFilter, statusFilter, currentPage, customStart, customEnd);
  }, [range, typeFilter, statusFilter, currentPage, fetchStatsAndHistory, waterCompletedCount, screenCompletedCount]);

  const handleRangeChange = (newRange: HistoryRange) => {
    setRange(newRange);
    setCurrentPage(1);
    if (newRange !== 'custom') {
      fetchStatsAndHistory(newRange, typeFilter, statusFilter, 1);
    }
  };

  const handleTypeChange = (newType: HistoryTypeFilter) => {
    setTypeFilter(newType);
    setCurrentPage(1);
    fetchStatsAndHistory(range, newType, statusFilter, 1, customStart, customEnd);
  };

  const handleStatusChange = (newStatus: HistoryStatusFilter) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
    fetchStatsAndHistory(range, typeFilter, newStatus, 1, customStart, customEnd);
  };

  const handleCustomFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchStatsAndHistory('custom', typeFilter, statusFilter, 1, customStart, customEnd);
  };

  const chartData = stats?.monthlyTrends && stats.monthlyTrends.length > 0
    ? stats.monthlyTrends.slice(-14).map((t) => ({
        date: t.date.slice(5), // MM-DD
        water: t.waterCompleted,
        screen: t.screenCompleted,
        missed: t.waterMissed + t.screenMissed,
      }))
    : [];

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
          onClick={() => fetchStatsAndHistory(range, typeFilter, statusFilter, currentPage, customStart, customEnd)}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
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

      {/* Today's Dashboard Progress & Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Live Dashboard Progress */}
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <h2 className="font-bold text-base text-[var(--text-primary)]">Today's Progress</h2>
            <Badge variant="neutral">Live</Badge>
          </div>

          <div className="space-y-4">
            {/* Water Progress */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Water Intake</p>
                  <p className="text-xs text-[var(--text-muted)]">Completed vs Expected</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold font-mono text-[var(--water-primary)]">
                  {stats?.today.waterCompleted ?? 0}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    / {stats?.today.waterScheduled ?? 0}
                  </span>
                </p>
              </div>
            </div>

            {/* Look Outside Progress */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Look Outside</p>
                  <p className="text-xs text-[var(--text-muted)]">Completed vs Expected</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold font-mono text-indigo-400">
                  {stats?.today.screenCompleted ?? 0}{' '}
                  <span className="text-xs font-normal text-[var(--text-muted)]">
                    / {stats?.today.screenScheduled ?? 0}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* All-Time Breakdown */}
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <h2 className="font-bold text-base text-[var(--text-primary)]">All-Time Breakdown</h2>
            <Badge variant="neutral">User Totals</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Water Completed</span>
              <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                {stats?.waterCompleted ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Water Missed/Expired</span>
              <p className="text-2xl font-bold text-rose-400 font-mono mt-1">
                {stats?.waterMissed ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Look Outside Completed</span>
              <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                {stats?.screenCompleted ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Look Outside Missed</span>
              <p className="text-2xl font-bold text-rose-400 font-mono mt-1">
                {stats?.screenMissed ?? 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Trends Visualization */}
      {chartData.length > 0 && (
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border-subtle)] gap-2">
            <h2 className="font-bold text-base text-[var(--text-primary)]">Daily Activity (Last 14 Days)</h2>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <Badge variant="water" dot>Water</Badge>
              <Badge variant="screen" dot>Look Outside</Badge>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-subtle)',
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-elevated)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar name="Water Completed" dataKey="water" fill="#0284c7" radius={[4, 4, 0, 0]} />
                <Bar name="Look Outside Completed" dataKey="screen" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Reminder History Log with Comprehensive Filters & Pagination */}
      <Card variant="default" padding="lg" className="space-y-6">
        <div className="flex flex-col gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-lg text-[var(--text-primary)]">Reminder History</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Showing {historyData.events.length} of {historyData.total} total logged events.
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

            {/* Sub-Filters: Type & Status */}
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

              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value as HistoryStatusFilter)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="expired">Expired/Missed</option>
                <option value="cancelled">Cancelled</option>
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
            <div className="text-center py-12 text-[var(--text-muted)]">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No reminder events recorded for the selected filter.</p>
            </div>
          ) : (
            historyData.events.map((ev) => {
              const isCompleted = ev.status === 'completed';
              const isWater = ev.type === 'water';
              const timestampToFormat = ev.completed_at || ev.scheduled_at || ev.created_at;
              const formattedTime = new Date(timestampToFormat).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={ev.id || `${ev.scheduled_at}-${ev.type}`}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-prominent)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isWater
                          ? 'bg-sky-500/10 text-sky-400'
                          : 'bg-indigo-500/10 text-indigo-400'
                      }`}
                    >
                      {isWater ? <Droplets className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {isWater ? 'Water Break' : 'Look Outside'}
                      </p>
                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <Badge variant="success" className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </Badge>
                    ) : ev.status === 'expired' ? (
                      <Badge variant="danger" className="flex items-center gap-1 text-xs">
                        <XCircle className="w-3 h-3" />
                        Expired
                      </Badge>
                    ) : ev.status === 'cancelled' ? (
                      <Badge variant="neutral" className="flex items-center gap-1 text-xs">
                        Cancelled
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="flex items-center gap-1 text-xs">
                        {ev.status}
                      </Badge>
                    )}
                  </div>
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
    </div>
  );
};
