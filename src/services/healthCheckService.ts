// src/services/healthCheckService.ts
// PauseFlow V2 — Safe Supabase Connection & Health Diagnostics Service

import { supabase } from './supabaseClient.ts';
import { SUPABASE_CONFIG } from '../config/supabase.config.ts';

export interface SupabaseHealthReport {
  configured: boolean;
  authReachable: boolean;
  databaseReachable: boolean;
  authenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  project: string;
  tables: {
    profiles: boolean;
    user_settings: boolean;
    water_configurations: boolean;
    look_outside_configurations: boolean;
    reminder_events: boolean;
    device_registrations: boolean;
  };
  latencyMs: number;
  error?: string | null;
}

export async function checkSupabaseConnection(): Promise<SupabaseHealthReport> {
  const startTs = Date.now();
  let safeProject = 'unknown';

  try {
    const parsed = new URL(SUPABASE_CONFIG.url);
    safeProject = parsed.hostname;
  } catch (_) {
    safeProject = SUPABASE_CONFIG.url ? 'invalid-url' : 'missing';
  }

  const report: SupabaseHealthReport = {
    configured: Boolean(SUPABASE_CONFIG.isConfigured),
    authReachable: false,
    databaseReachable: false,
    authenticated: false,
    userId: null,
    userEmail: null,
    project: safeProject,
    tables: {
      profiles: false,
      user_settings: false,
      water_configurations: false,
      look_outside_configurations: false,
      reminder_events: false,
      device_registrations: false,
    },
    latencyMs: 0,
    error: null,
  };

  if (!SUPABASE_CONFIG.isConfigured) {
    report.error = 'Supabase URL or public anon key is missing or not configured.';
    report.latencyMs = Date.now() - startTs;
    return report;
  }

  try {
    // 1. Test Auth Reachability & Active Session
    const sessionRes = await supabase.auth.getSession();
    report.authReachable = !sessionRes.error;

    if (sessionRes.data?.session?.user) {
      report.authenticated = true;
      report.userId = sessionRes.data.session.user.id;
      report.userEmail = sessionRes.data.session.user.email || null;
    } else {
      const userRes = await supabase.auth.getUser();
      if (userRes.data?.user) {
        report.authenticated = true;
        report.userId = userRes.data.user.id;
        report.userEmail = userRes.data.user.email || null;
      }
    }

    // 2. Test Database Reachability across all required schema tables
    const [profRes, setRes, waterRes, screenRes, eventRes, devRes] = await Promise.all([
      supabase.from('profiles').select('id').limit(1),
      supabase.from('user_settings').select('id').limit(1),
      supabase.from('water_configurations').select('id').limit(1),
      supabase.from('look_outside_configurations').select('id').limit(1),
      supabase.from('reminder_events').select('id').limit(1),
      supabase.from('device_registrations').select('id').limit(1),
    ]);

    report.tables.profiles = !profRes.error;
    report.tables.user_settings = !setRes.error;
    report.tables.water_configurations = !waterRes.error;
    report.tables.look_outside_configurations = !screenRes.error;
    report.tables.reminder_events = !eventRes.error;
    report.tables.device_registrations = !devRes.error;

    // Database is reachable if at least one core table responded without fatal network error
    report.databaseReachable =
      !profRes.error ||
      !setRes.error ||
      !waterRes.error ||
      !screenRes.error ||
      !eventRes.error ||
      !devRes.error;

    report.latencyMs = Date.now() - startTs;
    return report;
  } catch (err: any) {
    report.latencyMs = Date.now() - startTs;
    report.error = err?.message || 'Unexpected connection failure during health check.';
    return report;
  }
}
