// Dynamic Timestamp Matrix Test Suite for Real-Time Scheduler Engine
import { ReminderEngineService } from '../reminderEngine';
import type { WaterConfig, ScreenBreakConfig, PauseState } from '../../types';

function runDynamicMatrixTests() {
  console.log('🧪 Starting EyeFlow Dynamic Matrix Test Suite (Arbitrary Timestamps)...\n');
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

  const screenConfig: ScreenBreakConfig = {
    enabled: true,
    startTime: '09:00',
    endTime: '23:00',
    screenIntervalMinutes: 30,
    breakDurationMinutes: 5,
    sound: 'bell',
  };

  const waterConfig: WaterConfig = {
    enabled: true,
    startTime: '08:00',
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

  const matrixTestCases = [
    // [testTimeString, expectedScreenBreakTime, description]
    { time: '07:30:00', expected: '09:00', desc: 'Before start (07:30) -> 09:00' },
    { time: '08:07:00', expected: '09:00', desc: 'Before start (08:07) -> 09:00' },
    { time: '09:00:00', expected: '09:00', desc: 'Exact start boundary (09:00:00) -> 09:00' },
    { time: '09:00:01', expected: '09:30', desc: '1s after start (09:00:01) -> 09:30' },
    { time: '09:29:59', expected: '09:30', desc: '1s before slot (09:29:59) -> 09:30' },
    { time: '09:30:00', expected: '09:30', desc: 'Exact slot boundary (09:30:00) -> 09:30' },
    { time: '09:30:01', expected: '10:00', desc: '1s after slot (09:30:01) -> 10:00' },
    { time: '09:43:00', expected: '10:00', desc: 'Mid-interval (09:43:00) -> 10:00' },
    { time: '11:18:00', expected: '11:30', desc: 'Mid-interval (11:18:00) -> 11:30' },
    { time: '12:17:00', expected: '12:30', desc: 'Mid-interval (12:17:00) -> 12:30' },
    { time: '13:02:00', expected: '13:30', desc: 'Mid-interval (13:02:00) -> 13:30' },
    { time: '14:42:00', expected: '15:00', desc: 'Mid-interval (14:42:00) -> 15:00' },
    { time: '14:57:00', expected: '15:00', desc: 'Mid-interval (14:57:00) -> 15:00' },
    { time: '17:13:00', expected: '17:30', desc: 'Mid-interval (17:13:00) -> 17:30' },
    { time: '17:29:59', expected: '17:30', desc: 'Boundary (17:29:59) -> 17:30' },
    { time: '17:30:00', expected: '17:30', desc: 'Exact boundary (17:30:00) -> 17:30' },
    { time: '17:30:01', expected: '18:00', desc: 'Boundary advance (17:30:01) -> 18:00' },
    { time: '19:46:00', expected: '20:00', desc: 'Mid-interval (19:46:00) -> 20:00' },
    { time: '21:11:00', expected: '21:30', desc: 'Mid-interval (21:11:00) -> 21:30' },
    { time: '22:29:00', expected: '22:30', desc: 'Mid-interval (22:29:00) -> 22:30' },
    { time: '22:30:00', expected: '22:30', desc: 'Exact boundary (22:30:00) -> 22:30' },
    { time: '22:30:01', expected: '23:00', desc: 'Boundary advance (22:30:01) -> 23:00' },
    { time: '22:58:00', expected: '23:00', desc: 'Mid-interval (22:58:00) -> 23:00' },
    { time: '22:59:59', expected: '23:00', desc: '1s before end slot (22:59:59) -> 23:00' },
    { time: '23:00:00', expected: '23:00', desc: 'Final daily slot (23:00:00) -> 23:00' },
    { time: '23:00:01', expected: null, desc: 'After schedule end (23:00:01) -> null for today' },
    { time: '23:30:00', expected: null, desc: 'After schedule end (23:30:00) -> null for today' },
    { time: '23:59:59', expected: null, desc: 'Midnight boundary (23:59:59) -> null for today' },
  ];

  matrixTestCases.forEach((tc) => {
    const testDate = new Date(`2026-08-14T${tc.time}`);
    const res = engine.calculateSchedule(waterConfig, screenConfig, unpausedState, [], [], testDate);
    const actualTime = res.nextScreenSlot?.time || null;
    assert(actualTime === tc.expected, tc.desc, actualTime, tc.expected);
  });

  // Test findNextOccurrence method for Tomorrow Rollover
  {
    const afterEndDate = new Date('2026-08-14T23:30:00');
    const nextOcc = engine.findNextOccurrence(
      afterEndDate,
      screenConfig.startTime,
      screenConfig.endTime,
      screenConfig.screenIntervalMinutes
    );
    assert(nextOcc?.isTomorrow === true, 'After end time, occurrence indicates tomorrow');
    assert(nextOcc?.timeString === '09:00', 'Tomorrow occurrence is configured start time (09:00)');
  }

  // Test Water Activation at arbitrary 14:17 with 60m interval (08:00 to 22:00) -> Next is 15:00
  {
    const activationDate = new Date('2026-08-14T14:17:00');
    const res = engine.calculateSchedule(waterConfig, screenConfig, unpausedState, [], [], activationDate);
    assert(res.nextWaterSlot?.time === '15:00', 'Water activation at 14:17 anchors to 15:00 (not 15:17)', res.nextWaterSlot?.time, '15:00');
  }

  console.log(`\n================================`);
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  return failed === 0;
}

runDynamicMatrixTests();
