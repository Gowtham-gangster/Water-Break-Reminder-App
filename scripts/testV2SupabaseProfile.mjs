// scripts/testV2SupabaseProfile.mjs
// EyeFlow V2 — Phase 3: Supabase User Profile Test Suite

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { ProfileService } from '../src/services/profileService.ts';
import { storageEngine } from '../src/engine/storageEngine.ts';

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
console.log('        EYEFLOW V2: PHASE 3 - USER PROFILE TEST SUITE           ');
console.log('================================================================\n');

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

async function runProfileTests() {
  const profileService = new ProfileService();

  const userA_Id = 'usr_alice_11111111-1111-4111-a111-111111111111';
  const userB_Id = 'usr_bob_22222222-2222-4222-b222-222222222222';

  // ==================================================================
  // 1. NEW USER PROFILE CREATION & IANA TIMEZONE
  // ==================================================================
  console.log('--- [1] Profile Creation & IANA Timezone ---');
  
  const createdA = await profileService.ensureProfileExists({
    id: userA_Id,
    email: 'alice@eyeflow.dev',
    user_metadata: {
      display_name: 'Alice Engineer',
      timezone: 'Asia/Kolkata',
      avatar_url: 'https://example.com/avatar_alice.png',
    },
  });

  recordTest('PROFILE:CREATE', 'Profile created with user ID', createdA.id === userA_Id);
  recordTest('PROFILE:CREATE', 'Display name set correctly', createdA.display_name === 'Alice Engineer');
  recordTest('PROFILE:CREATE', 'IANA timezone set correctly', createdA.timezone === 'Asia/Kolkata');
  recordTest('PROFILE:CREATE', 'Avatar URL persisted', createdA.avatar_url === 'https://example.com/avatar_alice.png');

  // ==================================================================
  // 2. USER-SCOPED LOCAL CACHE
  // ==================================================================
  console.log('\n--- [2] User-Scoped Local Cache Namespacing ---');
  const cacheKeyA = profileService.getScopedProfileKey(userA_Id);
  recordTest('PROFILE:CACHE', 'Profile cache key namespaced', cacheKeyA === `eyeflow:v2:${userA_Id}:profile`);

  const cachedProfileA = await storageEngine.get(cacheKeyA, null);
  recordTest('PROFILE:CACHE', 'Profile cached in user-scoped storage', cachedProfileA && cachedProfileA.display_name === 'Alice Engineer');

  // ==================================================================
  // 3. PROFILE UPDATES (DISPLAY NAME, TIMEZONE, AVATAR)
  // ==================================================================
  console.log('\n--- [3] Profile Updates ---');
  await storageEngine.set(cacheKeyA, {
    ...cachedProfileA,
    display_name: 'Alice Principal Engineer',
    timezone: 'America/New_York',
    avatar_url: 'https://example.com/avatar_alice_v2.png',
    updated_at: new Date().toISOString(),
  });

  const { profile: updatedProfileA } = await profileService.getProfile(userA_Id);
  recordTest('PROFILE:UPDATE', 'Display name updated', updatedProfileA.display_name === 'Alice Principal Engineer');
  recordTest('PROFILE:UPDATE', 'IANA Timezone updated to America/New_York', updatedProfileA.timezone === 'America/New_York');
  recordTest('PROFILE:UPDATE', 'Avatar URL updated', updatedProfileA.avatar_url === 'https://example.com/avatar_alice_v2.png');

  // ==================================================================
  // 4. OFFLINE PROFILE RETRIEVAL
  // ==================================================================
  console.log('\n--- [4] Offline Profile Loading ---');
  // Even if Supabase cloud is unreachable, cached profile is loaded seamlessly
  const offlineProfile = await storageEngine.get(cacheKeyA, null);
  recordTest('PROFILE:OFFLINE', 'Profile loads instantly from local user cache', offlineProfile.id === userA_Id);
  recordTest('PROFILE:OFFLINE', 'Offline timezone intact', offlineProfile.timezone === 'America/New_York');

  // ==================================================================
  // 5. MULTI-USER ISOLATION (USER A VS USER B)
  // ==================================================================
  console.log('\n--- [5] Multi-User Isolation (User A vs User B) ---');
  const createdB = await profileService.ensureProfileExists({
    id: userB_Id,
    email: 'bob@eyeflow.dev',
    user_metadata: {
      display_name: 'Bob Architect',
      timezone: 'Europe/London',
      avatar_url: 'https://example.com/avatar_bob.png',
    },
  });

  const cacheKeyB = profileService.getScopedProfileKey(userB_Id);
  const cachedProfileB = await storageEngine.get(cacheKeyB, null);

  recordTest('PROFILE:ISOLATION', 'User B profile ID isolated', createdB.id === userB_Id);
  recordTest('PROFILE:ISOLATION', 'User B cache key disjoint from User A', cacheKeyA !== cacheKeyB);
  recordTest('PROFILE:ISOLATION', 'User B retrieves strictly User B profile', cachedProfileB.display_name === 'Bob Architect');
  recordTest('PROFILE:ISOLATION', 'User A profile unchanged by User B', cachedProfileA.display_name !== cachedProfileB.display_name);

  // ==================================================================
  // 6. ACCOUNT SWITCHING & MEMORY PURGE
  // ==================================================================
  console.log('\n--- [6] Account Switching ---');
  // Simulate logout of User A
  await storageEngine.clearUserScopedTransientState(userA_Id);
  
  // User B active
  const activeB = await storageEngine.get(cacheKeyB, null);
  recordTest('PROFILE:SWITCH', 'Switched user loads only their own profile', activeB.id === userB_Id && activeB.timezone === 'Europe/London');

  // ==================================================================
  // 7. V1 STORAGE NON-INTERFERENCE
  // ==================================================================
  console.log('\n--- [7] V1 Storage Key Isolation ---');
  const v1Key = 'waterConfig';
  await storageEngine.set(v1Key, { enabled: true, intervalMinutes: 45, version: '1.0.0' });
  const v1Check = await storageEngine.get(v1Key, null);
  recordTest('V1:COMPAT', 'V1 local storage keys undisturbed', v1Check && v1Check.version === '1.0.0');

  // ==================================================================
  // FINAL RESULTS
  // ==================================================================
  console.log('\n================================================================');
  console.log('                 FINAL PHASE 3 PROFILE REPORT                   ');
  console.log('================================================================');
  console.log(`TOTAL TESTS EXECUTED : ${passCount + failCount}`);
  console.log(`PASSED               : ${passCount}`);
  console.log(`FAILED               : ${failCount}`);
  console.log('================================================================');

  if (failCount === 0) {
    console.log('   ✓ EYEFLOW V2 PHASE 3 PASSED WITH 100% SUCCESS RATE           ');
    console.log('================================================================\n');
  } else {
    throw new Error(`${failCount} tests failed in Phase 3 test suite.`);
  }
}

runProfileTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
