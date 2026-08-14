// Strict Scheduler Accuracy Test Suite (User Cases 1 - 10)
import { ReminderEngineService } from '../reminderEngine';
import type { WaterConfig, ScreenBreakConfig, PauseState } from '../../types';

function runAccuracyTests() {
  console.log('🧪 Starting EyeFlow Comprehensive Scheduler Accuracy Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, actual?: any, expected?: any) {
    if (condition) {
      console.log(`  ✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${testName} | Expected: ${expected}, Got: ${actual}`);
      failed++;
    }
  }

  const engine = new ReminderEngineService();

  const screenConfig30m: ScreenBreakConfig = {
    enabled: true,
    startTime: '06:00',
    endTime: '23:00',
    screenIntervalMinutes: 30,
    breakDurationMinutes: 5,
    sound: 'bell',
  };

  const waterConfig60m: WaterConfig = {
    enabled: true,
    startTime: '06:00',
    endTime: '22:00',
    intervalMinutes: 60,
    durationMinutes: 2,
    sound: 'water',
    quietHoursEnabled: false,
    quietStartTime: '',
    quietEndTime: '',
  };

  const unpausedState: PauseState = {
    isPaused: false,
    pauseUntil: null,
    pauseMinutes: null,
  };

  // Test 1: Current 17:13 -> Next is 17:30
  {
    const now = new Date('2026-08-14T17:13:00');
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], [], now);
    assert(res.nextScreenSlot?.time === '17:30', 'Case 1: At 17:13, next screen break is 17:30', res.nextScreenSlot?.time, '17:30');
  }

  // Test 2: Current 17:29 -> Next is 17:30
  {
    const now = new Date('2026-08-14T17:29:00');
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], [], now);
    assert(res.nextScreenSlot?.time === '17:30', 'Case 2: At 17:29, next screen break is 17:30', res.nextScreenSlot?.time, '17:30');
  }

  // Test 3: Current 17:30:01 -> Next is 18:00
  {
    const now = new Date('2026-08-14T17:30:01');
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], [], now);
    assert(res.nextScreenSlot?.time === '18:00', 'Case 3: At 17:30:01, next screen break is 18:00', res.nextScreenSlot?.time, '18:00');
  }

  // Test 4: Current 18:29 -> Next is 18:30
  {
    const now = new Date('2026-08-14T18:29:00');
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], [], now);
    assert(res.nextScreenSlot?.time === '18:30', 'Case 4: At 18:29, next screen break is 18:30', res.nextScreenSlot?.time, '18:30');
  }

  // Test 5: Current 22:59 -> Next is 23:00
  {
    const now = new Date('2026-08-14T22:59:00');
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], [], now);
    assert(res.nextScreenSlot?.time === '23:00', 'Case 5: At 22:59, next screen break is 23:00', res.nextScreenSlot?.time, '23:00');
  }

  // Test 6: Current 23:01 -> Schedule finished for today (null next slot for today)
  {
    const now = new Date('2026-08-14T23:01:00');
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], [], now);
    assert(res.nextScreenSlot === null, 'Case 6: At 23:01, today schedule ended (next is null)', res.nextScreenSlot, null);
  }

  // Test 7: Current 17:13 with completed 17:00 -> Next is 17:30
  {
    const now = new Date('2026-08-14T17:13:00');
    const existingLogs = [
      { id: 'screen-17:00', time: '17:00', scheduledTimestamp: new Date('2026-08-14T17:00:00').getTime(), durationMinutes: 5, status: 'completed' as const }
    ];
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], existingLogs, now);
    assert(res.nextScreenSlot?.time === '17:30', 'Case 7: At 17:13 with 17:00 completed, next is 17:30', res.nextScreenSlot?.time, '17:30');
  }

  // Test 8: Current 17:13, 17:00 completed, 17:30 NOT completed -> Next is 17:30
  {
    const now = new Date('2026-08-14T17:13:00');
    const existingLogs = [
      { id: 'screen-17:00', time: '17:00', scheduledTimestamp: new Date('2026-08-14T17:00:00').getTime(), durationMinutes: 5, status: 'completed' as const }
    ];
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], existingLogs, now);
    assert(res.nextScreenSlot?.time === '17:30', 'Case 8: 17:30 remains next', res.nextScreenSlot?.time, '17:30');
  }

  // Test 9: Water schedule at 17:13 with 60m interval -> Next is 18:00
  {
    const now = new Date('2026-08-14T17:13:00');
    const res = engine.calculateSchedule(waterConfig60m, screenConfig30m, unpausedState, [], [], now);
    assert(res.nextWaterSlot?.time === '18:00', 'Case 9: At 17:13 with 60m interval, next water is 18:00', res.nextWaterSlot?.time, '18:00');
  }

  // Test 10: Interval change from 30m to 60m at 17:13 -> Next screen break updates immediately to 18:00
  {
    const now = new Date('2026-08-14T17:13:00');
    const screenConfig60m = { ...screenConfig30m, screenIntervalMinutes: 60 };
    const res = engine.calculateSchedule(waterConfig60m, screenConfig60m, unpausedState, [], [], now);
    assert(res.nextScreenSlot?.time === '18:00', 'Case 10: Changing interval to 60m updates next break to 18:00', res.nextScreenSlot?.time, '18:00');
  }

  console.log(`\n================================`);
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  return failed === 0;
}

runAccuracyTests();
