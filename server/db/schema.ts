// EyeFlow V2 Relational Database Entity Types

export interface UserEntity {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsEntity {
  id: string;
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  time_format: '12h' | '24h';
  timezone: string;
  sound_enabled: boolean;
  notifications_enabled: boolean;
  water_sound: string;
  look_outside_sound: string;
  water_default_duration: number; // in minutes
  look_outside_default_duration: number; // in minutes
  pause_until: string | null;
  pause_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface WaterConfigurationEntity {
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

export interface LookOutsideConfigurationEntity {
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
  type: 'water' | 'screen' | 'both';
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'pending' | 'started' | 'completed' | 'skipped' | 'missed';
  created_at: string;
  updated_at: string;
}

export interface DeviceRegistrationEntity {
  id: string;
  user_id: string;
  device_id: string;
  platform: 'windows' | 'android' | 'web';
  device_name: string;
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

export interface PasswordResetEntity {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface EmailVerificationEntity {
  id: string;
  email: string;
  code: string;
  verified: boolean;
  expires_at: string;
  created_at: string;
}

export interface DatabaseTables {
  users: UserEntity[];
  user_settings: UserSettingsEntity[];
  water_configurations: WaterConfigurationEntity[];
  look_outside_configurations: LookOutsideConfigurationEntity[];
  reminder_events: ReminderEventEntity[];
  device_registrations: DeviceRegistrationEntity[];
  password_resets: PasswordResetEntity[];
  email_verifications: EmailVerificationEntity[];
}
