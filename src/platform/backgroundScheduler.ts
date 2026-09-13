// Platform Background Scheduler (Windows Desktop Electron, Android AlarmManager, Web)
import type { IBackgroundSchedulerService, ScheduledNotification } from './types';
import { detectPlatform } from './systemLifecycle';
import { androidScheduler } from './androidScheduler';

class WindowsBackgroundScheduler implements IBackgroundSchedulerService {
  private getNative() {
    return (window as any).pauseflowNative || (window as any).eyeflowNative;
  }

  async scheduleLocalNotifications(): Promise<void> {
    // Windows Electron background daemon manages native setTimeout / scheduler loops natively
  }

  async syncUserSchedule(userId: string, notifications: ScheduledNotification[]): Promise<void> {
    const native = this.getNative();
    if (native?.syncUserSchedule) {
      await native.syncUserSchedule(userId, notifications);
    }
  }

  async cancelUserSchedule(userId: string): Promise<void> {
    const native = this.getNative();
    if (native?.cancelUserSchedule) {
      await native.cancelUserSchedule(userId);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    const native = this.getNative();
    if (native?.cancelAllReminders) {
      await native.cancelAllReminders();
    }
  }

  async pause(minutes: number | 'tomorrow'): Promise<void> {
    const native = this.getNative();
    if (native?.pauseReminders) {
      await native.pauseReminders(typeof minutes === 'number' ? minutes : 1440);
    }
  }

  async resume(): Promise<void> {
    const native = this.getNative();
    if (native?.resumeReminders) {
      await native.resumeReminders();
    }
  }
}

class AndroidBackgroundScheduler implements IBackgroundSchedulerService {
  async scheduleLocalNotifications(notifications: ScheduledNotification[]): Promise<void> {
    await androidScheduler.scheduleAllReminders(notifications);
  }

  async syncUserSchedule(_userId: string, notifications: ScheduledNotification[]): Promise<void> {
    await androidScheduler.scheduleAllReminders(notifications);
  }

  async cancelUserSchedule(_userId: string): Promise<void> {
    await androidScheduler.cancelAllReminders();
  }

  async cancelAllNotifications(): Promise<void> {
    await androidScheduler.cancelAllReminders();
  }

  async pause(_minutes?: number | 'tomorrow'): Promise<void> {
    await androidScheduler.pause();
  }

  async resume(): Promise<void> {
    await androidScheduler.resume();
  }
}

class WebBackgroundScheduler implements IBackgroundSchedulerService {
  async scheduleLocalNotifications(): Promise<void> {
    // Web uses runtime reminderEngine in active tab
  }

  async syncUserSchedule(): Promise<void> {}

  async cancelUserSchedule(): Promise<void> {}

  async cancelAllNotifications(): Promise<void> {}

  async pause(): Promise<void> {}

  async resume(): Promise<void> {}
}

export function createBackgroundScheduler(): IBackgroundSchedulerService {
  const platform = detectPlatform();
  if (platform === 'windows') {
    return new WindowsBackgroundScheduler();
  }
  if (platform === 'android') {
    return new AndroidBackgroundScheduler();
  }
  return new WebBackgroundScheduler();
}

export const backgroundScheduler = createBackgroundScheduler();
