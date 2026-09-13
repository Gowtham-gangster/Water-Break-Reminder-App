export type ReminderStatus = 'completed' | 'skipped' | 'pending' | 'missed';

export type ReminderEventType = 'REAL' | 'PREVIEW';

export interface RealReminderEvent {
  type: 'REAL';
  category: 'water' | 'screen' | 'both';
  slotId: string;
  waterSlotId?: string;
  screenSlotId?: string;
  durationSeconds: number;
  waterDurationSeconds?: number;
  screenDurationSeconds?: number;
  startTimestamp?: number;
  endTimestamp: number;
  waterEndTimestamp?: number;
  screenEndTimestamp?: number;
}

export interface PreviewReminderEvent {
  type: 'PREVIEW';
  category: 'water' | 'screen' | 'both';
  durationSeconds: number;
  waterDurationSeconds?: number;
  screenDurationSeconds?: number;
  endTimestamp: number;
  waterEndTimestamp?: number;
  screenEndTimestamp?: number;
}

export interface WaterConfig {
  enabled: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  intervalMinutes: number; // e.g. 30, 45, 60
  durationMinutes: number; // e.g. 1, 2, 3
  sound: string; // 'water' | 'chime' | 'soft' | 'none'
  activeDays?: number[]; // [0,1,2,3,4,5,6] (0=Sun, 1=Mon, ..., 6=Sat)
  quietHoursEnabled: boolean;
  quietStartTime: string;
  quietEndTime: string;
  reminderStyle?: 'notification' | 'popup';
}

export interface ScreenBreakConfig {
  enabled: boolean;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  screenIntervalMinutes: number; // e.g. 20, 25, 30, 45, 60
  breakDurationMinutes: number;  // e.g. 2, 5, 10
  sound: string; // 'bell' | 'gong' | 'soft' | 'none'
  activeDays?: number[]; // [0,1,2,3,4,5,6] (0=Sun, 1=Mon, ..., 6=Sat)
  reminderStyle?: 'fullscreen' | 'notification';
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface GeneralSettings {
  startOnStartup: boolean;
  minimizeToTray: boolean;
  language: string;
  timeFormat: '12h' | '24h';
  theme: ThemeMode;
  timezone: string;
  localOnlyMode: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  waterSound: string;
  lookOutsideSound: string;
  vibrationEnabled: boolean;
  previewMessage: boolean;
}

export interface PauseState {
  userId?: string;
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

// ==========================================
// PAUSEFLOW V2 — USER-SCOPED ENGINE TYPES
// ==========================================
export type UserReminderType = 'water' | 'look_outside';
export type UserOccurrenceStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'missed'
  | 'skipped'
  | 'expired';

export interface UserReminderOccurrence {
  id: string; // Composite unique key: `${userId}:${type}:${scheduledAt}`
  userId: string;
  type: UserReminderType;
  scheduledAt: number; // Absolute epoch timestamp (ms)
  timeString: string; // 'HH:mm'
  durationSeconds: number; // Duration of break
  status: UserOccurrenceStatus;
  startedAt?: number | null;
  completedAt?: number | null;
  remainingSeconds?: number;
}

export interface UserScopedSchedulerInput {
  userId: string;
  timezone?: string;
  waterConfiguration: WaterConfig;
  lookOutsideConfiguration: ScreenBreakConfig;
  pauseState?: PauseState;
  currentTimestamp: number; // Date.now() - Device timestamp is authoritative
  existingEvents?: UserReminderOccurrence[];
}

export interface UserScopedScheduleResult {
  userId: string;
  calculatedAt: number;
  isPaused: boolean;
  waterOccurrences: UserReminderOccurrence[];
  lookOutsideOccurrences: UserReminderOccurrence[];
  activeWaterOccurrence: UserReminderOccurrence | null;
  activeLookOutsideOccurrence: UserReminderOccurrence | null;
  nextWaterOccurrence: UserReminderOccurrence | null;
  nextLookOutsideOccurrence: UserReminderOccurrence | null;
  nextOverallOccurrence: UserReminderOccurrence | null;
}

// ==========================================
// PAUSEFLOW V2 — SUPABASE DATABASE ENTITY TYPES
// ==========================================
export interface ProfileEntity {
  id: string; // auth.users.id
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsEntity {
  id: string;
  user_id: string;
  theme: 'system' | 'light' | 'dark';
  time_format: '12h' | '24h';
  sound_enabled: boolean;
  notifications_enabled: boolean;
  default_water_duration: number; // in seconds
  default_look_outside_duration: number; // in seconds
  created_at: string;
  updated_at: string;
}

export interface WaterConfigEntity {
  id: string;
  user_id: string;
  enabled: boolean;
  interval_minutes: number;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  active_days: number[];
  created_at: string;
  updated_at: string;
}

export interface LookOutsideConfigEntity {
  id: string;
  user_id: string;
  enabled: boolean;
  interval_minutes: number;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  active_days: number[];
  created_at: string;
  updated_at: string;
}

export interface ReminderEventEntity {
  id: string;
  user_id: string;
  type: 'water' | 'look_outside';
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'scheduled' | 'triggered' | 'completed' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface DeviceRegistrationEntity {
  id: string;
  user_id: string;
  device_id: string;
  platform: 'windows' | 'android' | 'web' | 'macos' | 'linux' | 'ios';
  device_name: string | null;
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReminderPauseStateEntity {
  user_id: string;
  paused_until: string | null;
  paused_at: string | null;
  paused_by_device_id?: string | null;
  created_at?: string;
  updated_at: string;
}

