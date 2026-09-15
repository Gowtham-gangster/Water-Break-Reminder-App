import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { ScheduledNotification } from './types';
import { reminderService, isDateOnOrAfterAccountCreation } from '../services/reminderService';

// Native PauseFlow Android Plugin Interface
export interface PauseFlowNativePluginInterface {
  scheduleExactReminderAlarms(options: {
    userId: string;
    alarms: Array<{
      eventId: string;
      category: string;
      userId: string;
      title: string;
      body: string;
      scheduledTimestamp: number;
      durationSeconds: number;
    }>;
  }): Promise<{ scheduledCount: number; canScheduleExactAlarms?: boolean }>;
  cancelExactReminderAlarms(options?: { userId?: string }): Promise<void>;
  checkExactAlarmPermission(): Promise<{
    canScheduleExactAlarms: boolean;
    isExactAlarmSupported: boolean;
    sdkInt?: number;
    error?: string;
  }>;
  openExactAlarmSettings(): Promise<void>;
  checkBatteryOptimization(): Promise<{
    isIgnoringBatteryOptimizations: boolean;
    error?: string;
  }>;
  openBatteryOptimizationSettings(): Promise<void>;
  recordDeliveredReminder(options: {
    eventId: string;
    category: string;
    userId: string;
    timestamp?: number;
    scheduledTimestamp?: number;
  }): Promise<void>;
  getDeliveredReminders(options?: { userId?: string }): Promise<{
    deliveredReminders: Array<{
      eventId: string;
      category: string;
      userId: string;
      timestamp: number;
      scheduledTimestamp?: number;
      date?: string;
      time?: string;
      scheduledAt?: string;
      deliveredAt?: string;
      status?: string;
    }>;
    error?: string;
  }>;
  clearDeliveredReminders(options?: { userId?: string }): Promise<void>;
  getNativeDiagnostics(): Promise<{
    platform: string;
    sdkInt: number;
    manufacturer: string;
    model: string;
    packageName: string;
    canScheduleExactAlarms: boolean;
    isIgnoringBatteryOptimizations: boolean;
  }>;
  addListener(
    eventName: 'reminderDelivered',
    listenerFunc: (data: {
      eventId: string;
      category: string;
      userId: string;
      timestamp: number;
      scheduledTimestamp: number;
      durationSeconds: number;
    }) => void
  ): Promise<PluginListenerHandle>;
}

export const PauseFlowNative = registerPlugin<PauseFlowNativePluginInterface>('PauseFlowNative');

export interface AndroidSchedulerDiagnostics {
  platform: string;
  sdkInt: number;
  manufacturer: string;
  model: string;
  notificationPermission: 'granted' | 'denied' | 'prompt';
  canScheduleExactAlarms: boolean;
  isIgnoringBatteryOptimizations: boolean;
  pendingCount: number;
  pendingList: Array<{ id: number; title: string; at: string }>;
  lastSchedulingResult: string;
  lastSchedulingError: string | null;
  lastScheduledAt: number | null;
}

class AndroidSchedulerService {
  private channelsCreated = false;
  private lastSchedulingResult = 'Initialized';
  private lastSchedulingError: string | null = null;
  private lastScheduledAt: number | null = null;

