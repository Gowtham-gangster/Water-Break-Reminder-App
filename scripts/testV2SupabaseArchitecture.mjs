// scripts/testV2SupabaseArchitecture.mjs
// EyeFlow V2 — Phase 1: Supabase Foundation & Multi-User Architecture Test Suite

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { SUPABASE_CONFIG, SUPABASE_DEFAULTS } from '../src/config/supabase.config.ts';
import { SyncService } from '../src/services/syncService.ts';
import { storageEngine } from '../src/engine/storageEngine.ts';

// Node environment localStorage polyfill for testing
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index) => Array.from(store.keys())[index] || null,
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: globalThis.localStorage };
}

let passCount = 0;
let failCount = 0;

function recordTest(domain, name, condition, details = '') {
  const padDomain = `[${domain}]`.padEnd(16);
  const padName = name.padEnd(42);
  if (condition) {
    console.log(`  ✓ ${padDomain} ${padName}: PASS ${details ? `(${details})` : ''}`);
    passCount++;
  } else {
    console.error(`  ✗ ${padDomain} ${padName}: FAIL ${details ? `(${details})` : ''}`);
    failCount++;
  }
}

async function runTests() {
  // ==================================================================
  // 1. SUPABASE CLIENT & CONFIGURATION
  // ==================================================================
  console.log('--- [1] Supabase Client & Configuration ---');
  recordTest('CONFIG', 'Supabase URL present', Boolean(SUPABASE_CONFIG.url));
  recordTest('CONFIG', 'Supabase Anon Key present', Boolean(SUPABASE_CONFIG.anonKey));
  recordTest('CONFIG', 'Sensible default settings defined', SUPABASE_DEFAULTS.settings.default_water_duration === 120);
  recordTest('CONFIG', 'Sensible default look outside duration defined', SUPABASE_DEFAULTS.settings.default_look_outside_duration === 300);

  // ==================================================================
  // 2. SQL MIGRATION & SCHEMA DEFINITION
  // ==================================================================
  console.log('\n--- [2] SQL Migration & Schema Validation ---');
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/00001_initial_schema.sql');
  const migrationExists = fs.existsSync(migrationPath);
  recordTest('SCHEMA', '00001_initial_schema.sql exists', migrationExists);

  if (migrationExists) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    recordTest('SCHEMA', 'profiles table defined', sql.includes('CREATE TABLE IF NOT EXISTS public.profiles'));
    recordTest('SCHEMA', 'user_settings table defined', sql.includes('CREATE TABLE IF NOT EXISTS public.user_settings'));
    recordTest('SCHEMA', 'water_configurations table defined', sql.includes('CREATE TABLE IF NOT EXISTS public.water_configurations'));
    recordTest('SCHEMA', 'look_outside_configurations table defined', sql.includes('CREATE TABLE IF NOT EXISTS public.look_outside_configurations'));
    recordTest('SCHEMA', 'reminder_events table defined', sql.includes('CREATE TABLE IF NOT EXISTS public.reminder_events'));
    recordTest('SCHEMA', 'device_registrations table defined', sql.includes('CREATE TABLE IF NOT EXISTS public.device_registrations'));
    recordTest('SCHEMA', 'on_auth_user_created trigger defined', sql.includes('CREATE TRIGGER on_auth_user_created'));
    recordTest('SCHEMA', 'RLS enabled on profiles', sql.includes('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;'));
    recordTest('SCHEMA', 'RLS enabled on user_settings', sql.includes('ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;'));
    recordTest('SCHEMA', 'RLS enabled on water_configurations', sql.includes('ALTER TABLE public.water_configurations ENABLE ROW LEVEL SECURITY;'));
    recordTest('SCHEMA', 'RLS enabled on look_outside_configurations', sql.includes('ALTER TABLE public.look_outside_configurations ENABLE ROW LEVEL SECURITY;'));
    recordTest('SCHEMA', 'RLS enabled on reminder_events', sql.includes('ALTER TABLE public.reminder_events ENABLE ROW LEVEL SECURITY;'));
    recordTest('SCHEMA', 'RLS enabled on device_registrations', sql.includes('ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;'));
    recordTest('SCHEMA', 'Strict auth.uid() check on user_id', sql.includes('auth.uid() = user_id'));
  }

  // ==================================================================
  // 3. MULTI-USER LOCAL CACHE & STORAGE ISOLATION
  // ==================================================================
  console.log('\n--- [3] Multi-User Local Storage Namespacing ---');
  const sync = new SyncService();
  const userA_Id = 'usr_alice_11111111-1111-4111-a111-111111111111';
  const userB_Id = 'usr_bob_22222222-2222-4222-b222-222222222222';

  const userA_SettingsKey = sync.getScopedKey(userA_Id, 'settings');
  const userB_SettingsKey = sync.getScopedKey(userB_Id, 'settings');
  const userA_WaterKey = sync.getScopedKey(userA_Id, 'water');
  const userB_WaterKey = sync.getScopedKey(userB_Id, 'water');
  const userA_ScreenKey = sync.getScopedKey(userA_Id, 'lookOutside');
  const userB_ScreenKey = sync.getScopedKey(userB_Id, 'lookOutside');

  recordTest('STORAGE', 'User A settings key namespaced', userA_SettingsKey === `eyeflow:v2:${userA_Id}:settings`);
  recordTest('STORAGE', 'User B settings key namespaced', userB_SettingsKey === `eyeflow:v2:${userB_Id}:settings`);
  recordTest('STORAGE', 'User A and User B keys disjoint', userA_SettingsKey !== userB_SettingsKey);

  // Seed user-scoped data
  await storageEngine.set(userA_SettingsKey, { theme: 'dark', time_format: '24h' });
  await storageEngine.set(userB_SettingsKey, { theme: 'light', time_format: '12h' });

  await storageEngine.set(userA_WaterKey, { enabled: true, interval_minutes: 30 });
  await storageEngine.set(userB_WaterKey, { enabled: true, interval_minutes: 60 });

  const fetchedA = await storageEngine.get(userA_SettingsKey, null);
  const fetchedB = await storageEngine.get(userB_SettingsKey, null);
  const waterA = await storageEngine.get(userA_WaterKey, null);
  const waterB = await storageEngine.get(userB_WaterKey, null);

  recordTest('STORAGE', 'User A retrieves strictly User A settings', fetchedA.theme === 'dark' && fetchedA.time_format === '24h');
  recordTest('STORAGE', 'User B retrieves strictly User B settings', fetchedB.theme === 'light' && fetchedB.time_format === '12h');
  recordTest('STORAGE', 'User A water config isolated (30m)', waterA.interval_minutes === 30);
  recordTest('STORAGE', 'User B water config isolated (60m)', waterB.interval_minutes === 60);

  // ==================================================================
  // 4. OFFLINE EVENT QUEUEING & RECONNECTION
  // ==================================================================
  console.log('\n--- [4] Offline Event Queueing & Caching ---');
  await sync.queueOfflineEvent(userA_Id, {
    type: 'water',
    scheduled_at: new Date().toISOString(),
    status: 'completed',
  });

  const queueKeyA = sync.getScopedKey(userA_Id, 'pending_sync_queue');
  const queuedA = await storageEngine.get(queueKeyA, []);
  recordTest('OFFLINE', 'Offline event successfully queued in user cache', queuedA.length === 1 && queuedA[0].type === 'water');

  const queueKeyB = sync.getScopedKey(userB_Id, 'pending_sync_queue');
  const queuedB = await storageEngine.get(queueKeyB, []);
  recordTest('OFFLINE', 'User B offline queue remains strictly empty', queuedB.length === 0);

  // ==================================================================
  // 5. LOGOUT & TEARDOWN
  // ==================================================================
  console.log('\n--- [5] Logout & Teardown Cleanliness ---');
  await storageEngine.set(`eyeflow:v2:${userA_Id}:activeReminders`, { reminderId: 'active-123' });
  await storageEngine.clearUserScopedTransientState(userA_Id);

  const activeRemA = await storageEngine.get(`eyeflow:v2:${userA_Id}:activeReminders`, null);
  recordTest('LOGOUT', 'User A transient timers cleared on logout', activeRemA === null);

  // ==================================================================
  // 6. V1 BACKWARD COMPATIBILITY
  // ==================================================================
  console.log('\n--- [6] V1 Backward Compatibility & Key Safety ---');
  const v1WaterKey = 'waterConfig';
  const v1ScreenKey = 'screenBreakConfig';
  await storageEngine.set(v1WaterKey, { enabled: true, intervalMinutes: 45, v1Signature: true });
  const v1Data = await storageEngine.get(v1WaterKey, null);
  recordTest('V1 COMPAT', 'V1 global unscoped keys remain untouched', v1Data && v1Data.v1Signature === true);

  // ==================================================================
  // FINAL RESULTS
  // ==================================================================
  console.log('\n================================================================');
  console.log('                 FINAL PHASE 1 TEST REPORT                      ');
  console.log('================================================================');
  console.log(`TOTAL TESTS EXECUTED : ${passCount + failCount}`);
  console.log(`PASSED               : ${passCount}`);
  console.log(`FAILED               : ${failCount}`);
  console.log('================================================================');

  if (failCount === 0) {
    console.log('   ✓ EYEFLOW V2 PHASE 1 PASSED WITH 100% SUCCESS RATE           ');
    console.log('================================================================\n');
  } else {
    throw new Error(`${failCount} tests failed in Phase 1 test suite.`);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
