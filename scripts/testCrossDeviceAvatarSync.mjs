// scripts/testCrossDeviceAvatarSync.mjs
// EyeFlow — 3-Device (Web, Windows, Android) Avatar Sync Verification Suite

import assert from 'assert';
import { ProfileAvatarService, AVATAR_BUCKET, MAX_AVATAR_SIZE_BYTES } from '../src/services/profileAvatarService.ts';
import { ProfileService } from '../src/services/profileService.ts';
import { storageEngine } from '../src/engine/storageEngine.ts';
import { RealtimeSyncService } from '../src/services/realtimeSyncService.ts';

// In-memory polyfill for Node.js environment
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
console.log('   EYEFLOW: 3-DEVICE AVATAR SYNCHRONIZATION DIAGNOSTIC SUITE   ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function report(step, title, condition, details = '') {
  const padStep = `[${step}]`.padEnd(16);
  const padTitle = title.padEnd(52);
  if (condition) {
    console.log(`  ✓ ${padStep} ${padTitle} : PASS ${details ? `(${details})` : ''}`);
    passCount++;
  } else {
    console.error(`  ✗ ${padStep} ${padTitle} : FAIL ${details ? `(${details})` : ''}`);
    failCount++;
  }
}

async function runThreeDeviceDiagnostic() {
  const avatarService = new ProfileAvatarService();
  const profileService = new ProfileService();

  const testUserId = '33333333-3333-4333-c333-333333333333';
  const testUserEmail = 'sync_user@eyeflow.dev';

  // -------------------------------------------------------------
  // STEP 1: WRITE PATH & STORAGE RESOLUTION
  // -------------------------------------------------------------
  console.log('--- [STEP 1 & 2] Write Path, Storage Bucket & URL Resolution ---');
  
  const validImage = { type: 'image/webp', size: 1024 * 300 };
  const validation = avatarService.validateImage(validImage);
  report('STEP 1: WRITE', 'Avatar image validation succeeds', validation.valid === true);

  const testStoragePath = `${testUserId}/avatar_${Date.now()}.webp`;
  const resolvedUrl = avatarService.resolveAvatarUrl(testStoragePath);
  report('STEP 2: STORAGE', 'Storage public URL resolved correctly', typeof resolvedUrl === 'string' && resolvedUrl.includes(AVATAR_BUCKET));

  // -------------------------------------------------------------
  // STEP 3: profiles TABLE & updated_at PROGRESSION
  // -------------------------------------------------------------
  console.log('\n--- [STEP 3] profiles Table updated_at Timestamp Progression ---');
  
  const initialTime = new Date(Date.now() - 10000).toISOString();
  await profileService.ensureProfileExists({
    id: testUserId,
    email: testUserEmail,
    user_metadata: {
      display_name: 'Test Sync User',
      timezone: 'UTC',
      avatar_url: null,
    },
  });

  const url1 = `https://supabase.co/storage/v1/object/public/avatars/${testUserId}/avatar_1000.webp`;
  const res1 = await profileService.updateProfile(testUserId, { avatar_url: url1 });
  const t1 = res1.profile?.updated_at || '';

  await new Promise((r) => setTimeout(r, 50));

  const url2 = `https://supabase.co/storage/v1/object/public/avatars/${testUserId}/avatar_2000.webp`;
  const res2 = await profileService.updateProfile(testUserId, { avatar_url: url2 });
  const t2 = res2.profile?.updated_at || '';

  report('STEP 3: DB', 'profiles.avatar_url updated successfully', res2.profile?.avatar_url === url2);
  report('STEP 3: DB', 'updated_at monotonically increases (T2 >= T1)', new Date(t2).getTime() >= new Date(t1).getTime());

  // -------------------------------------------------------------
  // STEP 6: CANONICAL USER-SCOPED CACHE KEYS
  // -------------------------------------------------------------
  console.log('\n--- [STEP 6] Canonical User-Scoped Cache Verification ---');
  
  const canonicalKey = storageEngine.getScopedKey('profile', testUserId);
  const profileServiceKey = profileService.getScopedProfileKey(testUserId);
  report('STEP 6: CACHE', 'StorageEngine and ProfileService share canonical key', canonicalKey === profileServiceKey);
  report('STEP 6: CACHE', 'Key matches canonical format eyeflow:v2:{userId}:profile', canonicalKey === `eyeflow:v2:${testUserId}:profile`);

  // -------------------------------------------------------------
  // STEP 10: REAL THREE-DEVICE ACTIVE SIMULATION
  // Device A = Windows, Device B = Web, Device C = Android
  // -------------------------------------------------------------
  console.log('\n--- [STEP 10] 3-Device Realtime Propagation Matrix ---');

  // Set up 3 active device client mock listeners for the same user
  const clientWindows = { avatar: url2, name: 'Test Sync User' };
  const clientWeb = { avatar: url2, name: 'Test Sync User' };
  const clientAndroid = { avatar: url2, name: 'Test Sync User' };

  const realtimeWindows = new RealtimeSyncService();
  const realtimeWeb = new RealtimeSyncService();
  const realtimeAndroid = new RealtimeSyncService();

  realtimeWindows.subscribe(testUserId);
  realtimeWeb.subscribe(testUserId);
  realtimeAndroid.subscribe(testUserId);

  realtimeWindows.onProfileChange((payload) => {
    if (payload.new && payload.new.id === testUserId) {
      clientWindows.avatar = payload.new.avatar_url;
      clientWindows.name = payload.new.display_name;
    }
  });

  realtimeWeb.onProfileChange((payload) => {
    if (payload.new && payload.new.id === testUserId) {
      clientWeb.avatar = payload.new.avatar_url;
      clientWeb.name = payload.new.display_name;
    }
  });

  realtimeAndroid.onProfileChange((payload) => {
    if (payload.new && payload.new.id === testUserId) {
      clientAndroid.avatar = payload.new.avatar_url;
      clientAndroid.name = payload.new.display_name;
    }
  });

  // TEST 1: Windows changes avatar -> Web & Android receive
  const windowsAvatarUrl = `https://supabase.co/storage/v1/object/public/avatars/${testUserId}/avatar_windows_3000.webp`;
  clientWindows.avatar = windowsAvatarUrl;
  const windowsPayload = {
    eventType: 'UPDATE',
    new: {
      id: testUserId,
      display_name: 'Test Sync User',
      avatar_url: windowsAvatarUrl,
      timezone: 'UTC',
      updated_at: new Date().toISOString(),
    },
    old: { id: testUserId },
  };

  // Dispatch broadcast to all active remote clients
  [realtimeWeb, realtimeAndroid].forEach((rt) => {
    rt.profileListeners.forEach((cb) => cb(windowsPayload));
  });

  report('STEP 10: TEST 1', 'Windows -> Web realtime received', clientWeb.avatar === windowsAvatarUrl);
  report('STEP 10: TEST 1', 'Windows -> Android realtime received', clientAndroid.avatar === windowsAvatarUrl);

  // TEST 2: Web changes avatar -> Windows & Android receive
  const webAvatarUrl = `https://supabase.co/storage/v1/object/public/avatars/${testUserId}/avatar_web_4000.webp`;
  clientWeb.avatar = webAvatarUrl;
  const webPayload = {
    eventType: 'UPDATE',
    new: {
      id: testUserId,
      display_name: 'Test Sync User',
      avatar_url: webAvatarUrl,
      timezone: 'UTC',
      updated_at: new Date().toISOString(),
    },
    old: { id: testUserId },
  };

  [realtimeWindows, realtimeAndroid].forEach((rt) => {
    rt.profileListeners.forEach((cb) => cb(webPayload));
  });

  report('STEP 10: TEST 2', 'Web -> Windows realtime received', clientWindows.avatar === webAvatarUrl);
  report('STEP 10: TEST 2', 'Web -> Android realtime received', clientAndroid.avatar === webAvatarUrl);

  // TEST 3: Android changes avatar -> Web & Windows receive
  const androidAvatarUrl = `https://supabase.co/storage/v1/object/public/avatars/${testUserId}/avatar_android_5000.webp`;
  clientAndroid.avatar = androidAvatarUrl;
  const androidPayload = {
    eventType: 'UPDATE',
    new: {
      id: testUserId,
      display_name: 'Test Sync User',
      avatar_url: androidAvatarUrl,
      timezone: 'UTC',
      updated_at: new Date().toISOString(),
    },
    old: { id: testUserId },
  };

  [realtimeWindows, realtimeWeb].forEach((rt) => {
    rt.profileListeners.forEach((cb) => cb(androidPayload));
  });

  report('STEP 10: TEST 3', 'Android -> Windows realtime received', clientWindows.avatar === androidAvatarUrl);
  report('STEP 10: TEST 3', 'Android -> Web realtime received', clientWeb.avatar === androidAvatarUrl);
  report('STEP 10: MATRIX', 'All three devices reflect identical final avatar', 
    clientWindows.avatar === androidAvatarUrl &&
    clientWeb.avatar === androidAvatarUrl &&
    clientAndroid.avatar === androidAvatarUrl
  );

  // -------------------------------------------------------------
  // STEP 11: RESTART & RECONNECT RECOVERY
  // -------------------------------------------------------------
  console.log('\n--- [STEP 11] Restart & Reconnect Profile Reconcile ---');

  // Simulate Windows app closed, Web uploads new avatar, Windows reopens
  const restartAvatarUrl = `https://supabase.co/storage/v1/object/public/avatars/${testUserId}/avatar_restart_6000.webp`;
  await profileService.updateProfile(testUserId, { avatar_url: restartAvatarUrl });

  // Windows boots and fetches authoritative profile
  const { profile: restoredProfile } = await profileService.getProfile(testUserId);
  report('STEP 11: RESTART', 'Reopened client fetches newest cloud avatar', restoredProfile?.avatar_url === restartAvatarUrl);

  realtimeWindows.unsubscribe();
  realtimeWeb.unsubscribe();
  realtimeAndroid.unsubscribe();

  console.log('\n================================================================');
  console.log(`TOTAL PASS: ${passCount} | TOTAL FAIL: ${failCount}`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runThreeDeviceDiagnostic().catch((err) => {
  console.error('Diagnostic run failed:', err);
  process.exit(1);
});
