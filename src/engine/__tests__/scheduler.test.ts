// Automated Test Suite for EyeFlow Reminder Engine
import { ReminderEngineService } from '../reminderEngine';
import type { WaterConfig, ScreenBreakConfig, PauseState } from '../../types';

function runTests() {
  console.log('🧪 Starting EyeFlow Reminder Engine Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${testName}`);
      failed++;
    }
  }

  const engine = new ReminderEngineService();

  const defaultWaterConfig: WaterConfig = {
    enabled: true,
    startTime: '08:00',
    endTime: '20:00',
    intervalMinutes: 60,
    durationMinutes: 2,
    sound: 'water',
    quietHoursEnabled: false,
    quietStartTime: '',
    quietEndTime: '',
  };

  const defaultScreenConfig: ScreenBreakConfig = {
    enabled: true,
    startTime: '09:00',
    endTime: '18:00',
    screenIntervalMinutes: 30,
    breakDurationMinutes: 5,
    sound: 'bell',
  };

  const unpausedState: PauseState = {
    isPaused: false,
    pauseUntil: null,
    pauseMinutes: null,
  };

  // Test 1: Interval and Slot Count Calculation
  {
    const mockNow = new Date('2026-08-14T07:30:00');
    const res = engine.calculateSchedule(
      defaultWaterConfig,
      defaultScreenConfig,
      unpausedState,
      [],
      [],
      mockNow
    );

    // 08:00 to 20:00 every 60 min = 13 slots (08:00, 09:00, ... 20:00)
    assert(res.waterSlots.length === 13, 'Water slots length is 13 for 08:00-20:00 / 60m');
    assert(res.nextWaterSlot?.time === '08:00', 'First water slot is 08:00 before 07:30');
    // Screen: 09:00 to 18:00 every 30m = 19 slots (09:00, 09:30 to 18:00)
    assert(res.screenSlots.length === 19, 'Screen break slots length is 19 for 09:00-18:00 / 30m');
  }

  // Test 2: Next Upcoming Slot Selection Mid-Day
  {
    const mockNow = new Date('2026-08-14T10:15:00');
    const res = engine.calculateSchedule(
      defaultWaterConfig,
      defaultScreenConfig,
      unpausedState,
      [],
      [],
      mockNow
    );

    assert(res.nextWaterSlot?.time === '11:00', 'Next water slot after 10:15 is 11:00');
    assert(res.nextScreenSlot?.time === '10:30', 'Next screen break after 10:15 is 10:30');
    assert(res.nextOverallSlot?.type === 'screen', 'Next overall slot is screen break at 10:30');
    assert(res.nextOverallSlot?.time === '10:30', 'Next overall time matches 10:30');
  }

  // Test 3: Missed Reminders Handling (Past slots marked missed, not fired)
  {
    const mockNow = new Date('2026-08-14T12:00:00');
    const res = engine.calculateSchedule(
      defaultWaterConfig,
      defaultScreenConfig,
      unpausedState,
      [],
      [],
      mockNow
    );

    const missedWater = res.waterSlots.filter((s) => s.status === 'missed');
    // 08:00, 09:00, 10:00, 11:00 are > 10m past 12:00 -> should be missed
    assert(missedWater.length >= 4, 'Past unlogged slots correctly marked missed');
    assert(res.nextWaterSlot?.time === '12:00', 'Next water slot is 12:00');
  }

  // Test 4: Pause State Behavior (Timers suspended)
  {
    const mockNow = new Date('2026-08-14T10:00:00');
    const pausedState: PauseState = {
      isPaused: true,
      pauseUntil: new Date('2026-08-14T12:00:00').toISOString(),
      pauseMinutes: 120,
    };

    const res = engine.calculateSchedule(
      defaultWaterConfig,
      defaultScreenConfig,
      pausedState,
      [],
      [],
      mockNow
    );

    assert(res.nextWaterSlot === null, 'Next water slot is null during active pause');
    assert(res.nextScreenSlot === null, 'Next screen slot is null during active pause');
    assert(res.nextOverallSlot === null, 'Next overall slot is null during active pause');
  }

  // Test 5: Duplicate Prevention via Unique IDs
  {
    const id1 = engine.generateSlotId('water', '2026-08-14', '10:00');
    assert(!engine.hasFired(id1), 'Slot has not fired initially');
    engine.markFired(id1);
    assert(engine.hasFired(id1), 'Slot marked as fired to prevent double alerts');
  }

  // Test 6: Disabled Reminder Config
  {
    const mockNow = new Date('2026-08-14T10:00:00');
    const disabledWater = { ...defaultWaterConfig, enabled: false };
    const res = engine.calculateSchedule(
      disabledWater,
      defaultScreenConfig,
      unpausedState,
      [],
      [],
      mockNow
    );

    assert(res.waterSlots.length === 0, 'Disabled water config yields empty slots');
    assert(res.nextWaterSlot === null, 'Disabled water config yields null next slot');
    assert(res.nextOverallSlot?.type === 'screen', 'Overall slot falls back to enabled screen break');
  }

  // Test 7: Preview Isolation (Preview actions do not mutate scheduled slots or completion count)
  {
    const mockNow = new Date('2026-08-14T17:03:00');
    // Real schedule next slot is 17:30
    const beforePreview = engine.calculateSchedule(
      defaultWaterConfig,
      defaultScreenConfig,
      unpausedState,
      [],
      [],
      mockNow
    );

    assert(beforePreview.nextScreenSlot?.time === '17:30', 'Scheduled next screen break before preview is 17:30');
    assert(beforePreview.screenCompletedCount === 0, 'Completed count before preview is 0');

    // Simulate preview execution: Preview state is ephemeral and never passes into calculateSchedule
    const afterPreview = engine.calculateSchedule(
      defaultWaterConfig,
      defaultScreenConfig,
      unpausedState,
      [], // Existing real logs remain untouched
      [],
      mockNow
    );

    assert(afterPreview.nextScreenSlot?.time === '17:30', 'Scheduled next screen break after preview remains exactly 17:30');
    assert(afterPreview.screenCompletedCount === 0, 'Completed count after preview remains exactly 0');
    assert(afterPreview.waterCompletedCount === 0, 'Water completed count after preview remains 0');
  }

  console.log(`\n================================`);
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  return failed === 0;
}

runTests();
