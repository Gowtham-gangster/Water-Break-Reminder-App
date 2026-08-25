// Platform Architecture Types for EyeFlow (Windows Desktop Electron, Android Capacitor, Web)

export type PlatformType = 'windows' | 'android' | 'web';

export interface PlatformCapabilities {
  platform: PlatformType;
  isDesktop: boolean;
  isMobile: boolean;
  hasNativeScheduler: boolean;
  hasLocalNotifications: boolean;
  hasSystemTray: boolean;
  supportsBackgroundExecution: boolean;
}

export interface NotificationPayload {
  title: string;
  body: string;
  category: 'water' | 'screen';
  slotId?: string;
  sound?: boolean;
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  category: 'water' | 'screen';
  scheduledTimestamp: number;
  durationSeconds: number;
}

export interface INotificationService {
  checkPermission(): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission(): Promise<boolean>;
  sendImmediate(payload: NotificationPayload): Promise<void>;
  playWaterChime(): void;
  playScreenBell(): void;
}

export interface IBackgroundSchedulerService {
  scheduleLocalNotifications(notifications: ScheduledNotification[]): Promise<void>;
  cancelAllNotifications(): Promise<void>;
  pause(minutes: number | 'tomorrow'): Promise<void>;
  resume(): Promise<void>;
}

export interface ISystemLifecycleService {
  getPlatform(): PlatformType;
  getCapabilities(): PlatformCapabilities;
  onForeground(callback: () => void): () => void;
  onBackground(callback: () => void): () => void;
  onPowerResume(callback: () => void): () => void;
  onMidnightRollover(callback: () => void): () => void;
}
