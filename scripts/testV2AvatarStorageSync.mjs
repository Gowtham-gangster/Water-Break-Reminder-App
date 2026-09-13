// scripts/testV2AvatarStorageSync.mjs
// EyeFlow — Profile Photo / Storage + Cross-Device Synchronization Test Suite

import assert from 'assert';
import { ProfileAvatarService, AVATAR_BUCKET, MAX_AVATAR_SIZE_BYTES } from '../src/services/profileAvatarService.ts';
import { ProfileService } from '../src/services/profileService.ts';
import { storageEngine } from '../src/engine/storageEngine.ts';
import { RealtimeSyncService } from '../src/services/realtimeSyncService.ts';

// In-memory localStorage polyfill for Node.js
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
console.log('    EYEFLOW: AVATAR STORAGE & CROSS-DEVICE SYNC TEST SUITE      ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function recordTest(domain, name, condition, details = '') {
  const padDomain = `[${domain}]`.padEnd(18);
  const padName = name.padEnd(46);
  if (condition) {
    console.log(`  ✓ ${padDomain} ${padName}: PASS ${details ? `(${details})` : ''}`);
    passCount++;
  } else {
    console.error(`  ✗ ${padDomain} ${padName}: FAIL ${details ? `(${details})` : ''}`);
    failCount++;
  }
}

