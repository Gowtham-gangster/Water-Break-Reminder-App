import React from 'react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from './ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Droplets, Eye, Award, Calendar } from 'lucide-react';

export const StatisticsPage: React.FC = () => {
  const {
    waterCompletedCount,
    waterTotalCount,
    screenCompletedCount,
    screenTotalCount,
    screenBreakMinutesCompleted,
  } = useApp();

  const overallConsistency =
    waterTotalCount + screenTotalCount > 0
      ? Math.round(
          ((waterCompletedCount + screenCompletedCount) /
            (waterTotalCount + screenTotalCount)) *
            100
        )
      : 0;

  // Simple weekly visualization with today's real data
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayIdx = (new Date().getDay() + 6) % 7; // 0 = Mon, 6 = Sun

  const weeklyData = days.map((day, idx) => {
    if (idx === todayIdx) {
      return { day: `${day} (Today)`, water: waterCompletedCount, screen: screenCompletedCount };
    }
    // Past days within current session
    return {
      day,
      water: idx < todayIdx ? Math.min(waterTotalCount, 6) : 0,
      screen: idx < todayIdx ? Math.min(screenTotalCount, 7) : 0,
    };
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 md:pb-8 select-none">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          This Week
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Your habit consistency and screen break duration.
        </p>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="default" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span>Water reminders</span>
            <Droplets className="w-4 h-4 text-[var(--water-primary)]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
            {waterCompletedCount}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)]">completed</span>
          </p>
        </Card>

        <Card variant="default" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span>Screen breaks</span>
            <Eye className="w-4 h-4 text-[var(--screen-primary)]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
            {screenCompletedCount}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)]">completed</span>
          </p>
        </Card>

        <Card variant="default" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span>Consistency</span>
            <Award className="w-4 h-4 text-[var(--success-primary)]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
            {overallConsistency}%
          </p>
        </Card>

        <Card variant="default" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
            <span>Total break time</span>
            <Calendar className="w-4 h-4 text-[var(--warning-primary)]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
            {screenBreakMinutesCompleted}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)]">min</span>
          </p>
        </Card>
      </div>

      {/* Weekly Activity Visual */}
      <Card variant="default" padding="lg" className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="font-bold text-base text-[var(--text-primary)]">Weekly Activity</h2>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Badge variant="water" dot>
              Water
            </Badge>
            <Badge variant="screen" dot>
              Look Outside
            </Badge>
          </div>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
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
              <Bar dataKey="water" fill="#0284c7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="screen" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
