import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { ScheduledNotification } from './types';

// Native EyeFlow Android Plugin Interface
interface EyeFlowNativePluginInterface {
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
  getNativeDiagnostics(): Promise<{
    platform: string;
    sdkInt: number;
    manufacturer: string;
    model: string;
    packageName: string;
    canScheduleExactAlarms: boolean;
    isIgnoringBatteryOptimizations: boolean;
  }>;
}

const EyeFlowNative = registerPlugin<EyeFlowNativePluginInterface>('EyeFlowNative');

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

  async initChannels(): Promise<boolean> {
    if (this.channelsCreated) return true;
    try {
      await LocalNotifications.createChannel({
        id: 'eyeflow_water_channel',
        name: '💧 Water Reminders',
        description: 'Notifications reminding you to hydrate and take a water break',
        importance: 5, // High / Heads-up notification
        visibility: 1, // Public on lock screen
        vibration: true,
        lights: true,
      });

      await LocalNotifications.createChannel({
        id: 'eyeflow_screen_channel',
        name: '👁 Look Outside Screen Breaks',
        description: 'Notifications reminding you to rest your eyes from digital screens',
        importance: 5,
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
      const res = await EyeFlowNative.checkExactAlarmPermission();
      return res?.canScheduleExactAlarms ?? true;
    } catch (e) {
      console.warn('[AndroidScheduler] checkExactAlarmPermission fallback:', e);
      return true;
    }
  }

  async openExactAlarmSettings(): Promise<void> {
    try {
      await EyeFlowNative.openExactAlarmSettings();
    } catch (e) {
      console.error('[AndroidScheduler] openExactAlarmSettings error:', e);
    }
  }

  async checkBatteryOptimization(): Promise<boolean> {
    try {
      const res = await EyeFlowNative.checkBatteryOptimization();
      return res?.isIgnoringBatteryOptimizations ?? true;
    } catch (e) {
      console.warn('[AndroidScheduler] checkBatteryOptimization error:', e);
      return true;
    }
  }

  async openBatteryOptimizationSettings(): Promise<void> {
    try {
      await EyeFlowNative.openBatteryOptimizationSettings();
    } catch (e) {
      console.error('[AndroidScheduler] openBatteryOptimizationSettings error:', e);
    }
  }

  async cancelAllReminders(): Promise<void> {
    try {
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

  async scheduleAllReminders(notifications: ScheduledNotification[]): Promise<{
    scheduledCount: number;
    error: string | null;
  }> {
    await this.initChannels();

    try {
      await this.cancelAllReminders();

      const now = Date.now();
      const futureNotifications = notifications.filter((n) => n.scheduledTimestamp > now + 2000);

      if (futureNotifications.length === 0) {
        this.lastSchedulingResult = 'No future notifications to schedule';
        return { scheduledCount: 0, error: null };
      }

      const capNotifications = futureNotifications.map((n) => {
        const intId = this.hashStringToInt(n.id);
        const isWater = n.category === 'water';
        return {
          id: intId,
          title: isWater ? '💧 Time for water' : '👁 Look outside',
          body: isWater
            ? 'Take a short break and drink some water.'
            : 'Give your eyes a short break from the screen.',
          channelId: isWater ? 'eyeflow_water_channel' : 'eyeflow_screen_channel',
          schedule: {
            at: new Date(n.scheduledTimestamp),
            allowWhileIdle: true,
          },
          extra: {
            userId: n.userId || '',
            originalId: n.id,
            category: n.category,
            scheduledTimestamp: n.scheduledTimestamp,
            durationSeconds: n.durationSeconds || (isWater ? 120 : 300),
          },
        };
      });

      await LocalNotifications.schedule({ notifications: capNotifications });

      this.lastScheduledAt = Date.now();
      this.lastSchedulingResult = `Scheduled ${capNotifications.length} notifications at ${new Date().toLocaleTimeString()}`;
      this.lastSchedulingError = null;

      return { scheduledCount: capNotifications.length, error: null };
    } catch (e: any) {
      const errMsg = `Schedule failure: ${e?.message || e}`;
      this.lastSchedulingError = errMsg;
      this.lastSchedulingResult = 'Scheduling failed';
      console.error('[AndroidScheduler]', errMsg, e);
      return { scheduledCount: 0, error: errMsg };
    }
  }

  async scheduleTestReminder(
    secondsFromNow: number = 30,
    type: 'water' | 'screen' = 'water'
  ): Promise<{
    success: boolean;
    id: number;
    timestamp: number;
    error?: string;
  }> {
    await this.initChannels();

    try {
      const scheduledTimestamp = Date.now() + secondsFromNow * 1000;
      const testIntId = Math.floor(100000 + Math.random() * 900000);
      const isWater = type === 'water';

      await LocalNotifications.schedule({
        notifications: [
          {
            id: testIntId,
            title: isWater ? '💧 Time for water' : '👁 Look outside',
            body: isWater
              ? 'Take a short break and drink some water.'
              : 'Give your eyes a short break from the screen.',
            channelId: isWater ? 'eyeflow_water_channel' : 'eyeflow_screen_channel',
            schedule: {
              at: new Date(scheduledTimestamp),
              allowWhileIdle: true,
            },
            extra: {
              originalId: `test-${type}-${Date.now()}`,
              category: type,
              scheduledTimestamp,
              durationSeconds: isWater ? 120 : 300,
            },
          },
        ],
      });

      console.log(`[AndroidScheduler] Scheduled test reminder for +${secondsFromNow}s (ID: ${testIntId})`);
      return { success: true, id: testIntId, timestamp: scheduledTimestamp };
    } catch (e: any) {
      const errMsg = `Test schedule error: ${e?.message || e}`;
      console.error('[AndroidScheduler]', errMsg);
      return { success: false, id: 0, timestamp: 0, error: errMsg };
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
      nativeDiag = await EyeFlowNative.getNativeDiagnostics();
    } catch (_) {}

    const notifPerm = await this.checkNotificationPermission();

    let pendingCount = 0;
    let pendingList: Array<{ id: number; title: string; at: string }> = [];

    try {
      const pending = await LocalNotifications.getPending();
      if (pending?.notifications) {
        pendingCount = pending.notifications.length;
        pendingList = pending.notifications.slice(0, 10).map((n) => ({
          id: n.id,
          title: n.title || 'Reminder',
          at: n.schedule?.at ? new Date(n.schedule.at).toLocaleTimeString() : 'Unknown',
        }));
      }
    } catch (_) {}

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
