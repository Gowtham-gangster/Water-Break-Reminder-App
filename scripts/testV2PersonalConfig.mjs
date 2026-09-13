// scripts/testV2PersonalConfig.mjs
// Comprehensive Test Suite for EyeFlow V2 Phase 5: Personal Reminder Configuration

import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Database, db } from '../server/db/database.ts';
import { createServer } from '../server/index.ts';
import { ReminderEngineService } from '../src/engine/reminderEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '..', 'eyeflow_v2_config_test.json');

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Clean test database
const testDb = new Database(TEST_DB_PATH);
Object.assign(db, testDb);

process.env.NODE_ENV = 'test';
const app = createServer();
const server = http.createServer(app);

const PORT = 5589;
const BASE_URL = `http://localhost:${PORT}/api`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASSED: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAILED: ${message} ${detail ? `(${detail})` : ''}`);
  }
}

async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(rawData);
            resolve({ status: res.statusCode, data: json });
          } catch {
            resolve({ status: res.statusCode, data: rawData });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function signupAndLogin(email, password, displayName) {
  const res = await apiRequest('/auth/register', 'POST', { email, password, display_name: displayName });
  if (res.data?.token) {
    return {
      token: res.data.token,
      user: res.data.user,
    };
  }
  const loginRes = await apiRequest('/auth/login', 'POST', { email, password });
  return {
    token: loginRes.data?.token,
    user: loginRes.data?.user,
  };
}

async function runPersonalConfigTests() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 EyeFlow V2 — Phase 5: Personal Reminder Configuration Tests');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const engine = new ReminderEngineService();

    // =========================================================================
    // SECTION 1: Pure Engine Scheduler Calculations (Arbitrary Times & Days)
    // =========================================================================
    console.log('--- 1. Scheduler Engine: Arbitrary Times & Active Days ---');

    // User A config: Water 30m, 08:13 - 17:53, Mon-Fri (1-5)
    const userAWaterConfig = {
      enabled: true,
      startTime: '08:13',
      endTime: '17:53',
      intervalMinutes: 30,
      durationMinutes: 2,
      activeDays: [1, 2, 3, 4, 5],
    };

    // User B config: Water 90m, 09:47 - 22:11, All 7 Days (0-6)
    const userBWaterConfig = {
      enabled: true,
      startTime: '09:47',
      endTime: '22:11',
      intervalMinutes: 90,
      durationMinutes: 3,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    };

    // 1.1 User A before start on Wednesday (active day) at 08:00
    // Wednesday = 2026-08-12
    {
      const now = new Date('2026-08-12T08:00:00');
      const occ = engine.findNextOccurrence(
        now,
        userAWaterConfig.startTime,
        userAWaterConfig.endTime,
        userAWaterConfig.intervalMinutes,
        undefined,
        undefined,
        userAWaterConfig.activeDays
      );
      assert(occ?.timeString === '08:13', 'User A before start time (08:00) gets 08:13 start', occ?.timeString);
    }

    // 1.2 User A at 08:13: next is 08:43 (30 mins step from 08:13)
    {
      const now = new Date('2026-08-12T08:13:00');
      const occ = engine.findNextOccurrence(
        now,
        userAWaterConfig.startTime,
        userAWaterConfig.endTime,
        userAWaterConfig.intervalMinutes,
        undefined,
        undefined,
        userAWaterConfig.activeDays
      );
      assert(occ?.timeString === '08:43', 'User A at 08:13 gets 08:43 (30m step)', occ?.timeString);
    }

    // 1.3 User A arbitrary mid-day occurrences: 08:13, 08:43, 09:13, ..., 17:43
    {
      const occs = engine.generateDailyOccurrences(
        new Date('2026-08-12T00:00:00'),
        userAWaterConfig.startTime,
        userAWaterConfig.endTime,
        userAWaterConfig.intervalMinutes
      );
      assert(occs[0].timeString === '08:13', 'User A first daily occurrence is 08:13', occs[0].timeString);
      assert(occs[1].timeString === '08:43', 'User A second daily occurrence is 08:43', occs[1].timeString);
      assert(occs[occs.length - 1].timeString === '17:43', 'User A last occurrence within 17:53 is 17:43', occs[occs.length - 1].timeString);
    }

    // 1.4 User B at 09:40 -> next is 09:47
    {
      const now = new Date('2026-08-12T09:40:00');
      const occ = engine.findNextOccurrence(
        now,
        userBWaterConfig.startTime,
        userBWaterConfig.endTime,
        userBWaterConfig.intervalMinutes,
        undefined,
        undefined,
        userBWaterConfig.activeDays
      );
      assert(occ?.timeString === '09:47', 'User B at 09:40 gets 09:47 start', occ?.timeString);
    }

    // 1.5 User B at 09:47 -> next is 11:17 (90m step: 09:47 + 90m = 11:17)
    {
      const now = new Date('2026-08-12T09:47:00');
      const occ = engine.findNextOccurrence(
        now,
        userBWaterConfig.startTime,
        userBWaterConfig.endTime,
        userBWaterConfig.intervalMinutes,
        undefined,
        undefined,
        userBWaterConfig.activeDays
      );
      assert(occ?.timeString === '11:17', 'User B at 09:47 gets 11:17 (90m step)', occ?.timeString);
    }

    // 1.6 Active Days Rollover:
    // Sunday 2026-08-16 (day 0) is inactive for User A (activeDays [1,2,3,4,5]).
    // Engine should find Monday 2026-08-17 at 08:13.
    {
      const sundayNow = new Date('2026-08-16T12:00:00'); // Sunday
      const nextOcc = engine.findNextOccurrence(
        sundayNow,
        userAWaterConfig.startTime,
        userAWaterConfig.endTime,
        userAWaterConfig.intervalMinutes,
        undefined,
        undefined,
        userAWaterConfig.activeDays
      );
      assert(nextOcc !== null, 'User A on inactive Sunday finds next active day');
      assert(nextOcc?.timeString === '08:13', 'User A next active day time is 08:13', nextOcc?.timeString);
      assert(nextOcc?.daysAway === 1, 'User A on Sunday calculates 1 day away (Monday)', nextOcc?.daysAway);

      // Calculate schedule on Sunday for User A returns 0 pending slots for today
      const sundaySchedule = engine.calculateSchedule(
        userAWaterConfig,
        { enabled: false },
        { isPaused: false, pauseUntil: null, pauseMinutes: null },
        [],
        [],
        sundayNow
      );
      assert(sundaySchedule.waterSlots.length === 0, 'User A has 0 water slots on inactive Sunday');
      assert(sundaySchedule.nextWaterSlot === null, 'User A has null nextWaterSlot for today on inactive Sunday');
    }

    // 1.7 Active Days for User B (All 7 Days):
    // Sunday 2026-08-16 is active for User B!
    {
      const sundayNow = new Date('2026-08-16T10:00:00');
      const sundaySchedule = engine.calculateSchedule(
        userBWaterConfig,
        { enabled: false },
        { isPaused: false, pauseUntil: null, pauseMinutes: null },
        [],
        [],
        sundayNow
      );
      assert(sundaySchedule.waterSlots.length > 0, 'User B has active water slots on Sunday (All 7 Days)');
      assert(sundaySchedule.nextWaterSlot?.time === '11:17', 'User B next water slot on Sunday at 10:00 is 11:17', sundaySchedule.nextWaterSlot?.time);
    }

    // =========================================================================
    // SECTION 2: API Validation Rejection Tests (Backend Boundary Checks)
    // =========================================================================
    console.log('\n--- 2. API Validation & Error Rejections ---');

    const uid = Date.now();
    const user = await signupAndLogin(`cfgtest_${uid}@eyeflow.local`, 'Password123!', 'Config Tester');
    assert(!!user.token, 'Test user registered and logged in');

    // 2.1 Negative Interval Rejection
    {
      const res = await apiRequest('/water', 'PUT', { interval_minutes: -10 }, user.token);
      assert(res.status === 400, 'Rejects negative interval (-10) with 400 Bad Request', res.status);
    }

    // 2.2 Zero Interval Rejection
    {
      const res = await apiRequest('/water', 'PUT', { interval_minutes: 0 }, user.token);
      assert(res.status === 400, 'Rejects zero interval (0) with 400 Bad Request', res.status);
    }

    // 2.3 Start Time >= End Time Rejection
    {
      const res = await apiRequest('/water', 'PUT', { start_time: '18:00', end_time: '09:00' }, user.token);
      assert(res.status === 400, 'Rejects start_time >= end_time with 400 Bad Request', res.status);
    }

    // 2.4 Invalid Time Format Rejection
    {
      const res = await apiRequest('/water', 'PUT', { start_time: '25:99' }, user.token);
      assert(res.status === 400, 'Rejects invalid time format ("25:99") with 400 Bad Request', res.status);
    }

    // 2.5 Empty Active Days Rejection
    {
      const res = await apiRequest('/water', 'PUT', { active_days: [] }, user.token);
      assert(res.status === 400, 'Rejects empty active_days array with 400 Bad Request', res.status);
    }

    // 2.6 Out of Range Active Days Rejection
    {
      const res = await apiRequest('/water', 'PUT', { active_days: [1, 2, 7] }, user.token);
      assert(res.status === 400, 'Rejects out-of-range active_days ([7]) with 400 Bad Request', res.status);
    }

    // 2.7 Screen Break Negative Duration Rejection
    {
      const res = await apiRequest('/look-outside', 'PUT', { duration_seconds: -5 }, user.token);
      assert(res.status === 400, 'Rejects negative duration_seconds with 400 Bad Request', res.status);
    }

    // =========================================================================
    // SECTION 3: Multi-User Configuration Isolation
    // =========================================================================
    console.log('\n--- 3. Multi-User Configuration Isolation ---');

    const userA = await signupAndLogin(`usera_${uid}@eyeflow.local`, 'Password123!', 'User Alpha');
    const userB = await signupAndLogin(`userb_${uid}@eyeflow.local`, 'Password123!', 'User Beta');

    // Save User A config: Water 30m, Screen 20m, Mon-Fri, 08:13 - 17:53
    await apiRequest(
      '/water',
      'PUT',
      {
        enabled: true,
        start_time: '08:13',
        end_time: '17:53',
        interval_minutes: 30,
        duration_seconds: 120,
        active_days: [1, 2, 3, 4, 5],
      },
      userA.token
    );

    await apiRequest(
      '/look-outside',
      'PUT',
      {
        enabled: true,
        start_time: '08:13',
        end_time: '17:53',
        interval_minutes: 20,
        duration_seconds: 180,
        active_days: [1, 2, 3, 4, 5],
      },
      userA.token
    );

    // Save User B config: Water 90m, Screen 45m, All 7 Days, 09:47 - 22:11
    await apiRequest(
      '/water',
      'PUT',
      {
        enabled: true,
        start_time: '09:47',
        end_time: '22:11',
        interval_minutes: 90,
        duration_seconds: 240,
        active_days: [0, 1, 2, 3, 4, 5, 6],
      },
      userB.token
    );

    await apiRequest(
      '/look-outside',
      'PUT',
      {
        enabled: true,
        start_time: '09:47',
        end_time: '22:11',
        interval_minutes: 45,
        duration_seconds: 360,
        active_days: [0, 1, 2, 3, 4, 5, 6],
      },
      userB.token
    );

    // Verify User A configuration remains completely isolated
    const resAWater = await apiRequest('/water', 'GET', null, userA.token);
    const resAScreen = await apiRequest('/look-outside', 'GET', null, userA.token);

    assert(resAWater.data?.config?.interval_minutes === 30, 'User A water interval is 30m', resAWater.data?.config?.interval_minutes);
    assert(resAWater.data?.config?.start_time === '08:13', 'User A water start_time is 08:13', resAWater.data?.config?.start_time);
    assert(resAWater.data?.config?.end_time === '17:53', 'User A water end_time is 17:53', resAWater.data?.config?.end_time);
    assert(JSON.stringify(resAWater.data?.config?.active_days) === JSON.stringify([1, 2, 3, 4, 5]), 'User A water active_days is [1,2,3,4,5]', JSON.stringify(resAWater.data?.config?.active_days));
    assert(resAScreen.data?.config?.interval_minutes === 20, 'User A screen interval is 20m', resAScreen.data?.config?.interval_minutes);

    // Verify User B configuration remains completely isolated
    const resBWater = await apiRequest('/water', 'GET', null, userB.token);
    const resBScreen = await apiRequest('/look-outside', 'GET', null, userB.token);

    assert(resBWater.data?.config?.interval_minutes === 90, 'User B water interval is 90m', resBWater.data?.config?.interval_minutes);
    assert(resBWater.data?.config?.start_time === '09:47', 'User B water start_time is 09:47', resBWater.data?.config?.start_time);
    assert(resBWater.data?.config?.end_time === '22:11', 'User B water end_time is 22:11', resBWater.data?.config?.end_time);
    assert(JSON.stringify(resBWater.data?.config?.active_days) === JSON.stringify([0, 1, 2, 3, 4, 5, 6]), 'User B water active_days is [0,1,2,3,4,5,6]', JSON.stringify(resBWater.data?.config?.active_days));
    assert(resBScreen.data?.config?.interval_minutes === 45, 'User B screen interval is 45m', resBScreen.data?.config?.interval_minutes);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`📊 Phase 5 Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('═══════════════════════════════════════════════════════════\n');
  } finally {
    server.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
  }

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPersonalConfigTests();
