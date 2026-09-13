// scripts/testV2UserScopedEngine.mjs
// EyeFlow V2 — Phase 6: User-Scoped Reminder Engine Test Suite (15 Test Matrix Items)

import { V2SchedulerEngine, UserScopedReminderManager } from '../src/engine/v2SchedulerEngine.ts';

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

function runV2UserScopedEngineTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 EyeFlow V2 — Phase 6: User-Scoped Reminder Engine Tests');
  console.log('═══════════════════════════════════════════════════════════\n');

  const engine = new V2SchedulerEngine();
  const manager = new UserScopedReminderManager(engine);

  // User A: Water 30m, Screen 20m, Mon-Fri (1-5), 08:13 - 17:53
  const userAWater = {
    enabled: true,
    startTime: '08:13',
    endTime: '17:53',
    intervalMinutes: 30,
    durationMinutes: 2,
    sound: 'water',
    activeDays: [1, 2, 3, 4, 5],
    quietHoursEnabled: false,
    quietStartTime: '',
    quietEndTime: '',
  };

  const userAScreen = {
    enabled: true,
    startTime: '08:13',
    endTime: '17:53',
    screenIntervalMinutes: 20,
    breakDurationMinutes: 3,
    sound: 'bell',
    activeDays: [1, 2, 3, 4, 5],
  };

  // User B: Water 90m, Screen 45m, All 7 Days (0-6), 09:47 - 22:11
  const userBWater = {
    enabled: true,
    startTime: '09:47',
    endTime: '22:11',
    intervalMinutes: 90,
    durationMinutes: 4,
    sound: 'chime',
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    quietHoursEnabled: false,
    quietStartTime: '',
    quietEndTime: '',
  };

  const userBScreen = {
    enabled: true,
    startTime: '09:47',
    endTime: '22:11',
    screenIntervalMinutes: 45,
    breakDurationMinutes: 6,
    sound: 'gong',
    activeDays: [0, 1, 2, 3, 4, 5, 6],
  };

  // Wednesday 2026-08-12 at 08:00:00 (Active day for both)
  const wednesdayTs = new Date('2026-08-12T08:00:00').getTime();

  // -------------------------------------------------------------
  // [1] User A Schedule Generation
  // -------------------------------------------------------------
  console.log('--- [1] User A Schedule Generation ---');
  {
    const resA = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: wednesdayTs,
    });

    assert(resA.userId === 'usr_Alpha', 'Schedule scoped to User A ID', resA.userId, 'usr_Alpha');
    assert(resA.waterOccurrences.length === 20, 'User A has 20 water slots (08:13 to 17:43 every 30m)', resA.waterOccurrences.length, 20);
    assert(resA.waterOccurrences[0].timeString === '08:13', 'User A first water slot is 08:13', resA.waterOccurrences[0].timeString, '08:13');
    assert(resA.waterOccurrences[0].durationSeconds === 120, 'User A water duration is 120s', resA.waterOccurrences[0].durationSeconds, 120);
    assert(resA.lookOutsideOccurrences.length === 30, 'User A has 30 screen slots (08:13 to 17:53 every 20m)', resA.lookOutsideOccurrences.length, 30);
    assert(resA.nextWaterOccurrence?.timeString === '08:13', 'User A next water occurrence at 08:00 is 08:13', resA.nextWaterOccurrence?.timeString, '08:13');
  }

  // -------------------------------------------------------------
  // [2] User B Schedule Generation
  // -------------------------------------------------------------
  console.log('\n--- [2] User B Schedule Generation ---');
  {
    const resB = engine.generateUserSchedule({
      userId: 'usr_Beta',
      waterConfiguration: userBWater,
      lookOutsideConfiguration: userBScreen,
      currentTimestamp: wednesdayTs,
    });

    assert(resB.userId === 'usr_Beta', 'Schedule scoped to User B ID', resB.userId, 'usr_Beta');
    assert(resB.waterOccurrences.length === 9, 'User B has 9 water slots (09:47 to 21:47 every 90m)', resB.waterOccurrences.length, 9);
    assert(resB.waterOccurrences[0].timeString === '09:47', 'User B first water slot is 09:47', resB.waterOccurrences[0].timeString, '09:47');
    assert(resB.waterOccurrences[0].durationSeconds === 240, 'User B water duration is 240s (4m)', resB.waterOccurrences[0].durationSeconds, 240);
    assert(resB.nextWaterOccurrence?.timeString === '09:47', 'User B next water occurrence at 08:00 is 09:47', resB.nextWaterOccurrence?.timeString, '09:47');
  }

  // -------------------------------------------------------------
  // [3] Multi-User Isolation (Zero Leaks)
  // -------------------------------------------------------------
  console.log('\n--- [3] Multi-User Isolation ---');
  {
    const resA = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: wednesdayTs,
    });
    const resB = engine.generateUserSchedule({
      userId: 'usr_Beta',
      waterConfiguration: userBWater,
      lookOutsideConfiguration: userBScreen,
      currentTimestamp: wednesdayTs,
    });

    const hasLeakedIdA = resA.waterOccurrences.some((o) => o.userId !== 'usr_Alpha' || !o.id.startsWith('usr_Alpha:'));
    const hasLeakedIdB = resB.waterOccurrences.some((o) => o.userId !== 'usr_Beta' || !o.id.startsWith('usr_Beta:'));

    assert(!hasLeakedIdA, 'User A occurrences contain strictly User A IDs', !hasLeakedIdA, true);
    assert(!hasLeakedIdB, 'User B occurrences contain strictly User B IDs', !hasLeakedIdB, true);
    assert(resA.waterOccurrences[0].id !== resB.waterOccurrences[0].id, 'User A and User B occurrence IDs never clash', true, true);
  }

  // -------------------------------------------------------------
  // [4] App Restart & Reconcile
  // -------------------------------------------------------------
  console.log('\n--- [4] App Restart & Reconcile ---');
  {
    // App restarted on Wednesday at 10:00:00
    const restartTs = new Date('2026-08-12T10:00:00').getTime();
    const res = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: restartTs,
    });

    // Slots at 08:13, 08:43, 09:13, 09:43 are before 10:00:00 -> expired
    const pastSlots = res.waterOccurrences.filter((o) => o.scheduledAt < restartTs);
    assert(pastSlots.every((o) => o.status === 'expired'), 'Past slots before restart timestamp reconciled as expired', true, true);

    // Slots at 10:13, 10:43... are pending
    const futureSlots = res.waterOccurrences.filter((o) => o.scheduledAt > restartTs);
    assert(futureSlots.every((o) => o.status === 'pending'), 'Future slots after restart timestamp reconciled as pending', true, true);
    assert(res.nextWaterOccurrence?.timeString === '10:13', 'Next water slot after restart at 10:00 is 10:13', res.nextWaterOccurrence?.timeString, '10:13');
  }

  // -------------------------------------------------------------
  // [5] Midnight Rollover
  // -------------------------------------------------------------
  console.log('\n--- [5] Midnight Rollover ---');
  {
    // Wednesday 23:59:00 -> after end time 17:53
    const nightTs = new Date('2026-08-12T23:59:00').getTime();
    const res = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: nightTs,
    });

    assert(res.nextWaterOccurrence !== null, 'Finds next occurrence after day boundary', res.nextWaterOccurrence !== null, true);
    assert(res.nextWaterOccurrence?.timeString === '08:13', 'Next day occurrence starts at 08:13', res.nextWaterOccurrence?.timeString, '08:13');
    const nextDate = new Date(res.nextWaterOccurrence?.scheduledAt);
    assert(nextDate.getDate() === 13, 'Next occurrence rolls over to Thursday (Aug 13)', nextDate.getDate(), 13);
  }

  // -------------------------------------------------------------
  // [6] Arbitrary Timestamps (Non-round minute schedules)
  // -------------------------------------------------------------
  console.log('\n--- [6] Arbitrary Timestamps ---');
  {
    const arbitraryWater = {
      enabled: true,
      startTime: '13:26',
      endTime: '22:11',
      intervalMinutes: 47,
      durationMinutes: 3,
      sound: 'water',
      activeDays: [1, 2, 3, 4, 5],
    };

    const res = engine.generateUserSchedule({
      userId: 'usr_Arbitrary',
      waterConfiguration: arbitraryWater,
      lookOutsideConfiguration: { enabled: false },
      currentTimestamp: new Date('2026-08-12T13:00:00').getTime(),
    });

    // Occurrences: 13:26, 14:13 (13:26+47m), 15:00, 15:47, 16:34, 17:21, 18:08, 18:55, 19:42, 20:29, 21:16, 22:03
    assert(res.waterOccurrences[0].timeString === '13:26', 'Arbitrary start 13:26 preserved', res.waterOccurrences[0].timeString, '13:26');
    assert(res.waterOccurrences[1].timeString === '14:13', 'Arbitrary step 13:26 + 47m = 14:13', res.waterOccurrences[1].timeString, '14:13');
    assert(res.waterOccurrences[res.waterOccurrences.length - 1].timeString === '22:03', 'Arbitrary last step within 22:11 is 22:03', res.waterOccurrences[res.waterOccurrences.length - 1].timeString, '22:03');
  }

  // -------------------------------------------------------------
  // [7] Timezone Support
  // -------------------------------------------------------------
  console.log('\n--- [7] Timezone Support ---');
  {
    const nyTs = new Date('2026-08-12T12:00:00Z').getTime();
    const res = engine.generateUserSchedule({
      userId: 'usr_TZ',
      timezone: 'America/New_York',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: nyTs,
    });

    assert(res.userId === 'usr_TZ', 'Schedule generated for timezone-aware user', res.userId, 'usr_TZ');
    assert(res.waterOccurrences.length > 0, 'Occurrences generated for timezone input', res.waterOccurrences.length > 0, true);
  }

  // -------------------------------------------------------------
  // [8] Active Days Filtering & Next Active Day Rollover
  // -------------------------------------------------------------
  console.log('\n--- [8] Active Days Filtering ---');
  {
    // Sunday 2026-08-16 (day 0) is inactive for User A (activeDays [1,2,3,4,5])
    const sundayTs = new Date('2026-08-16T12:00:00').getTime();
    const resSundayA = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: sundayTs,
    });

    assert(resSundayA.waterOccurrences.length === 0, 'User A has 0 water occurrences on inactive Sunday', resSundayA.waterOccurrences.length, 0);
    assert(resSundayA.nextWaterOccurrence?.timeString === '08:13', 'User A next water occurrence rolls over to Monday at 08:13', resSundayA.nextWaterOccurrence?.timeString, '08:13');
    const mondayDate = new Date(resSundayA.nextWaterOccurrence?.scheduledAt);
    assert(mondayDate.getDay() === 1, 'Next occurrence is on Monday (day 1)', mondayDate.getDay(), 1);

    // User B (All 7 Days) on Sunday
    const resSundayB = engine.generateUserSchedule({
      userId: 'usr_Beta',
      waterConfiguration: userBWater,
      lookOutsideConfiguration: userBScreen,
      currentTimestamp: sundayTs,
    });
    assert(resSundayB.waterOccurrences.length === 9, 'User B has active water occurrences on Sunday (All 7 Days)', resSundayB.waterOccurrences.length, 9);
  }

  // -------------------------------------------------------------
  // [9] Pause State (User Scoped)
  // -------------------------------------------------------------
  console.log('\n--- [9] Pause State ---');
  {
    // Pause User A for 60 minutes from 08:00 to 09:00
    const pauseStateA = {
      userId: 'usr_Alpha',
      isPaused: true,
      pauseUntil: new Date('2026-08-12T09:00:00').toISOString(),
      pauseMinutes: 60,
    };

    const resA = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      pauseState: pauseStateA,
      currentTimestamp: wednesdayTs, // 08:00
    });

    const resB = engine.generateUserSchedule({
      userId: 'usr_Beta',
      waterConfiguration: userBWater,
      lookOutsideConfiguration: userBScreen,
      pauseState: { isPaused: false, pauseUntil: null, pauseMinutes: null },
      currentTimestamp: wednesdayTs,
    });

    assert(resA.isPaused === true, 'User A schedule is marked paused', resA.isPaused, true);
    assert(resA.activeWaterOccurrence === null, 'User A has no active water triggers while paused', resA.activeWaterOccurrence, null);
    assert(resA.nextWaterOccurrence === null, 'User A next water occurrence suppressed while paused', resA.nextWaterOccurrence, null);
    assert(resB.isPaused === false, 'User B remains unpaused', resB.isPaused, false);
    assert(resB.nextWaterOccurrence !== null, 'User B next water occurrence active', resB.nextWaterOccurrence !== null, true);
  }

  // -------------------------------------------------------------
  // [10] Schedule Change (Dynamic Recalculation)
  // -------------------------------------------------------------
  console.log('\n--- [10] Schedule Change ---');
  {
    const updatedUserAWater = {
      ...userAWater,
      intervalMinutes: 60, // Changed from 30m to 60m
    };

    const resUpdated = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: updatedUserAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: wednesdayTs,
    });

    // 08:13 to 17:53 at 60m interval = 10 occurrences
    assert(resUpdated.waterOccurrences.length === 10, 'Schedule change from 30m to 60m recomputed 10 slots', resUpdated.waterOccurrences.length, 10);
    assert(resUpdated.waterOccurrences[1].timeString === '09:13', 'Second slot changed to 09:13 (60m step)', resUpdated.waterOccurrences[1].timeString, '09:13');
  }

  // -------------------------------------------------------------
  // [11] Duplicate Prevention
  // -------------------------------------------------------------
  console.log('\n--- [11] Duplicate Prevention ---');
  {
    const res = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: wednesdayTs,
    });

    const ids = res.waterOccurrences.map((o) => o.id);
    const uniqueIds = new Set(ids);
    assert(ids.length === uniqueIds.size, 'Zero duplicate occurrence IDs generated', ids.length, uniqueIds.size);
  }

  // -------------------------------------------------------------
  // [12] Simultaneous Reminders (Water & Look Outside at exact same time)
  // -------------------------------------------------------------
  console.log('\n--- [12] Simultaneous Reminders ---');
  {
    // Both Water and Look Outside start at 08:13
    const res = engine.generateUserSchedule({
      userId: 'usr_Simultaneous',
      waterConfiguration: {
        enabled: true,
        startTime: '18:00',
        endTime: '22:00',
        intervalMinutes: 60,
        durationMinutes: 2,
        activeDays: [1, 2, 3, 4, 5],
      },
      lookOutsideConfiguration: {
        enabled: true,
        startTime: '18:00',
        endTime: '22:00',
        screenIntervalMinutes: 30,
        breakDurationMinutes: 5,
        activeDays: [1, 2, 3, 4, 5],
      },
      currentTimestamp: new Date('2026-08-12T17:50:00').getTime(),
    });

    const waterSlot = res.waterOccurrences.find((o) => o.timeString === '18:00');
    const screenSlot = res.lookOutsideOccurrences.find((o) => o.timeString === '18:00');

    assert(waterSlot !== undefined, 'Water occurrence exists for 18:00', waterSlot !== undefined, true);
    assert(screenSlot !== undefined, 'Look Outside occurrence exists for 18:00', screenSlot !== undefined, true);
    assert(waterSlot?.id !== screenSlot?.id, 'Simultaneous occurrences have distinct IDs', true, true);
    assert(waterSlot?.type === 'water', 'Water type preserved independently', waterSlot?.type, 'water');
    assert(screenSlot?.type === 'look_outside', 'Look Outside type preserved independently', screenSlot?.type, 'look_outside');
  }

  // -------------------------------------------------------------
  // [13] Expired Reminders (No Stale Timers)
  // -------------------------------------------------------------
  console.log('\n--- [13] Expired Reminders (No Stale Timers) ---');
  {
    // Water reminder at 18:00 (duration 2m: 18:00 -> 18:02).
    // App closed. Opened at 18:05.
    const openTs = new Date('2026-08-12T18:05:00').getTime();
    const res = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: {
        enabled: true,
        startTime: '18:00',
        endTime: '22:00',
        intervalMinutes: 60,
        durationMinutes: 2,
        activeDays: [1, 2, 3, 4, 5],
      },
      lookOutsideConfiguration: { enabled: false },
      currentTimestamp: openTs,
    });

    const slot1800 = res.waterOccurrences.find((o) => o.timeString === '18:00');
    assert(slot1800?.status === 'expired', '18:00 reminder at 18:05 marked expired', slot1800?.status, 'expired');
    assert(res.activeWaterOccurrence === null, 'No stale active timer shown at 18:05', res.activeWaterOccurrence, null);
    assert(res.nextWaterOccurrence?.timeString === '19:00', 'Next water occurrence is 19:00', res.nextWaterOccurrence?.timeString, '19:00');
  }

  // -------------------------------------------------------------
  // [14] Future Reminders Queueing
  // -------------------------------------------------------------
  console.log('\n--- [14] Future Reminders ---');
  {
    const at0810Ts = new Date('2026-08-12T08:10:00').getTime();
    const res = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: userAWater,
      lookOutsideConfiguration: userAScreen,
      currentTimestamp: at0810Ts,
    });

    assert(res.nextWaterOccurrence?.timeString === '08:13', 'Next water is 08:13', res.nextWaterOccurrence?.timeString, '08:13');
    assert(res.nextLookOutsideOccurrence?.timeString === '08:13', 'Next look outside is 08:13', res.nextLookOutsideOccurrence?.timeString, '08:13');
    assert(res.nextWaterOccurrence?.status === 'pending', 'Future occurrence is pending', res.nextWaterOccurrence?.status, 'pending');
  }

  // -------------------------------------------------------------
  // [15] Active Reminders Recovery on App Restart
  // -------------------------------------------------------------
  console.log('\n--- [15] Active Reminders Recovery on Restart ---');
  {
    // Water reminder at 18:00 for 2m (120s duration: 18:00 -> 18:02).
    // App closed. Opened at 18:01:00 (exactly 60 seconds into the 120s window).
    const activeReopenTs = new Date('2026-08-12T18:01:00').getTime();
    const res = engine.generateUserSchedule({
      userId: 'usr_Alpha',
      waterConfiguration: {
        enabled: true,
        startTime: '18:00',
        endTime: '22:00',
        intervalMinutes: 60,
        durationMinutes: 2,
        activeDays: [1, 2, 3, 4, 5],
      },
      lookOutsideConfiguration: { enabled: false },
      currentTimestamp: activeReopenTs,
    });

    const activeSlot = res.activeWaterOccurrence;
    assert(activeSlot !== null, 'Active reminder restored on restart', activeSlot !== null, true);
    assert(activeSlot?.status === 'active', 'Active reminder status is active', activeSlot?.status, 'active');
    assert(activeSlot?.timeString === '18:00', 'Active reminder timeString is 18:00', activeSlot?.timeString, '18:00');
    assert(activeSlot?.remainingSeconds === 60, 'Exact remaining time restored as 60s (120s - 60s elapsed)', activeSlot?.remainingSeconds, 60);
  }

  // -------------------------------------------------------------
  // [Bonus] User Switch Timer Manager
  // -------------------------------------------------------------
  console.log('\n--- User Switch Timer Manager Isolation ---');
  {
    manager.setActiveUser('usr_Alpha');
    assert(manager.getActiveUserId() === 'usr_Alpha', 'Active user set to User A', manager.getActiveUserId(), 'usr_Alpha');

    // User A logout / User B login
    manager.setActiveUser('usr_Beta');
    assert(manager.getActiveUserId() === 'usr_Beta', 'Active user switched to User B', manager.getActiveUserId(), 'usr_Beta');
    assert(manager.getRunningTimerCount() === 0, 'All User A timers cancelled on switch to User B', manager.getRunningTimerCount(), 0);

    // Logout
    manager.clearActiveUser();
    assert(manager.getActiveUserId() === null, 'Active user cleared on logout', manager.getActiveUserId(), null);
    assert(manager.getRunningTimerCount() === 0, 'Zero timers remaining after logout', manager.getRunningTimerCount(), 0);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Phase 6 Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runV2UserScopedEngineTests();
