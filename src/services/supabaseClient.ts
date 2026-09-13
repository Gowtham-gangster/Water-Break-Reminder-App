// src/services/supabaseClient.ts
// PauseFlow V2 — Supabase Client Instance & Typed Schema

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
      reminder_pause_state: {
        Row: {
          user_id: string;
          paused_until: string | null;
          paused_at: string | null;
          paused_by_device_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          paused_until?: string | null;
          paused_at?: string | null;
          paused_by_device_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          paused_until?: string | null;
          paused_at?: string | null;
          paused_by_device_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Fallback-safe auth storage wrapper to ensure existing sessions migrate seamlessly
const authStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    let item = window.localStorage.getItem(key);
    if (!item && key.startsWith('pauseflow:')) {
      const legacyKey = key.replace('pauseflow:', 'eyeflow:');
      const legacyItem = window.localStorage.getItem(legacyKey);
      if (legacyItem) {
        item = legacyItem;
        try {
          window.localStorage.setItem(key, legacyItem);
        } catch (_) {}
      }
    }
    return item;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      if (key.startsWith('pauseflow:')) {
        window.localStorage.removeItem(key.replace('pauseflow:', 'eyeflow:'));
      }
    }
  },
};

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
          storageKey: 'pauseflow:v2:auth:session',
          storage: authStorage,
        },
      }
    );
  }
  return supabaseInstance;
};

export const supabase = getSupabaseClient();
