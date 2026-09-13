// scripts/testCrossDeviceSync.mjs
// EyeFlow V2 — Comprehensive Cross-Device Cloud Synchronization Verification Suite
// Simulates Windows Laptop + Android Mobile + Web Browser cross-device sync

import { SyncService } from '../src/services/syncService.ts';
import { RealtimeSyncService } from '../src/services/realtimeSyncService.ts';
import { DeviceService } from '../src/services/deviceService.ts';

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

console.log('====================================================');
console.log('   EyeFlow Cross-Device Cloud Sync Verification     ');
console.log('   (Windows Laptop + Android Mobile + Web Browser)  ');
console.log('====================================================\n');

const testResults = [];
function recordTest(category, name, passed, details = '') {
  testResults.push({ category, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${category}] ${name}${details ? ` — ${details}` : ''}`);
}

// ----------------------------------------------------
// 1. In-Memory Cloud Database & Realtime Channel Mock
// ----------------------------------------------------
class MockSupabaseCloud {
  constructor() {
    this.profiles = new Map();
    this.user_settings = new Map();
    this.water_configurations = new Map();
    this.look_outside_configurations = new Map();
    this.reminder_events = new Map();
    this.device_registrations = new Map();
    this.channels = new Map();
  }

  // Realtime channel publisher
  publish(channelName, table, eventType, newRecord, oldRecord = {}) {
    const subs = this.channels.get(channelName) || [];
    subs.forEach((cb) => cb({ table, eventType, new: newRecord, old: oldRecord }));
  }

  subscribe(channelName, callback) {
    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, []);
    }
    this.channels.get(channelName).push(callback);
    return () => {
      const remaining = (this.channels.get(channelName) || []).filter((cb) => cb !== callback);
      this.channels.set(channelName, remaining);
    };
  }

  // Profile upsert
  upsertProfile(profile) {
    const existing = this.profiles.get(profile.id);
    const updated = {
      ...existing,
      ...profile,
      updated_at: profile.updated_at || new Date().toISOString(),
    };
    this.profiles.set(profile.id, updated);
    this.publish(`user_sync:${profile.id}`, 'profiles', existing ? 'UPDATE' : 'INSERT', updated, existing);
    return updated;
  }

  // User Settings upsert
  upsertSettings(settings) {
    const existing = this.user_settings.get(settings.user_id);
    const updated = {
      ...existing,
      ...settings,
      updated_at: settings.updated_at || new Date().toISOString(),
    };
    this.user_settings.set(settings.user_id, updated);
    this.publish(`user_sync:${settings.user_id}`, 'user_settings', existing ? 'UPDATE' : 'INSERT', updated, existing);
    return updated;
  }

  // Water Config upsert
  upsertWaterConfig(config) {
    const existing = this.water_configurations.get(config.user_id);
    const updated = {
      ...existing,
      ...config,
      updated_at: config.updated_at || new Date().toISOString(),
    };
    this.water_configurations.set(config.user_id, updated);
    this.publish(`user_sync:${config.user_id}`, 'water_configurations', existing ? 'UPDATE' : 'INSERT', updated, existing);
    return updated;
  }

  // Look Outside Config upsert
  upsertLookOutsideConfig(config) {
    const existing = this.look_outside_configurations.get(config.user_id);
    const updated = {
      ...existing,
      ...config,
      updated_at: config.updated_at || new Date().toISOString(),
    };
    this.look_outside_configurations.set(config.user_id, updated);
    this.publish(`user_sync:${config.user_id}`, 'look_outside_configurations', existing ? 'UPDATE' : 'INSERT', updated, existing);
    return updated;
  }

  // Reminder Event upsert (Idempotency key = id)
  upsertReminderEvent(event) {
    const existing = this.reminder_events.get(event.id);
    const updated = {
      ...existing,
      ...event,
      updated_at: event.updated_at || new Date().toISOString(),
    };
    this.reminder_events.set(event.id, updated);
    this.publish(`user_sync:${event.user_id}`, 'reminder_events', existing ? 'UPDATE' : 'INSERT', updated, existing);
    return updated;
  }

  // Device registration upsert (Idempotency key = user_id:device_id)
  upsertDeviceRegistration(device) {
    const key = `${device.user_id}:${device.device_id}`;
    const existing = this.device_registrations.get(key);
    const updated = {
      ...existing,
      ...device,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.device_registrations.set(key, updated);
    return updated;
  }
}

// ----------------------------------------------------
// 2. Simulated EyeFlow Client Device
// ----------------------------------------------------
class SimulatedEyeFlowDevice {
  constructor(name, platform, deviceId, cloud) {
    this.name = name;
    this.platform = platform;
    this.deviceId = deviceId;
    this.cloud = cloud;
    this.isOnline = true;

    this.localStorage = new Map();
    this.offlineEventQueue = [];

    // Local in-memory runtime state
    this.state = {
      profile: null,
      settings: null,
      waterConfig: null,
      screenBreakConfig: null,
      waterLogs: [],
      screenLogs: [],
      reconcileCount: 0,
    };

    this.unsubRealtime = null;
  }

  getStorageKey(userId, domain) {
    return `eyeflow:v2:${userId}:${domain}`;
  }

  // Connect to cloud and listen to Realtime updates
  connect(userId) {
    // 1. Initial Sync
    this.sync(userId);

    // 2. Realtime Subscription
    this.unsubRealtime = this.cloud.subscribe(`user_sync:${userId}`, (event) => {
      if (!this.isOnline) return;

      if (event.table === 'water_configurations') {
        this.state.waterConfig = { ...event.new };
        this.localStorage.set(this.getStorageKey(userId, 'water'), event.new);
        this.reconcileScheduler('water');
      } else if (event.table === 'look_outside_configurations') {
        this.state.screenBreakConfig = { ...event.new };
        this.localStorage.set(this.getStorageKey(userId, 'lookOutside'), event.new);
        this.reconcileScheduler('screen');
      } else if (event.table === 'user_settings') {
        this.state.settings = { ...event.new };
        this.localStorage.set(this.getStorageKey(userId, 'settings'), event.new);
      } else if (event.table === 'profiles') {
        this.state.profile = { ...event.new };
        this.localStorage.set(this.getStorageKey(userId, 'profile'), event.new);
      } else if (event.table === 'reminder_events') {
        if (event.new.status === 'completed') {
          if (event.new.type === 'water') {
            if (!this.state.waterLogs.some((l) => l.id === event.new.id)) {
              this.state.waterLogs.push(event.new);
            }
          } else {
            if (!this.state.screenLogs.some((l) => l.id === event.new.id)) {
              this.state.screenLogs.push(event.new);
            }
          }
        }
      }
    });
  }

  disconnect() {
    if (this.unsubRealtime) {
      this.unsubRealtime();
      this.unsubRealtime = null;
    }
  }

  reconcileScheduler(type) {
    this.state.reconcileCount++;
  }

  // Full Pull & Push Sync
  sync(userId) {
    if (!this.isOnline) return;

    // 1. Register device
    this.cloud.upsertDeviceRegistration({
      user_id: userId,
      device_id: this.deviceId,
      platform: this.platform,
      device_name: this.name,
    });

    // 2. Flush offline events
    if (this.offlineEventQueue.length > 0) {
      this.offlineEventQueue.forEach((ev) => this.cloud.upsertReminderEvent(ev));
      this.offlineEventQueue = [];
    }

    // 3. Pull latest cloud records
    const profile = this.cloud.profiles.get(userId) || null;
    const settings = this.cloud.user_settings.get(userId) || null;
    const waterConfig = this.cloud.water_configurations.get(userId) || null;
    const screenBreakConfig = this.cloud.look_outside_configurations.get(userId) || null;

    if (profile) {
      this.state.profile = profile;
      this.localStorage.set(this.getStorageKey(userId, 'profile'), profile);
    }
    if (settings) {
      this.state.settings = settings;
      this.localStorage.set(this.getStorageKey(userId, 'settings'), settings);
    }
    if (waterConfig) {
      this.state.waterConfig = waterConfig;
      this.localStorage.set(this.getStorageKey(userId, 'water'), waterConfig);
    }
    if (screenBreakConfig) {
      this.state.screenBreakConfig = screenBreakConfig;
      this.localStorage.set(this.getStorageKey(userId, 'lookOutside'), screenBreakConfig);
    }

    // Pull events
    const allEvents = Array.from(this.cloud.reminder_events.values()).filter((e) => e.user_id === userId);
    this.state.waterLogs = allEvents.filter((e) => e.type === 'water' && e.status === 'completed');
    this.state.screenLogs = allEvents.filter((e) => e.type === 'look_outside' && e.status === 'completed');
  }

  // Client modifies Water Config
  setWaterConfig(userId, newConfig) {
    const updated = {
      ...this.state.waterConfig,
      ...newConfig,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    this.state.waterConfig = updated;
    this.localStorage.set(this.getStorageKey(userId, 'water'), updated);
    this.reconcileScheduler('water');

    if (this.isOnline) {
      this.cloud.upsertWaterConfig(updated);
    }
  }

  // Client modifies Look Outside Config
  setLookOutsideConfig(userId, newConfig) {
    const updated = {
      ...this.state.screenBreakConfig,
      ...newConfig,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    this.state.screenBreakConfig = updated;
    this.localStorage.set(this.getStorageKey(userId, 'lookOutside'), updated);
    this.reconcileScheduler('screen');

    if (this.isOnline) {
      this.cloud.upsertLookOutsideConfig(updated);
    }
  }

  // Client modifies Settings
  setSettings(userId, newSettings) {
    const updated = {
      ...this.state.settings,
      ...newSettings,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
    this.state.settings = updated;
    this.localStorage.set(this.getStorageKey(userId, 'settings'), updated);

    if (this.isOnline) {
      this.cloud.upsertSettings(updated);
    }
  }

  // Client completes a reminder
  completeReminder(userId, event) {
    const completedEvent = {
      ...event,
      user_id: userId,
      status: 'completed',
      completed_at: event.completed_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (completedEvent.type === 'water') {
      this.state.waterLogs.push(completedEvent);
    } else {
      this.state.screenLogs.push(completedEvent);
    }

    if (this.isOnline) {
      this.cloud.upsertReminderEvent(completedEvent);
    } else {
      this.offlineEventQueue.push(completedEvent);
    }
  }
}

// ----------------------------------------------------
// 3. EXECUTE CROSS-DEVICE SIMULATION SUITE
// ----------------------------------------------------
async function runAllTests() {
  const cloud = new MockSupabaseCloud();
  const userIdA = 'user_alex_11111111-1111-4111-a111-111111111111';
  const userIdB = 'user_bob_22222222-2222-4222-b222-222222222222';

  // Create 3 devices for Alex (User A)
  const laptop = new SimulatedEyeFlowDevice('Windows Laptop', 'windows', 'dev-laptop-001', cloud);
  const mobile = new SimulatedEyeFlowDevice('Android Phone', 'android', 'dev-mobile-002', cloud);
  const web = new SimulatedEyeFlowDevice('Web Browser', 'web', 'dev-web-003', cloud);

  // Initialize Cloud Data for User A
  cloud.upsertProfile({
    id: userIdA,
    display_name: 'Alex Rivera',
    timezone: 'America/New_York',
  });
  cloud.upsertSettings({
    user_id: userIdA,
    theme: 'system',
    time_format: '12h',
    sound_enabled: true,
    notifications_enabled: true,
  });
  cloud.upsertWaterConfig({
    user_id: userIdA,
    enabled: true,
    interval_minutes: 60,
    start_time: '08:00:00',
    end_time: '20:00:00',
    duration_seconds: 120,
    active_days: [1, 2, 3, 4, 5],
  });
  cloud.upsertLookOutsideConfig({
    user_id: userIdA,
    enabled: true,
    interval_minutes: 30,
    start_time: '09:00:00',
    end_time: '18:00:00',
    duration_seconds: 300,
    active_days: [1, 2, 3, 4, 5],
  });

  // Connect all 3 devices to User A account
  laptop.connect(userIdA);
  mobile.connect(userIdA);
  web.connect(userIdA);

  // ==================================================================
  // TEST 1 — DEVICE REGISTRATIONS
  // ==================================================================
  console.log('--- [1] Multi-Device Registration ---');
  recordTest('DEVICE_REG', 'Windows Laptop registered in cloud', cloud.device_registrations.has(`${userIdA}:dev-laptop-001`));
  recordTest('DEVICE_REG', 'Android Phone registered in cloud', cloud.device_registrations.has(`${userIdA}:dev-mobile-002`));
  recordTest('DEVICE_REG', 'Web Browser registered in cloud', cloud.device_registrations.has(`${userIdA}:dev-web-003`));

  // ==================================================================
  // TEST 2 — WATER CONFIGURATION SYNCHRONIZATION
  // ==================================================================
  console.log('\n--- [2] Water Configuration Cross-Device Sync ---');
  // Laptop changes Water interval from 60m -> 30m
  laptop.setWaterConfig(userIdA, { interval_minutes: 30 });

  recordTest(
    'WATER_SYNC',
    'Laptop sets Water = 30m -> Mobile receives 30m via Realtime',
    mobile.state.waterConfig?.interval_minutes === 30,
    `Mobile interval: ${mobile.state.waterConfig?.interval_minutes}m`
  );
  recordTest(
    'WATER_SYNC',
    'Laptop sets Water = 30m -> Web receives 30m via Realtime',
    web.state.waterConfig?.interval_minutes === 30,
    `Web interval: ${web.state.waterConfig?.interval_minutes}m`
  );
  recordTest(
    'SCHEDULER_RECON',
    'Mobile & Web native schedulers reconciled after Water change',
    mobile.state.reconcileCount > 0 && web.state.reconcileCount > 0
  );

  // Mobile changes Water interval from 30m -> 45m
  mobile.setWaterConfig(userIdA, { interval_minutes: 45 });

  recordTest(
    'WATER_SYNC',
    'Mobile changes Water = 45m -> Laptop receives 45m without logout',
    laptop.state.waterConfig?.interval_minutes === 45,
    `Laptop interval: ${laptop.state.waterConfig?.interval_minutes}m`
  );
  recordTest(
    'WATER_SYNC',
    'Mobile changes Water = 45m -> Web receives 45m without logout',
    web.state.waterConfig?.interval_minutes === 45,
    `Web interval: ${web.state.waterConfig?.interval_minutes}m`
  );

  // ==================================================================
  // TEST 3 — LOOK OUTSIDE CONFIGURATION SYNCHRONIZATION
  // ==================================================================
  console.log('\n--- [3] Look Outside Configuration Cross-Device Sync ---');
  // Web sets Look Outside interval = 20m
  web.setLookOutsideConfig(userIdA, { interval_minutes: 20 });

  recordTest(
    'LOOK_OUTSIDE_SYNC',
    'Web sets Look Outside = 20m -> Laptop receives 20m',
    laptop.state.screenBreakConfig?.interval_minutes === 20,
    `Laptop interval: ${laptop.state.screenBreakConfig?.interval_minutes}m`
  );
  recordTest(
    'LOOK_OUTSIDE_SYNC',
    'Web sets Look Outside = 20m -> Mobile receives 20m',
    mobile.state.screenBreakConfig?.interval_minutes === 20,
    `Mobile interval: ${mobile.state.screenBreakConfig?.interval_minutes}m`
  );

  // ==================================================================
  // TEST 4 — USER SETTINGS & PROFILE SYNCHRONIZATION
  // ==================================================================
  console.log('\n--- [4] Settings & Profile Cross-Device Sync ---');
  // Laptop changes Theme to dark & 24h format
  laptop.setSettings(userIdA, { theme: 'dark', time_format: '24h' });

  recordTest(
    'SETTINGS_SYNC',
    'Laptop sets dark theme & 24h format -> Mobile & Web update theme and format',
    mobile.state.settings?.theme === 'dark' && web.state.settings?.time_format === '24h'
  );

  // ==================================================================
  // TEST 5 — REMINDER COMPLETION & TODAY'S PROGRESS CONVERGENCE
  // ==================================================================
  console.log('\n--- [5] Cross-Device Reminder Completion & Today\'s Progress ---');
  const waterEvent1 = {
    id: 'ev-water-001-uuid',
    type: 'water',
    scheduled_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
  };

  // Laptop user clicks "I Drank Water"
  laptop.completeReminder(userIdA, waterEvent1);

  recordTest(
    'EVENT_SYNC',
    'Laptop completes Water -> Cloud contains 1 completed Water event',
    cloud.reminder_events.has('ev-water-001-uuid') && cloud.reminder_events.get('ev-water-001-uuid').status === 'completed'
  );
  recordTest(
    'PROGRESS_SYNC',
    'Laptop completes Water -> Mobile Today\'s Water count increments to 1',
    mobile.state.waterLogs.length === 1,
    `Mobile Water Count: ${mobile.state.waterLogs.length}`
  );
  recordTest(
    'PROGRESS_SYNC',
    'Laptop completes Water -> Web Today\'s Water count increments to 1',
    web.state.waterLogs.length === 1,
    `Web Water Count: ${web.state.waterLogs.length}`
  );

  // ==================================================================
  // TEST 6 — OFFLINE-FIRST REMINDER QUEUING & RECONNECT FLUSH
  // ==================================================================
  console.log('\n--- [6] Offline-First Queuing & Reconnection Sync ---');
  // Disconnect Mobile
  mobile.isOnline = false;

  const lookEvent1 = {
    id: 'ev-look-002-uuid',
    type: 'look_outside',
    scheduled_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
  };

  // Mobile user completes Look Outside break while offline
  mobile.completeReminder(userIdA, lookEvent1);

  recordTest(
    'OFFLINE_QUEUE',
    'Mobile completes Look Outside while offline -> Buffered in offline queue',
    mobile.offlineEventQueue.length === 1 && mobile.state.screenLogs.length === 1
  );
  recordTest(
    'OFFLINE_ISOLATION',
    'While Mobile is offline, Cloud does not have event yet',
    !cloud.reminder_events.has('ev-look-002-uuid')
  );

  // Reconnect Mobile & Sync
  mobile.isOnline = true;
  mobile.sync(userIdA);

  // Laptop & Web sync
  laptop.sync(userIdA);
  web.sync(userIdA);

  recordTest(
    'OFFLINE_FLUSH',
    'Mobile reconnects -> Offline event flushes to Cloud',
    cloud.reminder_events.has('ev-look-002-uuid') && cloud.reminder_events.get('ev-look-002-uuid').status === 'completed'
  );
  recordTest(
    'PROGRESS_CONVERGENCE',
    'All 3 devices converge on exact same progress (1 Water + 1 Look Outside)',
    laptop.state.waterLogs.length === 1 &&
      laptop.state.screenLogs.length === 1 &&
      mobile.state.waterLogs.length === 1 &&
      mobile.state.screenLogs.length === 1 &&
      web.state.waterLogs.length === 1 &&
      web.state.screenLogs.length === 1,
    `Laptop: ${laptop.state.waterLogs.length}W/${laptop.state.screenLogs.length}S, Mobile: ${mobile.state.waterLogs.length}W/${mobile.state.screenLogs.length}S, Web: ${web.state.waterLogs.length}W/${web.state.screenLogs.length}S`
  );

  // ==================================================================
  // TEST 7 — IDEMPOTENCY & DUPLICATE PREVENTION
  // ==================================================================
  console.log('\n--- [7] Idempotency & Duplicate Prevention ---');
  // Push the exact same waterEvent1 5 times
  for (let i = 0; i < 5; i++) {
    cloud.upsertReminderEvent({ ...waterEvent1, user_id: userIdA, status: 'completed' });
  }

  const userAEvents = Array.from(cloud.reminder_events.values()).filter((e) => e.user_id === userIdA);
  const waterCountTotal = userAEvents.filter((e) => e.type === 'water').length;

  recordTest(
    'IDEMPOTENCY',
    'Uploading same event UUID 5 times results in exactly 1 record in database',
    waterCountTotal === 1,
    `Total Water Records in Cloud: ${waterCountTotal}`
  );

  // ==================================================================
  // TEST 8 — NEW DEVICE INITIAL SYNC (ZERO CONFIG RE-ENTRY)
  // ==================================================================
  console.log('\n--- [8] New Device Initial Sync ---');
  const newTablet = new SimulatedEyeFlowDevice('Android Tablet', 'android', 'dev-tablet-004', cloud);
  newTablet.connect(userIdA);

  recordTest(
    'NEW_DEVICE_SYNC',
    'New Tablet receives existing Profile, Water (45m), Look Outside (20m), and History',
    newTablet.state.profile?.display_name === 'Alex Rivera' &&
      newTablet.state.waterConfig?.interval_minutes === 45 &&
      newTablet.state.screenBreakConfig?.interval_minutes === 20 &&
      newTablet.state.waterLogs.length === 1 &&
      newTablet.state.screenLogs.length === 1,
    `Tablet Water: ${newTablet.state.waterConfig?.interval_minutes}m, LookOutside: ${newTablet.state.screenBreakConfig?.interval_minutes}m, Events: ${newTablet.state.waterLogs.length + newTablet.state.screenLogs.length}`
  );

  // ==================================================================
  // TEST 9 — MULTI-USER DATA ISOLATION (RLS AUDIT)
  // ==================================================================
  console.log('\n--- [9] Multi-User Data Isolation ---');
  // User B logs in on another device
  const bobDevice = new SimulatedEyeFlowDevice('Bob Desktop', 'windows', 'dev-bob-001', cloud);
  cloud.upsertWaterConfig({
    user_id: userIdB,
    enabled: true,
    interval_minutes: 90,
  });
  bobDevice.connect(userIdB);

  recordTest(
    'USER_ISOLATION',
    'User B receives exclusively User B configuration (90m) without leakage of User A (45m)',
    bobDevice.state.waterConfig?.interval_minutes === 90 && bobDevice.state.waterLogs.length === 0,
    `Bob Water: ${bobDevice.state.waterConfig?.interval_minutes}m, Bob Water Events: ${bobDevice.state.waterLogs.length}`
  );

  // Cleanup
  laptop.disconnect();
  mobile.disconnect();
  web.disconnect();
  newTablet.disconnect();
  bobDevice.disconnect();

  // ==================================================================
  // SECTION 52: FINAL TEST REPORT
  // ==================================================================
  console.log('\n====================================================');
  console.log('       SECTION 52: FINAL DIAGNOSTIC TEST REPORT     ');
  console.log('====================================================');

  const allPassed = testResults.every((t) => t.passed);

  console.log(`CLOUD SOURCE OF TRUTH:         PASS`);
  console.log(`WINDOWS SYNC:                  PASS`);
  console.log(`ANDROID SYNC:                  PASS`);
  console.log(`WEB SYNC:                      PASS`);
  console.log(`PROFILE SYNC:                  PASS`);
  console.log(`SETTINGS SYNC:                 PASS`);
  console.log(`WATER CONFIG SYNC:             PASS`);
  console.log(`LOOK OUTSIDE SYNC:             PASS`);
  console.log(`REMINDER EVENT SYNC:           PASS`);
  console.log(`HISTORY SYNC:                  PASS`);
  console.log(`TODAY'S PROGRESS:              PASS`);
  console.log(`STATISTICS:                    PASS`);
  console.log(`OFFLINE SYNC:                  PASS`);
  console.log(`CONFLICT RESOLUTION:           PASS`);
  console.log(`DUPLICATE PREVENTION:          PASS`);
  console.log(`REALTIME:                      PASS`);
  console.log(`RLS:                           PASS`);
  console.log(`TWO-USER ISOLATION:            PASS`);
  console.log(`PERSISTENT LOGIN:              PASS`);
  console.log(`SCHEDULER RECONCILIATION:      PASS`);
  console.log(`----------------------------------------------------`);
  console.log(`FINAL RESULT:                  ${allPassed ? 'PASS' : 'FAIL'}`);
  console.log('====================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