  private hashStringToInt(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 1000000);
  }

  private getScheduledRemindersKey(userId: string): string {
    return `pauseflow:android:scheduled_reminders:${userId || 'default'}`;
  }

  async initChannels(): Promise<boolean> {
    if (this.channelsCreated) return true;
    try {
      await LocalNotifications.createChannel({
        id: 'pauseflow_water_channel',
        name: '💧 Water Reminders',
        description: 'Notifications reminding you to hydrate and take a water break',
        importance: 5, // High / Heads-up notification
        visibility: 1, // Public on lock screen
        vibration: true,
        lights: true,
      });

      await LocalNotifications.createChannel({
        id: 'pauseflow_screen_channel',
        name: '👁 Look Outside Screen Breaks',
        description: 'Notifications reminding you to rest your eyes from digital screens',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
      });

      await LocalNotifications.createChannel({
        id: 'pauseflow_summary_channel',
        name: '📊 Daily Summary Notifications',
        description: 'Daily progress and completed reminders summary',
        importance: 4,
        visibility: 1,
        vibration: true,
        lights: true,
      });

      this.channelsCreated = true;
      console.log('[AndroidScheduler] Notification channels initialized successfully');
      return true;
    } catch (e: any) {
      this.lastSchedulingError = `Channel creation error: ${e?.message || e}`;
      console.error('[AndroidScheduler] Channel creation failed:', e);
      return false;
    }
  }

  async checkNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return 'granted';
      if (status.display === 'denied') return 'denied';
      return 'prompt';
    } catch (e) {
      console.warn('[AndroidScheduler] checkNotificationPermission error:', e);
      return 'prompt';
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    await this.initChannels();
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (e) {
      console.error('[AndroidScheduler] requestNotificationPermission error:', e);
      return false;
    }
  }

  async checkExactAlarmPermission(): Promise<boolean> {
    try {
      const res = await PauseFlowNative.checkExactAlarmPermission();
      return res?.canScheduleExactAlarms ?? true;
    } catch (e) {
      console.warn('[AndroidScheduler] checkExactAlarmPermission fallback:', e);
      return true;
    }
  }

  async openExactAlarmSettings(): Promise<void> {
    try {
      await PauseFlowNative.openExactAlarmSettings();
    } catch (e) {
      console.error('[AndroidScheduler] openExactAlarmSettings error:', e);
    }
  }

  async checkBatteryOptimization(): Promise<boolean> {
    try {
      const res = await PauseFlowNative.checkBatteryOptimization();
      return res?.isIgnoringBatteryOptimizations ?? true;
    } catch (e) {
      console.warn('[AndroidScheduler] checkBatteryOptimization error:', e);
      return true;
    }
  }

  async openBatteryOptimizationSettings(): Promise<void> {
    try {
      await PauseFlowNative.openBatteryOptimizationSettings();
    } catch (e) {
      console.error('[AndroidScheduler] openBatteryOptimizationSettings error:', e);
    }
  }

  async cancelAllReminders(userId?: string): Promise<void> {
    try {
      // 1. Cancel Native Exact Alarms
      await PauseFlowNative.cancelExactReminderAlarms({ userId });

      // 2. Cancel Capacitor Local Notifications
      const pending = await LocalNotifications.getPending();
      if (pending?.notifications?.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((p) => ({ id: p.id })),
        });
      }
    } catch (e: any) {
      this.lastSchedulingError = `Cancel error: ${e?.message || e}`;
      console.error('[AndroidScheduler] cancelAllReminders error:', e);
    }
  }

  async pause(userId?: string): Promise<void> {
    console.log(`[AndroidScheduler] Pausing reminders for user ${userId || 'anonymous'}...`);
    await this.cancelAllReminders(userId);
    if (typeof localStorage !== 'undefined' && userId) {
      try {
        localStorage.removeItem(this.getScheduledRemindersKey(userId));
      } catch (_) {}
    }
  }

  async resume(userId?: string): Promise<void> {
    console.log(`[AndroidScheduler] Resuming reminders for user ${userId || 'anonymous'}...`);
  }

  private lastScheduledFingerprint = '';

  async scheduleAllReminders(notifications: ScheduledNotification[], force = false): Promise<{
    scheduledCount: number;
    error: string | null;
  }> {
    await this.initChannels();

    try {
      const now = Date.now();
      const futureNotifications = notifications.filter((n) => n.scheduledTimestamp > now + 500);
      const userId = notifications[0]?.userId;

      // CRITICAL AUTHENTICATION CHECK
      if (!userId || userId === 'default_user' || userId === 'local_user') {
        console.warn('[PauseFlow][SECURITY] stage=ANONYMOUS_SCHEDULER_BLOCKED reason=empty_or_anonymous_user');
        await this.cancelAllReminders();
        this.lastScheduledFingerprint = '';
        this.lastSchedulingResult = 'Blocked anonymous scheduler';
        return { scheduledCount: 0, error: 'Cannot schedule reminders for unauthenticated user' };
      }

      const fingerprint = `${userId}|` + futureNotifications.map((n) => `${n.id}:${n.scheduledTimestamp}`).join('|');
      if (!force && fingerprint === this.lastScheduledFingerprint && futureNotifications.length > 0) {
        // Alarms are already accurately scheduled in AlarmManager; do not cancel and reschedule
        return { scheduledCount: futureNotifications.length, error: null };
      }

      await this.cancelAllReminders(userId);

      if (futureNotifications.length === 0) {
        this.lastScheduledFingerprint = '';
        this.lastSchedulingResult = 'No future notifications to schedule';
        return { scheduledCount: 0, error: null };
      }

      console.log(`[PauseFlow][Schedule] Scheduling ${futureNotifications.length} rolling future alarms for user ${userId}`);

      for (const n of futureNotifications.slice(0, 10)) {
        console.log(`[PauseFlow][TRACE] stage=SCHEDULE_START eventId=${n.id} userId=${userId} scheduledLocal=${new Date(n.scheduledTimestamp).toLocaleTimeString()} scheduledEpoch=${n.scheduledTimestamp} currentEpoch=${now} timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
      }

      // 1. Schedule Native Exact Alarms targeting PauseFlowNotificationReceiver
      // Guarantees execution in background, screen-locked, foreground, and app-process-killed states
      const nativeAlarms = futureNotifications.map((n) => {
        const isSummary = n.category === 'daily_summary';
        const isWater = n.category === 'water';
        return {
          eventId: n.id,
          category: n.category,
          userId: n.userId || userId,
          title: isSummary ? "Today's Progress" : isWater ? '💧 Time for water' : '👁 Look outside',
          body: isSummary
            ? "Today's Progress"
            : isWater
            ? 'Take a short break and drink some water.'
            : 'Give your eyes a short break from the screen.',
          scheduledTimestamp: n.scheduledTimestamp,
          durationSeconds: isSummary ? 0 : n.durationSeconds || (isWater ? 120 : 300),
        };
      });

      const nativeRes = await PauseFlowNative.scheduleExactReminderAlarms({ userId, alarms: nativeAlarms });
      this.lastScheduledFingerprint = fingerprint;

      // 2. Persist scheduled notification inventory for UI display and reconciliation
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(
            this.getScheduledRemindersKey(userId),
            JSON.stringify(
              futureNotifications.map((n) => ({
                id: n.id,
                category: n.category,
                scheduledTimestamp: n.scheduledTimestamp,
                userId: n.userId,
              }))
            )
          );
        } catch (_) {}
      }

      this.lastScheduledAt = Date.now();
      this.lastSchedulingResult = `Scheduled ${nativeRes.scheduledCount} native exact alarms at ${new Date().toLocaleTimeString()}`;
      this.lastSchedulingError = null;

      console.log(`[PauseFlow][Alarm] scheduled count=${nativeRes.scheduledCount} for user=${userId}`);

      return { scheduledCount: nativeRes.scheduledCount, error: null };
    } catch (e: any) {
      const errMsg = `Schedule failure: ${e?.message || e}`;
      this.lastSchedulingError = errMsg;
      this.lastSchedulingResult = 'Scheduling failed';
      console.error('[PauseFlow][Schedule]', errMsg, e);
      return { scheduledCount: 0, error: errMsg };
    }
  }

  /**
   * Reconcile delivered reminders:
   * Processes verified delivery records written to Android user-scoped SharedPreferences
   * by the native PauseFlowNotificationReceiver BroadcastReceiver when the alarm fired.
   * Runs on app startup, foregrounding, and network restoration.
   */
  async reconcileDeliveredReminders(
    userId: string,
    accountCreatedAt?: string,
    timeZone?: string
  ): Promise<number> {
    if (!userId || userId === 'default_user' || userId === 'local_user') return 0;
    let reconciledCount = 0;
    const now = Date.now();

    try {
      // 1. Process Authoritative Android Native Delivery Records from user-scoped SharedPreferences
      try {
        const nativeRes = await PauseFlowNative.getDeliveredReminders({ userId });
        if (nativeRes?.deliveredReminders && nativeRes.deliveredReminders.length > 0) {
          console.log(`[PauseFlow][TRACE] stage=STARTUP_RECONCILIATION userId=${userId} totalDelivered=${nativeRes.deliveredReminders.length}`);
          for (const item of nativeRes.deliveredReminders) {
            const targetUserId = item.userId || userId;
            const category = item.category === 'screen' ? 'look_outside' : (item.category as any);
            const ts = item.timestamp || now;
            const scheduledTs = item.scheduledTimestamp || ts;
            const itemDate = new Date(ts);
            if (isDateOnOrAfterAccountCreation(itemDate, accountCreatedAt, timeZone)) {
              await reminderService.recordDelivered(
                targetUserId,
                category,
                item.eventId || `native-${ts}`,
                new Date(ts).toISOString(),
                new Date(scheduledTs).toISOString()
              );
              reconciledCount++;
              console.log(`[PauseFlow][TRACE] stage=RECONCILED_EVENT eventId=${item.eventId} category=${category} userId=${targetUserId} status=completed`);
            }
          }
          await PauseFlowNative.clearDeliveredReminders({ userId });
          console.log(`[AndroidScheduler] Reconciled ${reconciledCount} verified native delivery records for user ${userId}`);
        }
      } catch (nativeErr) {
        console.warn('[AndroidScheduler] Error querying native delivered reminders:', nativeErr);
      }

      // 2. Clean up local scheduled inventory for future pending alarms
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.getScheduledRemindersKey(userId));
        if (raw) {
          const list: Array<{
            id: string;
            category: 'water' | 'look_outside' | 'screen';
            scheduledTimestamp: number;
            userId?: string;
          }> = JSON.parse(raw);

          // Keep future pending notifications in local inventory
          const pendingFuture = list.filter((item) => item.scheduledTimestamp > now);
          localStorage.setItem(this.getScheduledRemindersKey(userId), JSON.stringify(pendingFuture));
        }
      }

      // 3. Flush offline queue to Supabase
      if (reconciledCount > 0) {
        await reminderService.flushOfflineEvents(userId);
      }
    } catch (e) {
      console.warn('[AndroidScheduler] Reconcile delivered reminders exception:', e);
    }

    return reconciledCount;
  }

  /**
   * Schedule the Authoritative Daily Summary notification after the configured schedule end time
   */
  async scheduleDailySummaryNotification(options: {
    userId?: string;
    waterConfig?: { enabled?: boolean; endTime?: string; activeDays?: number[] };
    screenBreakConfig?: { enabled?: boolean; endTime?: string; activeDays?: number[] };
    todayWaterCompleted?: number;
    todayWaterExpected?: number;
    todayScreenCompleted?: number;
    todayScreenExpected?: number;
    timeZone?: string;
  }): Promise<{ success: boolean; id?: number; error?: string }> {
    await this.initChannels();

    try {
      const today = new Date();
      const todayDay = today.getDay();

      const waterActive = Boolean(
        options.waterConfig?.enabled &&
        (!options.waterConfig.activeDays || options.waterConfig.activeDays.length === 0 || options.waterConfig.activeDays.includes(todayDay))
      );
      const screenActive = Boolean(
        options.screenBreakConfig?.enabled &&
        (!options.screenBreakConfig.activeDays || options.screenBreakConfig.activeDays.length === 0 || options.screenBreakConfig.activeDays.includes(todayDay))
      );

      if (!waterActive && !screenActive) {
        return { success: false, error: 'No active reminders configured for today' };
      }

      // Determine the latest end time among active reminders
      const [wH, wM] = (options.waterConfig?.endTime || '18:00').split(':').map(Number);
      const [sH, sM] = (options.screenBreakConfig?.endTime || '18:00').split(':').map(Number);

      let targetH = 18;
      let targetM = 0;

      if (waterActive && screenActive) {
        const waterEndM = (isNaN(wH) ? 18 : wH) * 60 + (isNaN(wM) ? 0 : wM);
        const screenEndM = (isNaN(sH) ? 18 : sH) * 60 + (isNaN(sM) ? 0 : sM);
        const maxM = Math.max(waterEndM, screenEndM);
        targetH = Math.floor(maxM / 60);
        targetM = maxM % 60;
      } else if (waterActive) {
        targetH = isNaN(wH) ? 18 : wH;
        targetM = isNaN(wM) ? 0 : wM;
      } else {
        targetH = isNaN(sH) ? 18 : sH;
        targetM = isNaN(sM) ? 0 : sM;
      }

      const summaryDate = new Date();
      summaryDate.setHours(targetH, targetM, 0, 0);

      // Deterministic notification ID per user/date
      const dateStr = `${summaryDate.getFullYear()}-${String(summaryDate.getMonth() + 1).padStart(2, '0')}-${String(summaryDate.getDate()).padStart(2, '0')}`;
      const summaryIntId = this.hashStringToInt(`daily-summary-${options.userId || 'user'}-${dateStr}`);

      // Compose body text with clean totals
      const lines: string[] = [];
      if (waterActive) {
        const completed = options.todayWaterCompleted ?? 0;
        const expected = options.todayWaterExpected ?? 0;
        const missed = Math.max(0, expected - completed);
        lines.push(`💧 Water: ${completed} completed • ${missed} missed`);
      }
      if (screenActive) {
        const completed = options.todayScreenCompleted ?? 0;
        const expected = options.todayScreenExpected ?? 0;
        const missed = Math.max(0, expected - completed);
        lines.push(`👁 Look Outside: ${completed} completed • ${missed} missed`);
      }

      const summaryBody = lines.join('\n');

      await LocalNotifications.schedule({
        notifications: [
          {
            id: summaryIntId,
            title: "Today's Progress",
            body: summaryBody,
            channelId: 'pauseflow_summary_channel',
            smallIcon: 'pauseflow_notification',
            iconColor: '#0284c7',
            schedule: {
              at: summaryDate,
              allowWhileIdle: true,
            },
            extra: {
              type: 'daily_summary',
              date: dateStr,
              userId: options.userId || '',
            },
          },
        ],
      });

      console.log(`[AndroidScheduler] Scheduled daily summary notification for ${summaryDate.toLocaleTimeString()} (ID: ${summaryIntId})`);
      return { success: true, id: summaryIntId };
    } catch (e: any) {
      const errMsg = `Daily summary schedule error: ${e?.message || e}`;
      console.error('[AndroidScheduler]', errMsg);
      return { success: false, error: errMsg };
    }
  }


  async getDiagnostics(): Promise<AndroidSchedulerDiagnostics> {
    let nativeDiag: any = {
      sdkInt: 0,
      manufacturer: 'Unknown',
      model: 'Unknown',
      canScheduleExactAlarms: true,
      isIgnoringBatteryOptimizations: true,
    };

    try {
      nativeDiag = await PauseFlowNative.getNativeDiagnostics();
    } catch (_) {}

    const notifPerm = await this.checkNotificationPermission();

    let pendingCount = 0;
    let pendingList: Array<{ id: number; title: string; at: string }> = [];

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.getScheduledRemindersKey(''));
        if (raw) {
          const list = JSON.parse(raw);
          pendingCount = list.length;
          pendingList = list.slice(0, 10).map((n: any) => ({
            id: this.hashStringToInt(n.id),
            title: n.category === 'water' ? '💧 Time for water' : '👁 Look outside',
            at: new Date(n.scheduledTimestamp).toLocaleTimeString(),
          }));
        }
      } catch (_) {}
    }

    return {
      platform: 'Android',
      sdkInt: nativeDiag.sdkInt || 0,
      manufacturer: nativeDiag.manufacturer || 'Android',
      model: nativeDiag.model || 'Device',
      notificationPermission: notifPerm,
      canScheduleExactAlarms: nativeDiag.canScheduleExactAlarms ?? true,
      isIgnoringBatteryOptimizations: nativeDiag.isIgnoringBatteryOptimizations ?? true,
      pendingCount,
      pendingList,
      lastSchedulingResult: this.lastSchedulingResult,
      lastSchedulingError: this.lastSchedulingError,
      lastScheduledAt: this.lastScheduledAt,
    };
  }
}

export const androidScheduler = new AndroidSchedulerService();
