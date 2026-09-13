// scripts/testRealReminderEndToEnd.mjs
// Comprehensive End-to-End Real Reminder Verification Script

import { reminderService, parseSlotToISO } from '../src/services/reminderService.ts';
import { ReminderEngineService } from '../src/engine/reminderEngine.ts';

// Mock localStorage for Node.js runtime
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
console.log('   REAL REMINDER -> DATABASE -> HISTORY -> STATS    ');
console.log('   END-TO-END PIPELINE VERIFICATION                 ');
console.log('====================================================\n');

const testUserId = 'test-user-e87803c0-182c-49f3-9a98-f49573a9c599';

async function runVerification() {
  const results = {};

  // 1. Test Slot Parsing
  console.log('--- 1. Testing Slot ISO Conversion ---');
  const iso1 = parseSlotToISO('water:2026-09-12:17:00');
  const iso2 = parseSlotToISO('17:00');
  console.log('Parsed water:2026-09-12:17:00 ->', iso1);
  console.log('Parsed 17:00 ->', iso2);
  results.slotParsing = iso1.includes('2026-09-12') && iso1.includes('17:00:00') || iso1.includes('11:30:00'); // depending on local/UTC offset

  // 2. Real Water Reminder Lifecycle
  console.log('\n--- 2. Water Reminder Lifecycle (Trigger -> Complete) ---');
  const waterSlotId = 'water:2026-09-12:17:00';
  
  // A. Trigger
  const waterTriggered = await reminderService.recordTriggered(testUserId, 'water', waterSlotId);
  console.log('Water Triggered Event:', {
    id: waterTriggered.id,
    type: waterTriggered.type,
    status: waterTriggered.status,
    scheduled_at: waterTriggered.scheduled_at,
    started_at: waterTriggered.started_at,
    completed_at: waterTriggered.completed_at,
  });
  results.waterTrigger = waterTriggered.status === 'triggered' && Boolean(waterTriggered.id);

  // B. Complete
  const waterCompleted = await reminderService.recordCompleted(testUserId, 'water', waterSlotId);
  console.log('Water Completed Event:', {
    id: waterCompleted.id,
    type: waterCompleted.type,
    status: waterCompleted.status,
    scheduled_at: waterCompleted.scheduled_at,
    started_at: waterCompleted.started_at,
    completed_at: waterCompleted.completed_at,
  });
  results.waterCompletion =
    waterCompleted.status === 'completed' &&
    waterCompleted.id === waterTriggered.id &&
    Boolean(waterCompleted.completed_at);

  // 3. Real Look Outside Reminder Lifecycle
  console.log('\n--- 3. Look Outside Reminder Lifecycle (Trigger -> 00:00 Auto-Complete) ---');
  const screenSlotId = 'look_outside:2026-09-12:16:30';

  // A. Trigger
  const screenTriggered = await reminderService.recordTriggered(testUserId, 'look_outside', screenSlotId);
  console.log('Look Outside Triggered Event:', {
    id: screenTriggered.id,
    type: screenTriggered.type,
    status: screenTriggered.status,
  });
  results.screenTrigger = screenTriggered.status === 'triggered' && Boolean(screenTriggered.id);

  // B. Complete (00:00 timer expiration)
  const screenCompleted = await reminderService.recordCompleted(testUserId, 'look_outside', screenSlotId);
  console.log('Look Outside Completed Event:', {
    id: screenCompleted.id,
    type: screenCompleted.type,
    status: screenCompleted.status,
    completed_at: screenCompleted.completed_at,
  });
  results.screenCompletion =
    screenCompleted.status === 'completed' &&
    screenCompleted.id === screenTriggered.id &&
    Boolean(screenCompleted.completed_at);

  // 4. Local Event Cache & Offline Queue Inspection
  console.log('\n--- 4. Local Storage & Offline Queue ---');
  const localEvents = reminderService.getLocalEvents(testUserId);
  const offlineQueue = reminderService.getOfflineQueue(testUserId);
  console.log('Local Events Count:', localEvents.length);
  console.log('Offline Queue Count:', offlineQueue.length);
  results.localEvent = localEvents.length === 2 && localEvents.every((e) => e.status === 'completed');
  results.offlineQueue = offlineQueue.length === 2;

  // 5. Query Today Events & History
  console.log('\n--- 5. History & Today Events Retrieval ---');
  const todayEvents = await reminderService.getTodayEvents(testUserId);
  const history = await reminderService.getHistory(testUserId, { range: 'today' });
  console.log('Today Events Count:', todayEvents.length);
  console.log('History Events Count:', history.events.length);
  results.history = todayEvents.length === 2 && history.events.length === 2;

  // 6. User Statistics Calculation
  console.log('\n--- 6. User Statistics Calculation ---');
  const stats = await reminderService.getStatistics(testUserId, {
    waterConfig: { enabled: true, startTime: '08:00', endTime: '22:00', intervalMinutes: 60, activeDays: [0, 1, 2, 3, 4, 5, 6] },
    screenBreakConfig: { enabled: true, startTime: '09:00', endTime: '22:00', screenIntervalMinutes: 30, activeDays: [0, 1, 2, 3, 4, 5, 6] },
  });
  console.log('Statistics Output:', {
    waterCompleted: stats.waterCompleted,
    screenCompleted: stats.screenCompleted,
    todayWaterCompleted: stats.today.waterCompleted,
    todayWaterScheduled: stats.today.waterScheduled,
    todayScreenCompleted: stats.today.screenCompleted,
    todayScreenScheduled: stats.today.screenScheduled,
    dailyCompletionRate: stats.dailyCompletionRate,
    currentStreak: stats.currentStreak,
  });
  results.statistics = stats.waterCompleted === 1 && stats.screenCompleted === 1 && stats.currentStreak >= 1;

  // 7. Today's Progress Calculation with Reminder Engine
  console.log('\n--- 7. Today\'s Progress Calculation ---');
  const engine = new ReminderEngineService();
  const schedule = engine.calculateSchedule(
    { enabled: true, startTime: '08:00', endTime: '22:00', intervalMinutes: 60, activeDays: [0, 1, 2, 3, 4, 5, 6], durationMinutes: 2, sound: 'water', quietHoursEnabled: false, quietStartTime: '13:00', quietEndTime: '14:00', reminderStyle: 'popup' },
    { enabled: true, startTime: '09:00', endTime: '22:00', screenIntervalMinutes: 30, breakDurationMinutes: 5, sound: 'bell', activeDays: [0, 1, 2, 3, 4, 5, 6], reminderStyle: 'fullscreen' },
    { isPaused: false, pauseUntil: null, pauseMinutes: null },
    [{ id: waterSlotId, time: '17:00', scheduledTimestamp: Date.now(), status: 'completed' }],
    [{ id: screenSlotId, time: '16:30', scheduledTimestamp: Date.now(), durationMinutes: 5, status: 'completed' }]
  );
  console.log('Engine Progress:', {
    waterProgress: `${schedule.waterCompletedCount} / ${schedule.waterTotalCount}`,
    screenProgress: `${schedule.screenCompletedCount} / ${schedule.screenTotalCount}`,
    nextWater: schedule.nextWaterSlot?.time,
    nextScreen: schedule.nextScreenSlot?.time,
  });
  results.progress = schedule.waterCompletedCount === 1 && schedule.waterTotalCount === 15 && schedule.screenCompletedCount === 1 && schedule.screenTotalCount === 27;

  // 8. Output Summary
  console.log('\n====================================================');
  console.log('              FINAL TEST SUMMARY                    ');
  console.log('====================================================');
  console.log('WATER TRIGGER:                 ', results.waterTrigger ? 'PASS' : 'FAIL');
  console.log('WATER COMPLETION:              ', results.waterCompletion ? 'PASS' : 'FAIL');
  console.log('LOOK OUTSIDE TRIGGER:          ', results.screenTrigger ? 'PASS' : 'FAIL');
  console.log('LOOK OUTSIDE COMPLETION:       ', results.screenCompletion ? 'PASS' : 'FAIL');
  console.log('LOCAL EVENT:                   ', results.localEvent ? 'PASS' : 'FAIL');
  console.log('OFFLINE QUEUE:                 ', results.offlineQueue ? 'PASS' : 'FAIL');
  console.log('HISTORY:                       ', results.history ? 'PASS' : 'FAIL');
  console.log('STATISTICS:                    ', results.statistics ? 'PASS' : 'FAIL');
  console.log('TODAY\'S PROGRESS:              ', results.progress ? 'PASS' : 'FAIL');
  console.log('====================================================\n');

  const allPassed = Object.values(results).every(Boolean);
  if (!allPassed) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
