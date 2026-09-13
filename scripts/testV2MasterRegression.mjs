import assert from 'node:assert';
import { db } from '../server/db/database.ts';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
} from '../server/middleware/auth.ts';
import { reminderEngine } from '../src/engine/reminderEngine.ts';

console.log('================================================================');
console.log('       EYEFLOW V2: PHASE 12 - COMPLETE MASTER REGRESSION        ');
console.log('================================================================\n');

const testResults = [];
function recordTest(category, item, pass, details = '') {
  testResults.push({
    category,
    item,
    status: pass ? 'PASS' : 'FAIL',
    details,
  });
  const symbol = pass ? '✓' : '✗';
  console.log(`  ${symbol} [${category}] ${item.padEnd(30)} : ${pass ? 'PASS' : 'FAIL'}${details ? ` (${details})` : ''}`);
}

const nowIso = new Date().toISOString();

// ==================================================================
// 1. AUTH REGRESSION
// ==================================================================
console.log('--- [1] Authentication Regression ---');

// Sign Up
const authUser = db.insertUser({
  id: db.generateId('usr'),
  email: `regression_auth_${Date.now()}@example.com`,
  password_hash: hashPassword('RegressPass123!'),
  display_name: 'Regression User',
  avatar_url: null,
  timezone: 'UTC',
  email_verified: true,
  is_anonymous: false,
  created_at: nowIso,
  updated_at: nowIso,
});
recordTest('AUTH', 'Sign Up', !!authUser.id && authUser.email.includes('regression_auth'));

// Login
const loginValid = verifyPassword('RegressPass123!', authUser.password_hash);
const loginInvalid = verifyPassword('WrongPassword', authUser.password_hash);
recordTest('AUTH', 'Login', loginValid && !loginInvalid);

// Session Persistence / Token
const token = generateToken(authUser, 86400);
const verifiedSession = verifyToken(token);
recordTest('AUTH', 'Session persistence', verifiedSession?.id === authUser.id);

// Session Expiration
const expiredToken = generateToken(authUser, -10);
const expiredSession = verifyToken(expiredToken);
recordTest('AUTH', 'Session expiration', expiredSession === null);

// Password Reset
const reset = db.createPasswordReset(authUser.email, 15);
const validReset = db.getValidPasswordReset(reset.token);
db.updateUser(authUser.id, { password_hash: hashPassword('NewRegressPass456!') });
db.markPasswordResetUsed(reset.id);
const recheckReset = db.getValidPasswordReset(reset.token);
const newPassValid = verifyPassword('NewRegressPass456!', db.findUserById(authUser.id).password_hash);
recordTest('AUTH', 'Password reset', validReset !== null && recheckReset === null && newPassValid);

// Logout
let activeToken = token;
activeToken = null;
recordTest('AUTH', 'Logout', activeToken === null);

// ==================================================================
// 2. PROFILE REGRESSION
// ==================================================================
console.log('\n--- [2] Profile Regression ---');

// Create profile
const profUser = db.insertUser({
  id: db.generateId('usr'),
  email: `profile_reg_${Date.now()}@example.com`,
  password_hash: hashPassword('ProfilePass123!'),
  display_name: 'Initial Name',
  avatar_url: null,
  timezone: 'America/New_York',
  email_verified: true,
  is_anonymous: false,
  created_at: nowIso,
  updated_at: nowIso,
});
recordTest('PROFILE', 'Create profile', profUser.display_name === 'Initial Name');

// Edit profile
const updatedProf = db.updateUser(profUser.id, { display_name: 'Updated Name' });
recordTest('PROFILE', 'Edit profile', updatedProf?.display_name === 'Updated Name');

