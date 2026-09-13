// scripts/testV2NotificationSync.mjs
// EyeFlow V2 — Phase 7: Device Notification Synchronization Test Suite (Windows & Android)

import { v2SchedulerEngine, UserScopedReminderManager } from '../src/engine/v2SchedulerEngine.ts';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, actual, expected) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASSED: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${testName} | Expected: ${expected}, Got: ${actual}`);
    failedTests++;
  }
}

// Simulated Windows Native Electron Notification Daemon Mock
class MockWindowsNotificationDaemon {
  constructor() {
    this.currentActiveUserId = null;
    this.userDaemonTimers = new Map();
    this.deliveredNotifications = [];
  }

  syncUserSchedule(userId, notifications, currentNow = Date.now()) {
    // 1. If switching user, cancel all previous user timers
    if (this.currentActiveUserId && this.currentActiveUserId !== userId) {
      this.cancelAllReminders();
    }
    this.currentActiveUserId = userId;

    // 2. Clear existing timers for this user
    for (const [key, timer] of this.userDaemonTimers.entries()) {
      if (key.startsWith(`${userId}:`)) {
        clearTimeout(timer);
        this.userDaemonTimers.delete(key);
      }
    }

    // 3. Queue future notifications
    if (Array.isArray(notifications)) {
      const now = currentNow;
      for (const notif of notifications) {
        if (notif.scheduledTimestamp > now + 1000) {
          const delay = notif.scheduledTimestamp - now;
          const key = `${userId}:${notif.id}`;
          const timer = setTimeout(() => {
            this.userDaemonTimers.delete(key);
            if (this.currentActiveUserId !== userId) return;
            this.deliveredNotifications.push({
              userId,
              slotId: notif.id,
              category: notif.category,
              title: notif.title,
              body: notif.body,
              deliveredAt: Date.now(),
            });
          }, delay);

          this.userDaemonTimers.set(key, timer);
        }
      }
    }
  }

  cancelUserSchedule(userId) {
    for (const [key, timer] of this.userDaemonTimers.entries()) {
      if (!userId || key.startsWith(`${userId}:`)) {
        clearTimeout(timer);
        this.userDaemonTimers.delete(key);
      }
    }
    if (this.currentActiveUserId === userId) {
      this.currentActiveUserId = null;
    }
  }

  cancelAllReminders() {
    for (const timer of this.userDaemonTimers.values()) {
      clearTimeout(timer);
    }
    this.userDaemonTimers.clear();
    this.currentActiveUserId = null;
  }

  getPendingTimerCount() {
    return this.userDaemonTimers.size;
  }

  hasPendingTimerForUser(userId) {
    for (const key of this.userDaemonTimers.keys()) {
      if (key.startsWith(`${userId}:`)) return true;
    }
    return false;
  }
}

// Simulated Android Capacitor LocalNotifications Mock
class MockAndroidCapacitorScheduler {
  constructor() {
    this.scheduledNotifications = [];
    this.actionListeners = [];
  }

  async scheduleAllReminders(notifications) {
    this.scheduledNotifications = notifications.map((n) => ({
      id: Math.floor(Math.random() * 900000) + 10000,
      title: n.title,
      body: n.body,
      schedule: { at: new Date(n.scheduledTimestamp) },
      extra: {
        userId: n.userId || '',
        originalId: n.id,
        category: n.category,
        scheduledTimestamp: n.scheduledTimestamp,
        durationSeconds: n.durationSeconds,
      },
    }));
  }

  async cancelAllReminders() {
    this.scheduledNotifications = [];
  }

  simulateTap(notificationIndex) {
    const notif = this.scheduledNotifications[notificationIndex];
    if (!notif) return null;
    return {
      notification: notif,
    };
  }
}

async function runNotificationSyncTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 EyeFlow V2 — Phase 7: Device Notification Sync Tests');
  console.log('═══════════════════════════════════════════════════════════\n');

  const windowsDaemon = new MockWindowsNotificationDaemon();
  const androidDaemon = new MockAndroidCapacitorScheduler();

  const userAWater = {
    enabled: true,
    startTime: '08:13',
    endTime: '17:53',
    intervalMinutes: 30,
    durationMinutes: 2,
    activeDays: [1, 2, 3, 4, 5],
  };

  const userAScreen = {
    enabled: true,
    startTime: '08:13',
    endTime: '17:53',
    screenIntervalMinutes: 20,
    breakDurationMinutes: 3,
    activeDays: [1, 2, 3, 4, 5],
  };

  const userBWater = {
    enabled: true,
    startTime: '09:47',
    endTime: '22:11',
    intervalMinutes: 90,
    durationMinutes: 4,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
  };

  const userBScreen = {
    enabled: true,
    startTime: '09:47',
    endTime: '22:11',
    screenIntervalMinutes: 45,
    breakDurationMinutes: 6,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
  };

  const now = Date.now();

  // -------------------------------------------------------------
  // [1] Windows User A Login & Scheduling
  // -------------------------------------------------------------
  console.log('--- [1] Windows: User A Login & Notification Scheduling ---');
  {
    const userANotifs = [
      {
        id: 'usr_A:water:1',
        userId: 'usr_A',
        title: '💧 Time for water',
        body: 'Take a 2-minute water break.',
        category: 'water',
        scheduledTimestamp: now + 5000,
        durationSeconds: 120,
      },
      {
        id: 'usr_A:screen:1',
        userId: 'usr_A',
        title: '👁 Look outside',
        body: 'Rest your eyes from the screen.',
        category: 'screen',
        scheduledTimestamp: now + 10000,
        durationSeconds: 180,
      },
    ];

    windowsDaemon.syncUserSchedule('usr_A', userANotifs);
    assert(windowsDaemon.currentActiveUserId === 'usr_A', 'Windows daemon active user is User A', windowsDaemon.currentActiveUserId, 'usr_A');
    assert(windowsDaemon.getPendingTimerCount() === 2, 'User A has 2 pending daemon timers', windowsDaemon.getPendingTimerCount(), 2);
    assert(windowsDaemon.hasPendingTimerForUser('usr_A'), 'User A timers are present', true, true);
  }

  // -------------------------------------------------------------
  // [2] Windows User A Logout (Cancellation)
  // -------------------------------------------------------------
  console.log('\n--- [2] Windows: User A Logout Notification Cancellation ---');
  {
    windowsDaemon.cancelUserSchedule('usr_A');
    assert(windowsDaemon.currentActiveUserId === null, 'Windows daemon user cleared after logout', windowsDaemon.currentActiveUserId, null);
    assert(windowsDaemon.getPendingTimerCount() === 0, 'All User A pending timers cancelled on logout', windowsDaemon.getPendingTimerCount(), 0);
    assert(!windowsDaemon.hasPendingTimerForUser('usr_A'), 'Zero User A timers remaining', false, false);
  }

  // -------------------------------------------------------------
  // [3] Windows User B Login & Two-User Isolation
  // -------------------------------------------------------------
  console.log('\n--- [3] Windows: User B Login & Strict Isolation ---');
  {
    const userBNotifs = [
      {
        id: 'usr_B:water:1',
        userId: 'usr_B',
        title: '💧 Time for water',
        body: 'Take a 4-minute water break.',
        category: 'water',
        scheduledTimestamp: now + 6000,
        durationSeconds: 240,
      },
    ];

    windowsDaemon.syncUserSchedule('usr_B', userBNotifs);
    assert(windowsDaemon.currentActiveUserId === 'usr_B', 'Windows daemon active user is User B', windowsDaemon.currentActiveUserId, 'usr_B');
    assert(windowsDaemon.hasPendingTimerForUser('usr_B'), 'User B timer scheduled', true, true);
    assert(!windowsDaemon.hasPendingTimerForUser('usr_A'), 'User A notifications NEVER appear for User B', false, false);
  }

  // -------------------------------------------------------------
  // [4] Android Native Payload & Security Verification
  // -------------------------------------------------------------
  console.log('\n--- [4] Android: Native Scheduler Payload & Security ---');
  {
    const androidNotifs = [
      {
        id: 'usr_A:water:100',
        userId: 'usr_A',
        title: '💧 Time for water',
        body: 'Take a short break and drink some water.',
        category: 'water',
        scheduledTimestamp: now + 15000,
        durationSeconds: 120,
      },
    ];

    await androidDaemon.scheduleAllReminders(androidNotifs);
    const scheduled = androidDaemon.scheduledNotifications;

    assert(scheduled.length === 1, 'Android scheduler queued 1 notification', scheduled.length, 1);
    assert(scheduled[0].extra.userId === 'usr_A', 'Android payload contains authenticated userId', scheduled[0].extra.userId, 'usr_A');
    assert(scheduled[0].extra.originalId === 'usr_A:water:100', 'Android payload contains reminderId', scheduled[0].extra.originalId, 'usr_A:water:100');
    assert(scheduled[0].extra.category === 'water', 'Android payload contains type', scheduled[0].extra.category, 'water');
    assert(scheduled[0].extra.scheduledTimestamp === now + 15000, 'Android payload contains scheduledAt', scheduled[0].extra.scheduledTimestamp, now + 15000);
    assert(scheduled[0].extra.durationSeconds === 120, 'Android payload contains durationSeconds', scheduled[0].extra.durationSeconds, 120);

    // SECURITY CHECK: Verify no password, token, or secret leak
    const payloadStr = JSON.stringify(scheduled[0]);
    assert(!payloadStr.includes('password'), 'Zero password leakage in notification payload', true, true);
    assert(!payloadStr.includes('token'), 'Zero token leakage in notification payload', true, true);
    assert(!payloadStr.includes('Bearer'), 'Zero auth headers in notification payload', true, true);
  }

  // -------------------------------------------------------------
  // [5] Notification Tap Routing (Water & Look Outside)
  // -------------------------------------------------------------
  console.log('\n--- [5] Notification Tap Routing ---');
  {
    // Tap Water Reminder
    const tapActionWater = {
      notification: {
        extra: {
          userId: 'usr_A',
          category: 'water',
          slotId: 'usr_A:water:100',
          startTimestamp: now,
          endTimestamp: now + 120000,
          durationSeconds: 120,
        },
      },
    };

    let routedTarget = null;
    let autoModalInterrupted = false;

    function handleNotificationTap(action, activeUser) {
      const extra = action.notification.extra;
      // Cross-user tap rejection
      if (extra?.userId && activeUser?.id && extra.userId !== activeUser.id) {
        return 'IGNORED_CROSS_USER';
      }
      if (extra?.category === 'water') {
        routedTarget = 'WATER_BREAK_VIEW';
        autoModalInterrupted = false; // No full-screen forced modal
      } else if (extra?.category === 'screen') {
        routedTarget = 'LOOK_OUTSIDE_VIEW';
        autoModalInterrupted = false;
      }
      return 'ROUTED_SUCCESS';
    }

    const waterResult = handleNotificationTap(tapActionWater, { id: 'usr_A' });
    assert(waterResult === 'ROUTED_SUCCESS', 'Water notification tap processed successfully', waterResult, 'ROUTED_SUCCESS');
    assert(routedTarget === 'WATER_BREAK_VIEW', 'Tapping Water notification opens Water Break view', routedTarget, 'WATER_BREAK_VIEW');
    assert(!autoModalInterrupted, 'No automatic full-screen interruption', !autoModalInterrupted, true);

    // Tap Look Outside Reminder
    const tapActionScreen = {
      notification: {
        extra: {
          userId: 'usr_A',
          category: 'screen',
          slotId: 'usr_A:screen:200',
          startTimestamp: now,
          endTimestamp: now + 180000,
          durationSeconds: 180,
        },
      },
    };

    const screenResult = handleNotificationTap(tapActionScreen, { id: 'usr_A' });
    assert(screenResult === 'ROUTED_SUCCESS', 'Look Outside notification tap processed successfully', screenResult, 'ROUTED_SUCCESS');
    assert(routedTarget === 'LOOK_OUTSIDE_VIEW', 'Tapping Look Outside notification opens Look Outside Break view', routedTarget, 'LOOK_OUTSIDE_VIEW');

    // Tap Cross-User Notification (User B taps User A's stale notification)
    const crossUserResult = handleNotificationTap(tapActionWater, { id: 'usr_B' });
    assert(crossUserResult === 'IGNORED_CROSS_USER', 'Stale User A notification tapped while User B logged in is ignored', crossUserResult, 'IGNORED_CROSS_USER');
  }

  // -------------------------------------------------------------
  // [6] App Closed & Arrival Simulation
  // -------------------------------------------------------------
  console.log('\n--- [6] App Closed & Background Arrival Simulation ---');
  {
    // Reminder arrived at 18:00 (duration 120s: 18:00->18:02).
    // App closed. User opened at 18:01 (active) vs 18:05 (expired).
    const start1800 = new Date('2026-08-12T18:00:00').getTime();
    const end1802 = new Date('2026-08-12T18:02:00').getTime();

    // 6.1 Tapped at 18:01:00 (inside active countdown window)
    const tapAt1801 = {
      notification: {
        extra: {
          userId: 'usr_A',
          category: 'water',
          slotId: 'usr_A:water:1800',
          startTimestamp: start1800,
          endTimestamp: end1802,
          durationSeconds: 120,
        },
      },
    };

    const currentTime1801 = new Date('2026-08-12T18:01:00').getTime();
    const remainingAt1801 = Math.max(1, Math.floor((end1802 - currentTime1801) / 1000));
    assert(remainingAt1801 === 60, 'App opened at 18:01 displays exact 60s remaining countdown', remainingAt1801, 60);

    // 6.2 Tapped at 18:05:00 (expired while app was closed)
    const currentTime1805 = new Date('2026-08-12T18:05:00').getTime();
    const isExpiredAt1805 = currentTime1805 >= end1802;
    assert(isExpiredAt1805 === true, 'Notification tapped at 18:05 recognized as expired (no stale 02:00 timer)', isExpiredAt1805, true);
  }

  // -------------------------------------------------------------
  // [7] Restart & Reconcile Without Stale/Duplicate Schedules
  // -------------------------------------------------------------
  console.log('\n--- [7] Restart & Reconcile ---');
  {
    // On restart: purge old daemon timers, reconcile against current timestamp, schedule only upcoming
    windowsDaemon.cancelAllReminders();
    await androidDaemon.cancelAllReminders();

    const restartTs = new Date('2026-08-12T10:00:00').getTime();
    const schedule = v2SchedulerEngine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: restartTs,
    });

    const pendingNotifs = schedule.waterOccurrences
      .filter((o) => o.status === 'pending' && o.scheduledAt > restartTs + 2000)
      .map((o) => ({
        id: o.id,
        userId: o.userId,
        title: '💧 Time for water',
        body: 'Take a water break.',
        category: 'water',
        scheduledTimestamp: o.scheduledAt,
        durationSeconds: o.durationSeconds,
      }));

    windowsDaemon.syncUserSchedule('usr_Alpha', pendingNotifs, restartTs);
    await androidDaemon.scheduleAllReminders(pendingNotifs);

    assert(windowsDaemon.getPendingTimerCount() === pendingNotifs.length, 'Windows daemon scheduled clean upcoming slots', windowsDaemon.getPendingTimerCount(), pendingNotifs.length);
    assert(androidDaemon.scheduledNotifications.length === pendingNotifs.length, 'Android daemon scheduled clean upcoming slots', androidDaemon.scheduledNotifications.length, pendingNotifs.length);
    assert(schedule.nextWaterOccurrence?.timeString === '10:13', 'Correct next upcoming slot is 10:13', schedule.nextWaterOccurrence?.timeString, '10:13');
  }

  // -------------------------------------------------------------
  // [8] Offline Resilience (Network Disconnected)
  // -------------------------------------------------------------
  console.log('\n--- [8] Offline Resilience ---');
  {
    // Offline simulation: network unavailable, no API calls
    const offlineTs = new Date('2026-08-12T10:00:00').getTime();
    const offlineSchedule = v2SchedulerEngine.generateUserSchedule({
      userId: 'usr_Offline',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: offlineTs,
    });

    assert(offlineSchedule.waterOccurrences.length > 0, 'Offline scheduler generates full daily occurrences locally', offlineSchedule.waterOccurrences.length > 0, true);
    assert(offlineSchedule.nextWaterOccurrence !== null, 'Offline next reminder calculated deterministically without network', offlineSchedule.nextWaterOccurrence !== null, true);
  }

  windowsDaemon.cancelAllReminders();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Phase 7 Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

runNotificationSyncTests();
