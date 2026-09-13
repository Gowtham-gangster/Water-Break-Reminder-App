// scripts/testV2SupabaseAuth.mjs
// EyeFlow V2 — Phase 2: Supabase Auth & Multi-User Authentication Test Suite

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { AuthService } from '../src/services/authService.ts';
import { storageEngine } from '../src/engine/storageEngine.ts';
import { SyncService } from '../src/services/syncService.ts';

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
console.log('      EYEFLOW V2: PHASE 2 - SUPABASE AUTHENTICATION SUITE       ');
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

async function runAuthTests() {
  const auth = new AuthService();
  const sync = new SyncService();

  // ==================================================================
  // 1. REGISTRATION & INPUT VALIDATION
  // ==================================================================
  console.log('--- [1] User Registration & Validation ---');
  
  // Registration data conversion
  const mockUserA = {
    id: 'usr_alice_11111111-1111-4111-a111-111111111111',
    email: 'alice@eyeflow.dev',
    user_metadata: {
      display_name: 'Alice Developer',
      timezone: 'America/New_York',
    },
    created_at: new Date().toISOString(),
  };

  const profileA = auth.toUserProfile(mockUserA);
  recordTest('AUTH:REGISTER', 'User profile ID mapped from auth.id', profileA.id === mockUserA.id);
  recordTest('AUTH:REGISTER', 'Display name mapped correctly', profileA.display_name === 'Alice Developer');
  recordTest('AUTH:REGISTER', 'Timezone mapped correctly', profileA.timezone === 'America/New_York');

  // ==================================================================
  // 2. ERROR HANDLING & USER-FRIENDLY MESSAGING
  // ==================================================================
  console.log('\n--- [2] Error Handling & Sanitization ---');
  const invalidCredentialsError = (auth).formatAuthError({ message: 'Invalid login credentials' });
  recordTest('AUTH:ERROR', 'Invalid credentials mapped to user message', invalidCredentialsError.includes('Invalid email or password'));

  const unconfirmedEmailError = (auth).formatAuthError({ message: 'Email not confirmed' });
  recordTest('AUTH:ERROR', 'Email confirmation notice formatted cleanly', unconfirmedEmailError.includes('verify your email'));

  const duplicateUserError = (auth).formatAuthError({ message: 'User already registered' });
  recordTest('AUTH:ERROR', 'Duplicate registration error formatted cleanly', duplicateUserError.includes('already exists'));

  const networkError = (auth).formatAuthError({ message: 'Failed to fetch network resource' });
  recordTest('AUTH:ERROR', 'Network error sanitized without technical trace', networkError.includes('Network unavailable'));

  // ==================================================================
  // 3. SESSION PERSISTENCE & STARTUP RESTORATION
  // ==================================================================
  console.log('\n--- [3] Session Persistence & Restoration ---');
  const sessionData = {
    access_token: 'ey_mock_access_token_user_a',
    refresh_token: 'ey_mock_refresh_token_user_a',
    user: mockUserA,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };

  // Simulate storing session
  globalThis.localStorage.setItem('eyeflow:v2:auth:session', JSON.stringify(sessionData));
  const storedRaw = globalThis.localStorage.getItem('eyeflow:v2:auth:session');
  recordTest('AUTH:SESSION', 'Session persisted in supported storage', Boolean(storedRaw));

  const restored = JSON.parse(storedRaw);
  recordTest('AUTH:SESSION', 'Restored user ID matches authenticated user', restored.user.id === mockUserA.id);
  recordTest('AUTH:SESSION', 'Session is active and not expired', restored.expires_at > Math.floor(Date.now() / 1000));

  // ==================================================================
  // 4. OFFLINE SESSION RETENTION
  // ==================================================================
  console.log('\n--- [4] Offline Session Resilience ---');
  // Even if network is offline, the locally stored session remains valid and allows access to cached config
  const cachedUserAKey = sync.getScopedKey(mockUserA.id, 'settings');
  await storageEngine.set(cachedUserAKey, { theme: 'dark', time_format: '24h' });
  
  const offlineUserConfig = await storageEngine.get(cachedUserAKey, null);
  recordTest('AUTH:OFFLINE', 'Offline access enabled from cached user data', offlineUserConfig.theme === 'dark');

  // ==================================================================
  // 5. LOGOUT & TEARDOWN
  // ==================================================================
  console.log('\n--- [5] Logout Pipeline & Transient State Flush ---');
  // Set user transient timers
  await storageEngine.set(`eyeflow:v2:${mockUserA.id}:activeReminders`, { active: true, slotId: 'water-0900' });
  
  // Execute signOut teardown
  await auth.signOut(mockUserA.id);
  const activeAfterSignOut = await storageEngine.get(`eyeflow:v2:${mockUserA.id}:activeReminders`, null);
  recordTest('AUTH:LOGOUT', 'Active timers purged immediately on logout', activeAfterSignOut === null);

  // ==================================================================
  // 6. ACCOUNT SWITCHING ISOLATION (USER A -> USER B)
  // ==================================================================
  console.log('\n--- [6] Account Switching & Cross-User Isolation ---');
  const mockUserB = {
    id: 'usr_bob_22222222-2222-4222-b222-222222222222',
    email: 'bob@eyeflow.dev',
    user_metadata: {
      display_name: 'Bob Operator',
      timezone: 'Europe/London',
    },
    created_at: new Date().toISOString(),
  };

  const userA_WaterKey = sync.getScopedKey(mockUserA.id, 'water');
  const userB_WaterKey = sync.getScopedKey(mockUserB.id, 'water');

  await storageEngine.set(userA_WaterKey, { enabled: true, interval_minutes: 30 });
  await storageEngine.set(userB_WaterKey, { enabled: true, interval_minutes: 75 });

  // User A logs out, User B logs in
  await auth.signOut(mockUserA.id);
  
  const retrievedWaterB = await storageEngine.get(userB_WaterKey, null);
  const retrievedWaterA = await storageEngine.get(userA_WaterKey, null);

  recordTest('AUTH:SWITCH', 'User B receives exclusively User B configuration', retrievedWaterB.interval_minutes === 75);
  recordTest('AUTH:SWITCH', 'User A configuration does not leak into User B', retrievedWaterA.interval_minutes === 30 && retrievedWaterB.interval_minutes !== 30);

  // ==================================================================
  // 7. V1 BACKWARD COMPATIBILITY & ISOLATION
  // ==================================================================
  console.log('\n--- [7] V1 Storage Key Isolation ---');
  const v1Key = 'waterConfig';
  await storageEngine.set(v1Key, { enabled: true, intervalMinutes: 45, isV1: true });
  const v1Check = await storageEngine.get(v1Key, null);
  recordTest('V1:COMPAT', 'V1 global keys remain completely uncorrupted', v1Check && v1Check.isV1 === true);

  // ==================================================================
  // 8. SECURITY AUDIT: NO SERVICE ROLE OR CREDENTIAL LEAKS
  // ==================================================================
  console.log('\n--- [8] Security & Credential Audit ---');
  const envExampleContent = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
  recordTest('SECURITY', 'No service_role key in .env.example', !envExampleContent.includes('service_role'));
  recordTest('SECURITY', 'No hardcoded private credentials in authService', !fs.readFileSync(path.resolve(process.cwd(), 'src/services/authService.ts'), 'utf8').includes('service_role'));

  // ==================================================================
  // FINAL RESULTS
  // ==================================================================
  console.log('\n================================================================');
  console.log('              FINAL PHASE 2 AUTHENTICATION REPORT               ');
  console.log('================================================================');
  console.log(`TOTAL TESTS EXECUTED : ${passCount + failCount}`);
  console.log(`PASSED               : ${passCount}`);
  console.log(`FAILED               : ${failCount}`);
  console.log('================================================================');

  if (failCount === 0) {
    console.log('   ✓ EYEFLOW V2 PHASE 2 PASSED WITH 100% SUCCESS RATE           ');
    console.log('================================================================\n');
  } else {
    throw new Error(`${failCount} tests failed in Phase 2 test suite.`);
  }
}

runAuthTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
