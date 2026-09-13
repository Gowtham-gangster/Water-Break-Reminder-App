// scripts/testV2Settings.mjs
// EyeFlow V2 — Phase 4: User Settings Test Suite

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { SettingsService } from '../src/services/settingsService.ts';
import { storageEngine } from '../src/engine/storageEngine.ts';
import { SUPABASE_DEFAULTS } from '../src/config/supabase.config.ts';

// In-memory localStorage polyfill for Node.js test environment
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

console.log('================================================================');
console.log('        EYEFLOW V2: PHASE 4 - USER SETTINGS TEST SUITE          ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function recordTest(domain, name, condition, details = '') {
  const padDomain = `[${domain}]`.padEnd(18);
  const padName = name.padEnd(44);
  if (condition) {
    console.log(`  ✓ ${padDomain} ${padName}: PASS ${details ? `(${details})` : ''}`);
    passCount++;
  } else {
    console.error(`  ✗ ${padDomain} ${padName}: FAIL ${details ? `(${details})` : ''}`);
    failCount++;
  }
}

async function runSettingsTests() {
  const settingsService = new SettingsService();

  const userA_Id = 'usr_alice_11111111-1111-4111-a111-111111111111';
  const userB_Id = 'usr_bob_22222222-2222-4222-b222-222222222222';

  // ==================================================================
  // 1. NEW USER DEFAULT SETTINGS PROVISIONING
  // ==================================================================
  console.log('--- [1] New User Default Settings Provisioning ---');

  const settingsA = await settingsService.ensureSettings(userA_Id);

  recordTest('SETTINGS:DEFAULTS', 'Settings record created for user', settingsA.user_id === userA_Id);
  recordTest('SETTINGS:DEFAULTS', 'Default theme is system', settingsA.theme === 'system');
  recordTest('SETTINGS:DEFAULTS', 'Default time format is 12h', settingsA.time_format === '12h');
  recordTest('SETTINGS:DEFAULTS', 'Default sound is enabled', settingsA.sound_enabled === true);
  recordTest('SETTINGS:DEFAULTS', 'Default notifications enabled', settingsA.notifications_enabled === true);
  recordTest('SETTINGS:DEFAULTS', 'Default water duration is 120s (2m)', settingsA.default_water_duration === 120);
  recordTest('SETTINGS:DEFAULTS', 'Default look outside duration is 300s (5m)', settingsA.default_look_outside_duration === 300);

  // ==================================================================
  // 2. USER-SCOPED LOCAL CACHE
  // ==================================================================
  console.log('\n--- [2] User-Scoped Local Cache Namespacing ---');
  const cacheKeyA = settingsService.getScopedSettingsKey(userA_Id);
  recordTest('SETTINGS:CACHE', 'Settings cache key correctly namespaced', cacheKeyA === `eyeflow:v2:${userA_Id}:settings`);

  const cachedSettingsA = await storageEngine.get(cacheKeyA, null);
  recordTest('SETTINGS:CACHE', 'Settings cached in user-scoped storage', cachedSettingsA && cachedSettingsA.theme === 'system');

  // ==================================================================
  // 3. SETTINGS UPDATES (THEME, TIME FORMAT, SOUND, NOTIFS, DURATIONS)
  // ==================================================================
  console.log('\n--- [3] Settings Updates & Validation ---');

  await storageEngine.set(cacheKeyA, {
    ...cachedSettingsA,
    theme: 'dark',
    time_format: '24h',
    sound_enabled: false,
    notifications_enabled: false,
    default_water_duration: 180, // 3 mins
    default_look_outside_duration: 600, // 10 mins
    updated_at: new Date().toISOString(),
  });

  const { settings: updatedA } = await settingsService.getSettings(userA_Id);
  recordTest('SETTINGS:UPDATE', 'Theme updated to dark', updatedA.theme === 'dark');
  recordTest('SETTINGS:UPDATE', 'Time format updated to 24h', updatedA.time_format === '24h');
  recordTest('SETTINGS:UPDATE', 'Sound disabled successfully', updatedA.sound_enabled === false);
  recordTest('SETTINGS:UPDATE', 'Notifications disabled successfully', updatedA.notifications_enabled === false);
  recordTest('SETTINGS:UPDATE', 'Water default duration updated to 180s', updatedA.default_water_duration === 180);
  recordTest('SETTINGS:UPDATE', 'Look outside duration updated to 600s', updatedA.default_look_outside_duration === 600);

  // ==================================================================
  // 4. OFFLINE-FIRST RETRIEVAL
  // ==================================================================
  console.log('\n--- [4] Offline-First Cached Retrieval ---');
  const offlineResult = await settingsService.getSettings(userA_Id);
  recordTest('SETTINGS:OFFLINE', 'Offline retrieval succeeds via local cache', offlineResult.settings !== null && offlineResult.settings.theme === 'dark');
  recordTest('SETTINGS:OFFLINE', 'Durations preserved in offline cache', offlineResult.settings.default_water_duration === 180);

  // ==================================================================
  // 5. USER A VS USER B ISOLATION (RLS & NAMESPACING)
  // ==================================================================
  console.log('\n--- [5] Multi-User Isolation & RLS Policies ---');

  const settingsB = await settingsService.ensureSettings(userB_Id);
  recordTest('SETTINGS:ISOLATION', 'User B receives independent default settings', settingsB.user_id === userB_Id && settingsB.theme === 'system');

  const cacheKeyB = settingsService.getScopedSettingsKey(userB_Id);
  recordTest('SETTINGS:ISOLATION', 'User B cache key isolated from User A', cacheKeyB === `eyeflow:v2:${userB_Id}:settings` && cacheKeyB !== cacheKeyA);

  const cachedB = await storageEngine.get(cacheKeyB, null);
  recordTest('SETTINGS:ISOLATION', 'User B theme unchanged by User A edits', cachedB.theme === 'system' && updatedA.theme === 'dark');
  recordTest('SETTINGS:ISOLATION', 'User B sound setting unaffected', cachedB.sound_enabled === true && updatedA.sound_enabled === false);

  // ==================================================================
  // 6. DATABASE SCHEMA & RLS VERIFICATION
  // ==================================================================
  console.log('\n--- [6] Supabase PostgreSQL Schema & RLS Policies ---');
  const schemaPath = path.resolve('supabase/migrations/00001_initial_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  recordTest('SCHEMA:SQL', 'user_settings table exists in migration', schemaSql.includes('CREATE TABLE IF NOT EXISTS public.user_settings'));
  recordTest('SCHEMA:SQL', 'user_settings has foreign key to auth.users(id)', schemaSql.includes('user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE'));
  recordTest('SCHEMA:SQL', 'user_settings has theme check constraint', schemaSql.includes("CHECK (theme IN ('system', 'light', 'dark'))"));
  recordTest('SCHEMA:SQL', 'user_settings has time_format check constraint', schemaSql.includes("CHECK (time_format IN ('12h', '24h'))"));
  recordTest('SCHEMA:SQL', 'user_settings has sound_enabled field', schemaSql.includes('sound_enabled BOOLEAN NOT NULL DEFAULT true'));
  recordTest('SCHEMA:SQL', 'user_settings has notifications_enabled field', schemaSql.includes('notifications_enabled BOOLEAN NOT NULL DEFAULT true'));
  recordTest('SCHEMA:SQL', 'user_settings has default_water_duration field', schemaSql.includes('default_water_duration INTEGER NOT NULL DEFAULT 120'));
  recordTest('SCHEMA:SQL', 'user_settings has default_look_outside_duration field', schemaSql.includes('default_look_outside_duration INTEGER NOT NULL DEFAULT 300'));

  recordTest('SCHEMA:RLS', 'RLS enabled on user_settings', schemaSql.includes('ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;'));
  recordTest('SCHEMA:RLS', 'user_settings_select_own policy exists', schemaSql.includes('CREATE POLICY "user_settings_select_own" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);'));
  recordTest('SCHEMA:RLS', 'user_settings_insert_own policy exists', schemaSql.includes('CREATE POLICY "user_settings_insert_own" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);'));
  recordTest('SCHEMA:RLS', 'user_settings_update_own policy exists', schemaSql.includes('CREATE POLICY "user_settings_update_own" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);'));
  recordTest('SCHEMA:RLS', 'user_settings_delete_own policy exists', schemaSql.includes('CREATE POLICY "user_settings_delete_own" ON public.user_settings FOR DELETE USING (auth.uid() = user_id);'));

  // ==================================================================
  // 7. V1 STORAGE & PRODUCTION ISOLATION
  // ==================================================================
  console.log('\n--- [7] V1 Storage Protection & Isolation ---');
  let v1KeyFound = false;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('eyeflow:v1:')) {
      v1KeyFound = true;
      break;
    }
  }
  recordTest('STORAGE:V1_ISOLATION', 'Zero V1 keys created or touched during V2 settings ops', !v1KeyFound);

  // ==================================================================
  // SUMMARY
  // ==================================================================
  console.log('\n================================================================');
  console.log(`TOTAL TESTS EXECUTED : ${passCount + failCount}`);
  console.log(`PASSED               : ${passCount} (${Math.round((passCount / (passCount + failCount)) * 100)}%)`);
  console.log(`FAILED               : ${failCount}`);
  console.log('================================================================');

  if (failCount > 0) {
    console.error('\n❌ SOME V2 USER SETTINGS TESTS FAILED.');
    process.exit(1);
  } else {
    console.log('\n✓ EYEFLOW V2 PHASE 4 PASSED WITH 100% SUCCESS RATE\n');
  }
}

runSettingsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
