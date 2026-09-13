// src/services/supabaseClient.ts
// EyeFlow V2 — Supabase Client Instance & Typed Schema

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase.config.ts';
import type {
  ProfileEntity,
  UserSettingsEntity,
  WaterConfigEntity,
  LookOutsideConfigEntity,
  ReminderEventEntity,
  DeviceRegistrationEntity,
} from '../types/index.ts';

export interface DatabaseSchema {
  public: {
    Tables: {
      profiles: {
        Row: ProfileEntity;
        Insert: Partial<ProfileEntity> & { id: string };
        Update: Partial<ProfileEntity>;
      };
      user_settings: {
        Row: UserSettingsEntity;
        Insert: Partial<UserSettingsEntity> & { user_id: string };
        Update: Partial<UserSettingsEntity>;
      };
      water_configurations: {
        Row: WaterConfigEntity;
        Insert: Partial<WaterConfigEntity> & { user_id: string };
        Update: Partial<WaterConfigEntity>;
      };
      look_outside_configurations: {
        Row: LookOutsideConfigEntity;
        Insert: Partial<LookOutsideConfigEntity> & { user_id: string };
        Update: Partial<LookOutsideConfigEntity>;
      };
      reminder_events: {
        Row: ReminderEventEntity;
        Insert: Partial<ReminderEventEntity> & { user_id: string; type: 'water' | 'look_outside'; scheduled_at: string };
        Update: Partial<ReminderEventEntity>;
      };
      device_registrations: {
        Row: DeviceRegistrationEntity;
        Insert: Partial<DeviceRegistrationEntity> & { user_id: string; device_id: string; platform: string };
        Update: Partial<DeviceRegistrationEntity>;
      };
    };
  };
}

let supabaseInstance: SupabaseClient<DatabaseSchema> | null = null;

export const getSupabaseClient = (): SupabaseClient<DatabaseSchema> => {
  if (!supabaseInstance) {
    supabaseInstance = createClient<DatabaseSchema>(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: typeof window !== 'undefined',
          storageKey: 'eyeflow:v2:auth:session',
        },
      }
    );
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();
