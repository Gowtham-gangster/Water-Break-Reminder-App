// scripts/testExpirationAndMissedPipeline.mjs
// Authoritative test for Missed/Expired Reminder Pipeline & Statistics

import assert from 'node:assert';
import { reminderService, getLocalDateString } from '../src/services/reminderService.ts';

console.log('================================================================');
console.log('    EYEFLOW MISSED & EXPIRED REMINDER PIPELINE VERIFICATION     ');
console.log('================================================================');

async function runTest() {
  const testUserId = `test-user-${Date.now()}`;
  const tz = 'Asia/Kolkata';
  const todayLocal = getLocalDateString(new Date(), tz);

  console.log(`[TEST SETUP] User: ${testUserId} | TimeZone: ${tz} | Today: ${todayLocal}`);

  // -------------------------------------------------------------
  // TEST A — WATER REMINDER EXPIRATION & STATISTICS
  // -------------------------------------------------------------
  console.log('\n--- [1] Water Reminder Trigger -> Expire Pipeline ---');
  const waterSlotKey = `water:${todayLocal}:10:00`;
  
  // Step 1: Trigger
  const waterTriggered = await reminderService.recordTriggered(testUserId, 'water', waterSlotKey);
  console.log('  1. Water Reminder Triggered:', { id: waterTriggered.id, status: waterTriggered.status });
  assert.strictEqual(waterTriggered.status, 'triggered', 'Water status must be triggered');

  // Step 2: Expire
  const waterExpired = await reminderService.recordExpired(testUserId, 'water', waterSlotKey);
  console.log('  2. Water Reminder Expired:', { id: waterExpired.id, status: waterExpired.status });
  assert.strictEqual(waterExpired.status, 'expired', 'Water status must be expired');
  assert.strictEqual(waterExpired.id, waterTriggered.id, 'Idempotency: Must update the same event row');

  // Step 3: Statistics Verification
  const statsAfterWaterExpired = await reminderService.getStatistics(testUserId, { timeZone: tz });
  console.log('  3. Statistics Query Result (Water):', {
    waterCompleted: statsAfterWaterExpired.waterCompleted,
    waterMissed: statsAfterWaterExpired.waterMissed,
    todayWaterCompleted: statsAfterWaterExpired.today.waterCompleted,
    todayWaterMissed: statsAfterWaterExpired.today.waterMissed,
  });

  assert.strictEqual(statsAfterWaterExpired.waterCompleted, 0, 'Water completed must be 0');
  assert.strictEqual(statsAfterWaterExpired.waterMissed, 1, 'Water missed must be 1');
  assert.strictEqual(statsAfterWaterExpired.today.waterMissed, 1, 'Today water missed must be 1');
  console.log('  ✓ TEST A (WATER MISSED/EXPIRED): PASS');

  // -------------------------------------------------------------
  // TEST B — LOOK OUTSIDE EXPIRATION & STATISTICS
  // -------------------------------------------------------------
  console.log('\n--- [2] Look Outside Reminder Trigger -> Expire Pipeline ---');
  const screenSlotKey = `screen:${todayLocal}:10:30`;

  // Step 1: Trigger
  const screenTriggered = await reminderService.recordTriggered(testUserId, 'look_outside', screenSlotKey);
  console.log('  1. Look Outside Triggered:', { id: screenTriggered.id, status: screenTriggered.status });
  assert.strictEqual(screenTriggered.status, 'triggered', 'Look Outside status must be triggered');

  // Step 2: Expire
  const screenExpired = await reminderService.recordExpired(testUserId, 'look_outside', screenSlotKey);
  console.log('  2. Look Outside Expired:', { id: screenExpired.id, status: screenExpired.status });
  assert.strictEqual(screenExpired.status, 'expired', 'Look Outside status must be expired');
  assert.strictEqual(screenExpired.id, screenTriggered.id, 'Idempotency: Must update the same event row');

  // Step 3: Statistics Verification
  const statsAfterScreenExpired = await reminderService.getStatistics(testUserId, { timeZone: tz });
  console.log('  3. Statistics Query Result (Look Outside):', {
    screenCompleted: statsAfterScreenExpired.screenCompleted,
    screenMissed: statsAfterScreenExpired.screenMissed,
    todayScreenCompleted: statsAfterScreenExpired.today.screenCompleted,
    todayScreenMissed: statsAfterScreenExpired.today.screenMissed,
  });

  assert.strictEqual(statsAfterScreenExpired.screenCompleted, 0, 'Look Outside completed must be 0');
  assert.strictEqual(statsAfterScreenExpired.screenMissed, 1, 'Look Outside missed must be 1');
  assert.strictEqual(statsAfterScreenExpired.today.screenMissed, 1, 'Today screen missed must be 1');
  console.log('  ✓ TEST B (LOOK OUTSIDE MISSED/EXPIRED): PASS');

  // -------------------------------------------------------------
  // TEST C — COMPLETED EVENTS ARE NEVER COUNTED AS MISSED
  // -------------------------------------------------------------
  console.log('\n--- [3] Completed Reminder Separation ---');
  const completedSlotKey = `water:${todayLocal}:11:00`;
  await reminderService.recordTriggered(testUserId, 'water', completedSlotKey);
  await reminderService.recordCompleted(testUserId, 'water', completedSlotKey);

  const finalStats = await reminderService.getStatistics(testUserId, { timeZone: tz });
  console.log('  Final Statistics:', {
    waterCompleted: finalStats.waterCompleted,
    waterMissed: finalStats.waterMissed,
    screenCompleted: finalStats.screenCompleted,
    screenMissed: finalStats.screenMissed,
  });

  assert.strictEqual(finalStats.waterCompleted, 1, 'Water completed must be 1');
  assert.strictEqual(finalStats.waterMissed, 1, 'Water missed must remain 1');
  assert.strictEqual(finalStats.screenCompleted, 0, 'Look outside completed must be 0');
  assert.strictEqual(finalStats.screenMissed, 1, 'Look outside missed must remain 1');
  console.log('  ✓ TEST C (COMPLETED VS MISSED ISOLATION): PASS');

  // -------------------------------------------------------------
  // TEST D — HISTORY & REALTIME MERGE INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- [4] History Query Range & Filter Verification ---');
  const historyExpired = await reminderService.getHistory(testUserId, { range: 'today', status: 'expired', timeZone: tz });
  console.log(`  Expired history entries count: ${historyExpired.events.length}`);
  assert.strictEqual(historyExpired.events.length, 2, 'History must contain 2 expired events (1 water, 1 look_outside)');

  console.log('\n================================================================');
  console.log('   ✓ ALL EXPIRATION & MISSED STATISTICS TESTS PASSED 100%       ');
  console.log('================================================================\n');
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