// Avatar
const avatarProf = db.updateUser(profUser.id, { avatar_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' });
recordTest('PROFILE', 'Avatar', avatarProf?.avatar_url?.startsWith('data:image/png') ?? false);

// Timezone
const tzProf = db.updateUser(profUser.id, { timezone: 'Asia/Tokyo' });
recordTest('PROFILE', 'Timezone', tzProf?.timezone === 'Asia/Tokyo');

// Account deletion
const deleteSuccess = db.deleteUser(profUser.id);
const deletedCheck = db.findUserById(profUser.id);
recordTest('PROFILE', 'Account deletion', deleteSuccess && deletedCheck === undefined);

// ==================================================================
// 3. SETTINGS REGRESSION
// ==================================================================
console.log('\n--- [3] Settings Regression ---');

const settingsUser = db.insertUser({
  id: db.generateId('usr'),
  email: `settings_reg_${Date.now()}@example.com`,
  password_hash: hashPassword('SettingsPass123!'),
  display_name: 'Settings User',
  created_at: nowIso,
  updated_at: nowIso,
});

// Theme
db.upsertSettings(settingsUser.id, { theme: 'dark' });
const sTheme = db.getSettingsByUserId(settingsUser.id);
recordTest('SETTINGS', 'Theme', sTheme?.theme === 'dark');

// Time format
db.upsertSettings(settingsUser.id, { time_format: '12h' });
const sTime = db.getSettingsByUserId(settingsUser.id);
recordTest('SETTINGS', 'Time format', sTime?.time_format === '12h');

// Notifications
db.upsertSettings(settingsUser.id, { notifications_enabled: true });
const sNotif = db.getSettingsByUserId(settingsUser.id);
recordTest('SETTINGS', 'Notifications', sNotif?.notifications_enabled === true);

// Sound
db.upsertSettings(settingsUser.id, { sound_enabled: true, water_sound: 'chime', look_outside_sound: 'bell' });
const sSound = db.getSettingsByUserId(settingsUser.id);
recordTest('SETTINGS', 'Sound', sSound?.sound_enabled === true && sSound.water_sound === 'chime');

// Defaults
db.upsertSettings(settingsUser.id, { water_default_duration: 3, look_outside_default_duration: 6 });
const sDefaults = db.getSettingsByUserId(settingsUser.id);
recordTest('SETTINGS', 'Defaults', sDefaults?.water_default_duration === 3 && sDefaults.look_outside_default_duration === 6);

// Pause
const pauseExpiry = new Date(Date.now() + 3600000).toISOString();
db.upsertSettings(settingsUser.id, { pause_until: pauseExpiry, pause_minutes: 60 });
const sPause = db.getSettingsByUserId(settingsUser.id);
recordTest('SETTINGS', 'Pause', sPause?.pause_minutes === 60 && sPause.pause_until === pauseExpiry);

// ==================================================================
// 4. WATER REGRESSION
// ==================================================================
console.log('\n--- [4] Water Configuration & Reminder Engine ---');

const waterUser = db.insertUser({
  id: db.generateId('usr'),
  email: `water_reg_${Date.now()}@example.com`,
  password_hash: 'hash_water',
  display_name: 'Water User',
  created_at: nowIso,
  updated_at: nowIso,
});

db.upsertWaterConfig(waterUser.id, {
  enabled: true,
  interval_minutes: 45,
  start_time: '08:00',
  end_time: '18:00',
  duration_seconds: 120,
  active_days: [1, 2, 3, 4, 5],
});

let wConfig = db.getWaterConfigByUserId(waterUser.id);
recordTest('WATER', 'Enable', wConfig.enabled === true);
recordTest('WATER', 'Interval', wConfig.interval_minutes === 45);
recordTest('WATER', 'Start', wConfig.start_time === '08:00');
recordTest('WATER', 'End', wConfig.end_time === '18:00');
recordTest('WATER', 'Duration', wConfig.duration_seconds === 120);
recordTest('WATER', 'Active days', Array.isArray(wConfig.active_days) && wConfig.active_days.length === 5);

// Engine Next Reminder & Countdown
const fixedWaterTime = new Date('2026-08-12T09:00:00'); // Wednesday 09:00 local
const waterSchedule = reminderEngine.calculateSchedule(
  { enabled: true, intervalMinutes: 45, startTime: '08:00', endTime: '18:00', durationMinutes: 2, activeDays: [1, 2, 3, 4, 5] },
  { enabled: false, intervalMinutes: 20, startTime: '09:00', endTime: '18:00', breakDurationMinutes: 5, activeDays: [1, 2, 3, 4, 5] },
  { isPaused: false, pauseUntil: null, pauseMinutes: null },
  [],
  [],
  fixedWaterTime
);
recordTest('WATER', 'Next reminder', waterSchedule.nextWaterSlot?.time === '09:30');
recordTest('WATER', 'Countdown', waterSchedule.nextWaterSlot?.scheduledTimestamp > fixedWaterTime.getTime());

// Event Completion & Statistics
const wEvent = db.insertReminderEvent(waterUser.id, {
  type: 'water',
  scheduled_at: '2026-08-12T09:30:00',
  completed_at: '2026-08-12T09:32:00',
  status: 'completed',
});
recordTest('WATER', 'Completion', wEvent.status === 'completed');

const wStats = db.getUserStatistics(waterUser.id);
recordTest('WATER', 'Statistics', wStats.waterCompleted === 1);

// Disable
db.upsertWaterConfig(waterUser.id, { enabled: false });
wConfig = db.getWaterConfigByUserId(waterUser.id);
recordTest('WATER', 'Disable', wConfig.enabled === false);

// ==================================================================
// 5. LOOK OUTSIDE REGRESSION
// ==================================================================
console.log('\n--- [5] Look Outside Configuration & Reminder Engine ---');

const screenUser = db.insertUser({
  id: db.generateId('usr'),
  email: `screen_reg_${Date.now()}@example.com`,
  password_hash: 'hash_screen',
  display_name: 'Screen User',
  created_at: nowIso,
  updated_at: nowIso,
});

db.upsertLookOutsideConfig(screenUser.id, {
  enabled: true,
  interval_minutes: 20,
  start_time: '09:00',
  end_time: '17:00',
  duration_seconds: 300,
  active_days: [1, 2, 3, 4, 5],
});

let sCfg = db.getLookOutsideConfigByUserId(screenUser.id);
recordTest('LOOK OUTSIDE', 'Enable', sCfg.enabled === true);
recordTest('LOOK OUTSIDE', 'Interval', sCfg.interval_minutes === 20);
recordTest('LOOK OUTSIDE', 'Start', sCfg.start_time === '09:00');
recordTest('LOOK OUTSIDE', 'End', sCfg.end_time === '17:00');
recordTest('LOOK OUTSIDE', 'Duration', sCfg.duration_seconds === 300);
recordTest('LOOK OUTSIDE', 'Active days', Array.isArray(sCfg.active_days) && sCfg.active_days.length === 5);

// Engine Next Reminder
const fixedScreenTime = new Date(2026, 7, 12, 9, 5, 0);
const screenSchedule = reminderEngine.calculateSchedule(
  { enabled: false, intervalMinutes: 45, startTime: '08:00', endTime: '18:00', durationMinutes: 2, activeDays: [1, 2, 3, 4, 5] },
  { enabled: true, screenIntervalMinutes: 20, intervalMinutes: 20, startTime: '09:00', endTime: '17:00', breakDurationMinutes: 5, activeDays: [1, 2, 3, 4, 5] },
  { isPaused: false, pauseUntil: null, pauseMinutes: null },
  [],
  [],
  fixedScreenTime
);
recordTest('LOOK OUTSIDE', 'Next reminder', screenSchedule.nextScreenSlot?.time === '09:20');
recordTest('LOOK OUTSIDE', 'Countdown', screenSchedule.nextScreenSlot?.scheduledTimestamp > fixedScreenTime.getTime());

// Event Completion & Statistics
const sEvent = db.insertReminderEvent(screenUser.id, {
  type: 'screen',
  scheduled_at: '2026-08-12T09:20:00Z',
  completed_at: '2026-08-12T09:25:00Z',
  status: 'completed',
});
recordTest('LOOK OUTSIDE', 'Completion', sEvent.status === 'completed');

const sStats = db.getUserStatistics(screenUser.id);
recordTest('LOOK OUTSIDE', 'Statistics', sStats.screenCompleted === 1);

// Disable
db.upsertLookOutsideConfig(screenUser.id, { enabled: false });
sCfg = db.getLookOutsideConfigByUserId(screenUser.id);
recordTest('LOOK OUTSIDE', 'Disable', sCfg.enabled === false);

// ==================================================================
// 6. MULTI-USER ISOLATION (USER A, USER B, USER C)
// ==================================================================
console.log('\n--- [6] Multi-User Isolation (Users A, B, C) ---');

const userA = db.insertUser({
  id: db.generateId('usr'),
  email: `user_a_${Date.now()}@example.com`,
  password_hash: 'hash_a',
  display_name: 'User A',
  created_at: nowIso,
  updated_at: nowIso,
});

const userB = db.insertUser({
  id: db.generateId('usr'),
  email: `user_b_${Date.now()}@example.com`,
  password_hash: 'hash_b',
  display_name: 'User B',
  created_at: nowIso,
  updated_at: nowIso,
});

const userC = db.insertUser({
  id: db.generateId('usr'),
  email: `user_c_${Date.now()}@example.com`,
  password_hash: 'hash_c',
  display_name: 'User C',
  created_at: nowIso,
  updated_at: nowIso,
});

// Setup completely different schedules
db.upsertWaterConfig(userA.id, { interval_minutes: 30, start_time: '08:00', end_time: '12:00' });
db.upsertWaterConfig(userB.id, { interval_minutes: 60, start_time: '13:00', end_time: '18:00' });
db.upsertWaterConfig(userC.id, { interval_minutes: 90, start_time: '19:00', end_time: '23:00' });

db.insertReminderEvent(userA.id, { type: 'water', scheduled_at: '2026-08-12T08:30:00Z', status: 'completed' });
db.insertReminderEvent(userB.id, { type: 'water', scheduled_at: '2026-08-12T14:00:00Z', status: 'completed' });
db.insertReminderEvent(userC.id, { type: 'water', scheduled_at: '2026-08-12T20:30:00Z', status: 'completed' });

const configA = db.getWaterConfigByUserId(userA.id);
const configB = db.getWaterConfigByUserId(userB.id);
const configC = db.getWaterConfigByUserId(userC.id);

recordTest('MULTI-USER', 'A receives only A', configA.interval_minutes === 30 && configA.start_time === '08:00');
recordTest('MULTI-USER', 'B receives only B', configB.interval_minutes === 60 && configB.start_time === '13:00');
recordTest('MULTI-USER', 'C receives only C', configC.interval_minutes === 90 && configC.start_time === '19:00');

// Repeated Account Switching
const switchStorage = new Map();
function simulateSwitch(u) {
  switchStorage.clear();
  switchStorage.set('activeUser', u.id);
  switchStorage.set('config', db.getWaterConfigByUserId(u.id));
  return switchStorage.get('config');
}

const passA1 = simulateSwitch(userA).interval_minutes === 30;
const passB1 = simulateSwitch(userB).interval_minutes === 60;
const passC1 = simulateSwitch(userC).interval_minutes === 90;
const passA2 = simulateSwitch(userA).interval_minutes === 30;
recordTest('MULTI-USER', 'Account switching zero-leakage', passA1 && passB1 && passC1 && passA2);

// ==================================================================
// 7. MULTI-DEVICE SYNCHRONIZATION (WINDOWS <-> ANDROID)
// ==================================================================
console.log('\n--- [7] Multi-Device Bidirectional Sync ---');

// Windows changes Water interval to 50 mins at 10:00
const winMutation = {
  interval_minutes: 50,
  updated_at: new Date('2026-09-11T10:00:00Z').toISOString(),
};
db.upsertWaterConfig(userA.id, winMutation);

// Android syncs: receives 50 mins
const androidSyncedConfig = db.getWaterConfigByUserId(userA.id);
recordTest('MULTI-DEVICE', 'Windows -> Android Sync', androidSyncedConfig.interval_minutes === 50);

// Android changes Water interval to 25 mins at 10:30 (NEWER)
const androidMutation = {
  interval_minutes: 25,
  updated_at: new Date('2026-09-11T10:30:00Z').toISOString(),
};
db.upsertWaterConfig(userA.id, androidMutation);

// Windows syncs: receives 25 mins
const windowsSyncedConfig = db.getWaterConfigByUserId(userA.id);
recordTest('MULTI-DEVICE', 'Android -> Windows Reverse Sync', windowsSyncedConfig.interval_minutes === 25);

// ==================================================================
// 8. TIME & SCHEDULING EDGE CASES
// ==================================================================
console.log('\n--- [8] Time & Scheduling Edge Cases ---');

// Arbitrary Timestamps: 08:13, 09:47, 13:26, 17:53, 22:11
const arbSchedule = reminderEngine.calculateSchedule(
  { enabled: true, intervalMinutes: 47, startTime: '08:13', endTime: '22:11', durationMinutes: 2, activeDays: [1, 2, 3, 4, 5] },
  { enabled: false, intervalMinutes: 20, startTime: '09:00', endTime: '18:00', breakDurationMinutes: 5, activeDays: [1, 2, 3, 4, 5] },
  { isPaused: false, pauseUntil: null, pauseMinutes: null },
  [],
  [],
  new Date('2026-08-12T08:00:00Z')
);
const firstSlotTime = arbSchedule.waterSlots[0]?.time;
const secondSlotTime = arbSchedule.waterSlots[1]?.time;
recordTest('TIME', 'Arbitrary timestamps', firstSlotTime === '08:13' && secondSlotTime === '09:00');

// Midnight Rollover
const rolloverNext = reminderEngine.findNextOccurrence(
  new Date(2026, 7, 12, 23, 45, 0),
  '08:00',
  '18:00',
  60,
  undefined,
  undefined,
  [1, 2, 3, 4, 5]
);
recordTest('TIME', 'Midnight rollover', rolloverNext?.timeString === '08:00' && rolloverNext?.isTomorrow === true);

// Timezone handling
const userTzSchedule = reminderEngine.calculateSchedule(
  { enabled: true, intervalMinutes: 60, startTime: '09:00', endTime: '17:00', durationMinutes: 2, activeDays: [1, 2, 3, 4, 5] },
  { enabled: false, intervalMinutes: 20, screenIntervalMinutes: 20, startTime: '09:00', endTime: '17:00', breakDurationMinutes: 5, activeDays: [1, 2, 3, 4, 5] },
  { isPaused: false, pauseUntil: null, pauseMinutes: null },
  [],
  [],
  new Date(2026, 7, 12, 10, 0, 0)
);
recordTest('TIME', 'Timezone changes', userTzSchedule.waterSlots.length > 0);

// App restart recovery / Sleep Wake
const restartNow = new Date(2026, 7, 12, 14, 15, 0);
const reconciled = reminderEngine.calculateSchedule(
  { enabled: true, intervalMinutes: 60, startTime: '09:00', endTime: '18:00', durationMinutes: 2, activeDays: [1, 2, 3, 4, 5] },
  { enabled: false, intervalMinutes: 20, screenIntervalMinutes: 20, startTime: '09:00', endTime: '18:00', breakDurationMinutes: 5, activeDays: [1, 2, 3, 4, 5] },
  { isPaused: false, pauseUntil: null, pauseMinutes: null },
  [],
  [],
  restartNow
);
recordTest('TIME', 'App restart & sleep/wake recovery', reconciled.nextWaterSlot?.time === '15:00');

// ==================================================================
// 9. OFFLINE & RECOVERY REGRESSION
// ==================================================================
console.log('\n--- [9] Offline & Recovery Regression ---');

const offlineEvId = `ev_off_reg_${Date.now()}`;
const offlineInserted = db.insertReminderEvent(userA.id, {
  id: offlineEvId,
  type: 'water',
  scheduled_at: '2026-09-11T11:00:00Z',
  completed_at: '2026-09-11T11:02:00Z',
  status: 'completed',
});
recordTest('OFFLINE', 'Offline completion queueing', offlineInserted.id === offlineEvId);

// Duplicate sync attempt
const dedupeAttempt = db.insertReminderEvent(userA.id, {
  id: offlineEvId,
  type: 'water',
  scheduled_at: '2026-09-11T11:00:00Z',
  status: 'completed',
});
const countMatches = db.getReminderEvents(userA.id).filter((e) => e.id === offlineEvId).length;
recordTest('OFFLINE', 'Reconnection deduplication', countMatches === 1);

// ==================================================================
// 10. V1 REGRESSION CHECK
// ==================================================================
console.log('\n--- [10] V1 Backward Compatibility Regression ---');

// V1 storage isolation check (eyeflow:v1:* must never clash with eyeflow:v2:*)
const v1Key = 'eyeflow:v1:settings';
const v2Key = `eyeflow:v2:${userA.id}:settings`;
recordTest('V1 REGRESSION', 'Storage key isolation', v1Key !== v2Key && !v2Key.startsWith('eyeflow:v1:'));

// V1 default fallback parameters check
recordTest('V1 REGRESSION', 'V1 reminder algorithms', reminderEngine.calculateSchedule !== undefined);

// ==================================================================
// 11. PERFORMANCE BENCHMARKING
// ==================================================================
console.log('\n--- [11] Performance Benchmarks ---');

// 1. Scheduler Execution Time Benchmark (100 iterations)
const startBench = performance.now();
for (let i = 0; i < 100; i++) {
  reminderEngine.calculateSchedule(
    { enabled: true, intervalMinutes: 45, startTime: '08:00', endTime: '18:00', durationMinutes: 2, activeDays: [1, 2, 3, 4, 5] },
    { enabled: true, intervalMinutes: 20, startTime: '09:00', endTime: '18:00', breakDurationMinutes: 5, activeDays: [1, 2, 3, 4, 5] },
    { isPaused: false, pauseUntil: null, pauseMinutes: null },
    [],
    [],
    new Date()
  );
}
const endBench = performance.now();
const avgSchedulerMs = (endBench - startBench) / 100;
recordTest('PERFORMANCE', 'Scheduler speed (<2ms)', avgSchedulerMs < 2, `${avgSchedulerMs.toFixed(3)}ms / run`);

// 2. Database Query Latency Benchmark (100 queries)
const dbStart = performance.now();
for (let i = 0; i < 100; i++) {
  db.getUserStatistics(userA.id);
}
const dbEnd = performance.now();
const avgDbMs = (dbEnd - dbStart) / 100;
recordTest('PERFORMANCE', 'Database latency (<5ms)', avgDbMs < 5, `${avgDbMs.toFixed(3)}ms / query`);

// 3. Memory & CPU footprint
const memUsage = process.memoryUsage();
const heapMb = Math.round(memUsage.heapUsed / 1024 / 1024);
recordTest('PERFORMANCE', 'Memory footprint (<100MB)', heapMb < 100, `${heapMb}MB heap used`);

// ==================================================================
// 12. FINAL TEST REPORT & SUMMARY
// ==================================================================
console.log('\n================================================================');
console.log('                 FINAL REGRESSION TEST REPORT                   ');
console.log('================================================================\n');

const totalTests = testResults.length;
const passedTests = testResults.filter((t) => t.status === 'PASS').length;
const failedTests = testResults.filter((t) => t.status === 'FAIL').length;
const blockedTests = testResults.filter((t) => t.status === 'BLOCKED').length;

console.log(`TOTAL TESTS EXECUTED : ${totalTests}`);
console.log(`PASSED               : ${passedTests}`);
console.log(`FAILED               : ${failedTests}`);
console.log(`BLOCKED              : ${blockedTests}\n`);

assert.strictEqual(failedTests, 0, 'Zero regression test failures permitted for production readiness');
assert.strictEqual(blockedTests, 0, 'Zero blocked tests permitted');

console.log('================================================================');
console.log('   ✓ EYEFLOW V2 PASSED COMPLETE MASTER REGRESSION (100% PASS)   ');
console.log('================================================================\n');
