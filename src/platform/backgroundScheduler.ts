// Platform Background Scheduler (Windows Desktop Electron, Android AlarmManager, Web)
import type { IBackgroundSchedulerService, ScheduledNotification } from './types';
import { detectPlatform } from './systemLifecycle';
import { androidScheduler } from './androidScheduler';

class WindowsBackgroundScheduler implements IBackgroundSchedulerService {
  async scheduleLocalNotifications(): Promise<void> {
    // Windows Electron background daemon manages native setTimeout / scheduler loops natively
  }

  async cancelAllNotifications(): Promise<void> {
    // Managed via pause/resume IPC
  }

  async pause(minutes: number | 'tomorrow'): Promise<void> {
    if ((window as any).eyeflowNative?.pauseReminders) {
      await (window as any).eyeflowNative.pauseReminders(typeof minutes === 'number' ? minutes : 1440);
    }
  }

  async resume(): Promise<void> {
    if ((window as any).eyeflowNative?.resumeReminders) {
      await (window as any).eyeflowNative.resumeReminders();
    }
  }
}

class AndroidBackgroundScheduler implements IBackgroundSchedulerService {
  async scheduleLocalNotifications(notifications: ScheduledNotification[]): Promise<void> {
    await androidScheduler.scheduleAllReminders(notifications);
  }

  async cancelAllNotifications(): Promise<void> {
    await androidScheduler.cancelAllReminders();
  }

  async pause(): Promise<void> {
    await this.cancelAllNotifications();
  }

  async resume(): Promise<void> {
    // Handled by recalculating and re-scheduling upcoming slots
  }
}

class WebBackgroundScheduler implements IBackgroundSchedulerService {
  async scheduleLocalNotifications(): Promise<void> {
    // Web uses runtime reminderEngine in active tab
  }

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
