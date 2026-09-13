import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Database, db } from '../server/db/database.ts';
import { createServer } from '../server/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '..', 'eyeflow_v2_test.json');

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Instantiate test database
const testDb = new Database(TEST_DB_PATH);

// Override singleton instance for tests
Object.assign(db, testDb);

process.env.NODE_ENV = 'test';
const app = createServer();
const server = http.createServer(app);

const PORT = 5555;
const BASE_URL = `http://localhost:${PORT}/api`;

async function request(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

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
            resolve({ status: res.statusCode, body: json });
          } catch {
            resolve({ status: res.statusCode, body: rawData });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('       EyeFlow V2 Multi-User Backend Test Suite     ');
  console.log('====================================================\n');

  server.listen(PORT, async () => {
    try {
      // 1. Health Check
      const health = await request('/health');
      assert(health.status === 200 && health.body.status === 'healthy', 'Server health check returns healthy (status 200)');

      // 2. User A Registration
      const userA = await request('/auth/register', 'POST', {
        email: 'alice@example.com',
        password: 'password123',
        display_name: 'Alice',
      });
      assert(userA.status === 201 && userA.body.token, 'User A registered successfully with JWT token');
      const tokenA = userA.body.token;

      // 3. User B Registration
      const userB = await request('/auth/register', 'POST', {
        email: 'bob@example.com',
        password: 'password456',
        display_name: 'Bob',
      });
      assert(userB.status === 201 && userB.body.token, 'User B registered successfully with JWT token');
      const tokenB = userB.body.token;

      // 4. Duplicate Registration Rejection
      const dup = await request('/auth/register', 'POST', {
        email: 'alice@example.com',
        password: 'password123',
      });
      assert(dup.status === 409, 'Duplicate user registration rejected with 409 Conflict');

      // 5. User A Updates Water Config
      const updateWaterA = await request(
        '/water',
        'PUT',
        { enabled: true, interval_minutes: 30, duration_seconds: 90 },
        tokenA
      );
      assert(
        updateWaterA.status === 200 && updateWaterA.body.config.interval_minutes === 30,
        'User A updated water config to 30 minutes'
      );

      // 6. User B Fetches Water Config (Must be isolated from User A)
      const getWaterB = await request('/water', 'GET', null, tokenB);
      assert(
        getWaterB.status === 200 && getWaterB.body.config.interval_minutes === 45,
        'User B water config remains at default 45 mins (Strict User Isolation)'
      );

      // 7. User A Logs a Reminder Event
      const logEventA = await request(
        '/reminders',
        'POST',
        {
          type: 'water',
          scheduled_at: new Date().toISOString(),
          status: 'completed',
        },
        tokenA
      );
      assert(logEventA.status === 201 && logEventA.body.event.id, 'User A logged reminder event');
      const eventAId = logEventA.body.event.id;

      // 8. User B Attempts to Modify User A's Reminder Event (Row-Level Security)
      const unauthorizedUpdate = await request(
        `/reminders/${eventAId}`,
        'PATCH',
        { status: 'skipped' },
        tokenB
      );
      assert(
        unauthorizedUpdate.status === 404,
        'User B unauthorized mutation of User A event rejected (Row-Level Security)'
      );

      // 9. Unauthorized Request without Token
      const noAuth = await request('/settings', 'GET');
      assert(noAuth.status === 401, 'Unauthenticated request rejected with 401 Unauthorized');

      // 10. User A Device Registration
      const regDevice = await request(
        '/devices/register',
        'POST',
        {
          device_id: 'dev_win_desktop_01',
          platform: 'windows',
          device_name: 'Work PC',
        },
        tokenA
      );
      assert(regDevice.status === 200 && regDevice.body.device.device_id === 'dev_win_desktop_01', 'User A registered Windows device');

      // 11. User A Full Delta Synchronization
      const syncA = await request(
        '/sync',
        'POST',
        {
          settings: { theme: 'light' },
          pendingReminderEvents: [
            { type: 'screen', scheduled_at: new Date().toISOString(), status: 'completed' },
          ],
        },
        tokenA
      );
      assert(
        syncA.status === 200 && syncA.body.settings.theme === 'light' && syncA.body.recentEvents.length >= 2,
        'Full Delta Sync succeeded and reconciled offline events'
      );

      console.log('\n====================================================');
      console.log('✓ ALL V2 BACKEND & ISOLATION TESTS PASSED (11/11)');
      console.log('====================================================\n');

      server.close();
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      process.exit(0);
    } catch (err) {
      console.error('Test execution error:', err);
      server.close();
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      process.exit(1);
    }
  });
}

runTests();
