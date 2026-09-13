// src/services/reminderHistoryService.ts
// EyeFlow V2 — Supabase Reminder History & Statistics Service Bridge

import { reminderService, type UserStatistics, type UserHistoryResponse } from './reminderService.ts';
import type { ReminderEventEntity } from '../types/index.ts';

export type UserStatisticsResult = UserStatistics;

export class ReminderHistoryService {
  public async logEvent(
    userId: string,
    event: {
      type: 'water' | 'look_outside' | 'screen';
      scheduled_at: string;
      started_at?: string | null;
      completed_at?: string | null;
      status: 'scheduled' | 'triggered' | 'completed' | 'expired' | 'cancelled';
      slotId?: string | number;
    }
  ): Promise<{ event: ReminderEventEntity | null; error: string | null }> {
    try {
      let saved: ReminderEventEntity;
      if (event.status === 'completed') {
        saved = await reminderService.recordCompleted(userId, event.type, event.slotId || event.scheduled_at, event.scheduled_at, event.completed_at || undefined);
      } else if (event.status === 'triggered') {
        saved = await reminderService.recordTriggered(userId, event.type, event.slotId || event.scheduled_at, event.scheduled_at);
      } else if (event.status === 'expired') {
        saved = await reminderService.recordExpired(userId, event.type, event.slotId || event.scheduled_at);
      } else if (event.status === 'cancelled') {
        saved = await reminderService.recordCancelled(userId, event.type, event.slotId || event.scheduled_at);
      } else {
        saved = await reminderService.recordScheduled(userId, event.type, event.slotId || event.scheduled_at);
      }
      return { event: saved, error: null };
    } catch (err: any) {
      return { event: null, error: err?.message || 'Failed to log event' };
    }
  }

  public async getUserHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
      type?: 'water' | 'look_outside';
      status?: 'completed' | 'expired' | 'cancelled' | 'triggered';
      range?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom';
    } = {}
  ): Promise<{ events: ReminderEventEntity[]; total: number; error: string | null }> {
    try {
      const page = options.offset ? Math.floor(options.offset / (options.limit || 20)) + 1 : 1;
      const res: UserHistoryResponse = await reminderService.getHistory(userId, {
        limit: options.limit || 50,
        page,
        startDate: options.startDate,
        endDate: options.endDate,
        type: options.type ? (options.type as any) : 'all',
        status: options.status ? (options.status as any) : 'all',
        range: options.range,
      });
      return { events: res.events, total: res.total, error: null };
    } catch (err: any) {
      return { events: [], total: 0, error: err?.message || 'Failed to fetch history' };
    }
  }

  public async getUserStatistics(userId: string): Promise<{ stats: UserStatisticsResult; error: string | null }> {
    try {
      const stats = await reminderService.getStatistics(userId);
      return { stats, error: null };
    } catch (err: any) {
      return {
        stats: {
          waterCompleted: 0,
          waterMissed: 0,
          screenCompleted: 0,
          screenMissed: 0,
          dailyCompletionRate: 0,
          weeklyCompletionRate: 0,
          currentStreak: 0,
          bestStreak: 0,
          totalWaterReminders: 0,
          totalScreenBreaks: 0,
          monthlyTrends: [],
          today: {
            waterCompleted: 0,
            waterMissed: 0,
            waterScheduled: 0,
            screenCompleted: 0,
            screenMissed: 0,
            screenScheduled: 0,
          },
        },
        error: err?.message || 'Failed to get statistics',
      };
    }
  }
}

export const reminderHistoryService = new ReminderHistoryService();