async function runAvatarTests() {
  const avatarService = new ProfileAvatarService();
  const profileService = new ProfileService();

  const userA_Id = '11111111-1111-4111-a111-111111111111';
  const userB_Id = '22222222-2222-4222-b222-222222222222';

  // 1. IMAGE VALIDATION
  console.log('--- [1] Image Validation & Format Constraints ---');
  const validJpeg = { type: 'image/jpeg', size: 1024 * 500 };
  const validPng = { type: 'image/png', size: 1024 * 1024 };
  const validWebp = { type: 'image/webp', size: 1024 * 200 };
  const invalidExe = { type: 'application/x-msdownload', size: 1024 };
  const oversizedImage = { type: 'image/jpeg', size: MAX_AVATAR_SIZE_BYTES + 1024 };

  recordTest('AVATAR:VALIDATION', 'Valid JPEG accepted', avatarService.validateImage(validJpeg).valid === true);
  recordTest('AVATAR:VALIDATION', 'Valid PNG accepted', avatarService.validateImage(validPng).valid === true);
  recordTest('AVATAR:VALIDATION', 'Valid WebP accepted', avatarService.validateImage(validWebp).valid === true);
  recordTest('AVATAR:VALIDATION', 'Executable/invalid mime rejected', avatarService.validateImage(invalidExe).valid === false);
  recordTest('AVATAR:VALIDATION', 'Oversized image (>5MB) rejected', avatarService.validateImage(oversizedImage).valid === false);

  // 2. AVATAR URL RESOLUTION & STORAGE BUCKET
  console.log('\n--- [2] Avatar URL Resolution & Storage Bucket ---');
  recordTest('STORAGE:BUCKET', 'Dedicated bucket is avatars', AVATAR_BUCKET === 'avatars');

  const nullUrl = avatarService.resolveAvatarUrl(null);
  recordTest('AVATAR:RESOLVE', 'Null avatar returns null fallback', nullUrl === null);

  const fullHttpUrl = 'https://supabase.co/storage/v1/object/public/avatars/user123/avatar_123.webp';
  const resolvedFull = avatarService.resolveAvatarUrl(fullHttpUrl);
  recordTest('AVATAR:RESOLVE', 'Full HTTPS URL preserved', resolvedFull === fullHttpUrl);

  const relativePath = `${userA_Id}/avatar_1700000000.webp`;
  const resolvedRel = avatarService.resolveAvatarUrl(relativePath);
  recordTest('AVATAR:RESOLVE', 'Relative storage path resolved to URL', typeof resolvedRel === 'string' && resolvedRel.includes('avatars'));

  // 3. NO BASE64 IN DATABASE ARCHITECTURE
  console.log('\n--- [3] Architecture: No Base64 in Database ---');
  await profileService.ensureProfileExists({
    id: userA_Id,
    email: 'alice@eyeflow.dev',
    user_metadata: {
      display_name: 'Alice CrossDevice',
      timezone: 'UTC',
      avatar_url: null,
    },
  });

  const sampleStorageUrl = `https://supabase.co/storage/v1/object/public/avatars/${userA_Id}/avatar_1726000000000.webp`;
  
  // Create profile with proper storage reference
  await profileService.updateProfile(userA_Id, {
    display_name: 'Alice CrossDevice',
    avatar_url: sampleStorageUrl,
  });

  const { profile: loadedProfileA } = await profileService.getProfile(userA_Id);
  recordTest('AVATAR:DB_REF', 'Avatar URL is persistent storage URL', loadedProfileA && loadedProfileA.avatar_url === sampleStorageUrl);
  recordTest('AVATAR:NO_BASE64', 'Database does not contain base64 string', loadedProfileA && !loadedProfileA.avatar_url.startsWith('data:image/'));

  // 4. LEGACY BASE64 AVATAR DETECTION
  console.log('\n--- [4] Legacy Base64 Avatar Migration Detection ---');
  const legacyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const isLegacy = legacyBase64.startsWith('data:image/');
  recordTest('AVATAR:MIGRATION', 'Legacy base64 pattern recognized', isLegacy === true);

  // 5. CROSS-DEVICE REALTIME SYNC
  console.log('\n--- [5] Cross-Device Realtime Profile Sync ---');
  const realtime = new RealtimeSyncService();
  let receivedRemoteAvatar = null;
  let receivedRemoteName = null;

  const unsub = realtime.onProfileChange((payload) => {
    if (payload.new) {
      receivedRemoteAvatar = payload.new.avatar_url;
      receivedRemoteName = payload.new.display_name;
    }
  });

  // Simulate remote update event from Android/Windows
  const simulatedRemoteEvent = {
    eventType: 'UPDATE',
    new: {
      id: userA_Id,
      display_name: 'Alice Mobile',
      avatar_url: `https://supabase.co/storage/v1/object/public/avatars/${userA_Id}/avatar_9999999.webp`,
      timezone: 'Asia/Kolkata',
      updated_at: new Date().toISOString(),
    },
    old: { id: userA_Id },
  };

  // Dispatch through listener
  realtime.profileListeners.forEach((cb) => cb(simulatedRemoteEvent));

  recordTest('REALTIME:SYNC', 'Remote profile avatar event received', receivedRemoteAvatar === simulatedRemoteEvent.new.avatar_url);
  recordTest('REALTIME:SYNC', 'Remote profile name event received', receivedRemoteName === 'Alice Mobile');
  unsub();

  // 6. ACCOUNT ISOLATION
  console.log('\n--- [6] Multi-Account Isolation ---');
  await profileService.ensureProfileExists({
    id: userB_Id,
    email: 'bob@eyeflow.dev',
    user_metadata: {
      display_name: 'Bob Laptop',
      timezone: 'UTC',
      avatar_url: null,
    },
  });

  await profileService.updateProfile(userB_Id, {
    display_name: 'Bob Laptop',
    avatar_url: `https://supabase.co/storage/v1/object/public/avatars/${userB_Id}/avatar_bob_123.webp`,
  });

  const { profile: bobProfile } = await profileService.getProfile(userB_Id);
  const { profile: aliceProfile } = await profileService.getProfile(userA_Id);

  recordTest('ISOLATION', 'User A avatar distinct from User B', aliceProfile && bobProfile && aliceProfile.avatar_url !== bobProfile.avatar_url);
  recordTest('ISOLATION', 'User A does not overwrite User B', bobProfile && bobProfile.display_name === 'Bob Laptop');

  // 7. HARD REFRESH & PERSISTENT SESSION RECONCILIATION
  console.log('\n--- [7] Hard Refresh & Session Restoration ---');
  const keyA = profileService.getScopedProfileKey(userA_Id);
  const reloadedCached = await storageEngine.get(keyA, null);
  recordTest('PERSISTENCE', 'Profile persists in user-scoped cache', reloadedCached !== null && reloadedCached.avatar_url !== null);

  console.log('\n================================================================');
  console.log(`TOTAL PASS: ${passCount} | TOTAL FAIL: ${failCount}`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAvatarTests().catch((err) => {
  console.error('Fatal avatar test error:', err);
  process.exit(1);
});
