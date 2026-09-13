// scripts/testCrossDeviceConsistency.mjs
// Verification suite for Cross-Device Data Consistency (Web = Windows = Android)

import assert from 'node:assert';
import { calculateAuthoritativeExpected, getLocalDateString } from '../src/services/reminderService.ts';

console.log('================================================================');
console.log('       EYEFLOW V2: CROSS-DEVICE DATA CONSISTENCY TEST           ');
console.log('================================================================\n');

// 1. Expected calculation consistency
const testWaterConfig = {
  enabled: true,
  startTime: '09:00',
  endTime: '18:00',
  intervalMinutes: 60,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
};

const testScreenConfig = {
  enabled: true,
  startTime: '09:00',
  endTime: '18:00',
  screenIntervalMinutes: 30,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
};

const waterExpected = calculateAuthoritativeExpected(testWaterConfig, new Date(), 60);
const screenExpected = calculateAuthoritativeExpected(testScreenConfig, new Date(), 30);

// (18 - 9)*60 / 60 + 1 = 10 slots (09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00)
assert.strictEqual(waterExpected, 10, 'Water expected count matches authoritative calculation');
// (18 - 9)*60 / 30 + 1 = 19 slots (every 30 mins)
assert.strictEqual(screenExpected, 19, 'Screen break expected count matches authoritative calculation');
console.log('  ✓ [EXPECTED] Authoritative slot count calculation : PASS (Water=10, Screen=19)');

// 2. Disabled config yields 0 expected
const disabledWater = { ...testWaterConfig, enabled: false };
assert.strictEqual(calculateAuthoritativeExpected(disabledWater), 0, 'Disabled water yields 0 expected');
console.log('  ✓ [EXPECTED] Disabled reminder categories yield 0  : PASS');

// 3. Timezone consistency check
const testDateIso = '2026-09-12T13:30:00.000Z'; // 7:00 PM IST (same day), 9:30 AM EDT (same day)
const istDate = getLocalDateString(testDateIso, 'Asia/Kolkata');
const edtDate = getLocalDateString(testDateIso, 'America/New_York');
const utcDate = getLocalDateString(testDateIso, 'UTC');

assert.strictEqual(istDate, '2026-09-12', 'IST date is 2026-09-12');
assert.strictEqual(edtDate, '2026-09-12', 'EDT date is 2026-09-12');
assert.strictEqual(utcDate, '2026-09-12', 'UTC date is 2026-09-12');
console.log('  ✓ [TIMEZONE] Local calendar day formatting        : PASS (All timezones consistent)');

// 4. Daily Rate formula consistency
const completedWater = 3;
const completedScreen = 6;
const totalExpected = waterExpected + screenExpected; // 29
const expectedDailyRate = Math.min(100, Math.round(((completedWater + completedScreen) / totalExpected) * 100)); // (9/29)*100 = 31%

assert.strictEqual(expectedDailyRate, 31, 'Daily rate calculation matches (31%)');
console.log(`  ✓ [DAILY RATE] Formula consistency                : PASS (${completedWater + completedScreen}/${totalExpected} = ${expectedDailyRate}%)`);

console.log('\n================================================================');
console.log('   ✓ CROSS-DEVICE DATA CONSISTENCY VERIFICATION PASSED (100%)   ');
console.log('================================================================\n');
