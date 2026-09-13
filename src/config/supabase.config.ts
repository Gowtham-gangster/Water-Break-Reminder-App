// src/config/supabase.config.ts
// EyeFlow V2 — Supabase Environment & Default Configuration Constants

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

const getEnvVar = (key: string, fallback = ''): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || fallback;
  }
  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  if (proc && proc.env) {
    return proc.env[key] || fallback;
  }
  return fallback;
};

const DEFAULT_SUPABASE_URL = 'https://hwrsvdrhqenraeuqfqle.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_n703UIXn1S4fNHaqmC8yKQ_gwmYEry1';

const supabaseUrl =
  getEnvVar('VITE_SUPABASE_URL') ||
  getEnvVar('SUPABASE_URL') ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY') ||
  DEFAULT_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIG: SupabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured:
    Boolean(supabaseUrl) &&
    !supabaseUrl.includes('placeholder') &&
    Boolean(supabaseAnonKey) &&
    !supabaseAnonKey.includes('placeholder'),
};

export const SUPABASE_DEFAULTS = {
  settings: {
    theme: 'system' as const,
    time_format: '12h' as const,
    sound_enabled: true,
    notifications_enabled: true,
    default_water_duration: 120, // 2 minutes in seconds
    default_look_outside_duration: 300, // 5 minutes in seconds
  },
  water: {
    enabled: true,
    interval_minutes: 45,
    start_time: '09:00',
    end_time: '18:00',
    duration_seconds: 120,
    active_days: [0, 1, 2, 3, 4, 5, 6],
  },
  lookOutside: {
    enabled: true,
    interval_minutes: 20,
    start_time: '09:00',
    end_time: '18:00',
    duration_seconds: 300,
    active_days: [0, 1, 2, 3, 4, 5, 6],
  },
};

