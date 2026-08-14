export type ReminderStatus = 'completed' | 'skipped' | 'pending' | 'missed';

export type ReminderEventType = 'REAL' | 'PREVIEW';

export interface RealReminderEvent {
  type: 'REAL';
  category: 'water' | 'screen';
  slotId: string;
  durationSeconds: number;
  endTimestamp: number;
}

export interface PreviewReminderEvent {
  type: 'PREVIEW';
  category: 'water' | 'screen';
  durationSeconds: number;
  endTimestamp: number;
}

export interface WaterConfig {
  enabled: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  intervalMinutes: number; // 30, 45, 60, 90, 120
  durationMinutes: number; // 1, 2, 3
  sound: string; // 'water' | 'chime' | 'soft' | 'none'
  quietHoursEnabled: boolean;
  quietStartTime: string;
  quietEndTime: string;
  reminderStyle?: 'notification' | 'popup';
}

export interface ScreenBreakConfig {
  enabled: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  screenIntervalMinutes: number; // 20, 25, 30, 45, 60
  breakDurationMinutes: number;  // 5, 10
  sound: string; // 'bell' | 'gong' | 'soft' | 'none'
  reminderStyle?: 'fullscreen' | 'notification';
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface GeneralSettings {
  startOnStartup: boolean;
  minimizeToTray: boolean;
  language: string;
  timeFormat: '12h' | '24h';
  theme: ThemeMode;
  localOnlyMode: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  previewMessage: boolean;
}

export interface PauseState {
  isPaused: boolean;
  pauseUntil: string | null; // ISO string
  pauseMinutes: number | null;
}

export interface WaterReminderLog {
  id: string;
  time: string; // HH:mm
  scheduledTimestamp: number;
  status: ReminderStatus;
  completedAt?: string;
}

export interface ScreenBreakLog {
  id: string;
  time: string; // HH:mm
  scheduledTimestamp: number;
  durationMinutes: number;
  status: ReminderStatus;
  completedAt?: string;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  waterCompleted: number;
  waterTotal: number;
  screenBreaksCompleted: number;
  screenBreaksTotal: number;
  screenBreakMinutes: number;
}

export interface UserAccount {
  id?: string;
  name?: string;
  email?: string;
  token?: string;
  isLoggedIn: boolean;
  lastSyncedAt?: string;
}
