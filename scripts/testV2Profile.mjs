import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Database, db } from '../server/db/database.ts';
import { createServer } from '../server/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '..', 'eyeflow_v2_profile_test.json');

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Clean test database
const testDb = new Database(TEST_DB_PATH);
Object.assign(db, testDb);

process.env.NODE_ENV = 'test';
const app = createServer();
const server = http.createServer(app);

const PORT = 5577;
const BASE_URL = `http://localhost:${PORT}/api`;

async function request(endpoint, method = 'GET', body = null, token = null) {
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

function assert(condition, message, details = null) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    if (details) console.error('Details:', details);
    server.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runProfileTests() {
  console.log('====================================================');
  console.log('       EYEFLOW V2 — PHASE 3 USER PROFILE SUITE      ');
  console.log('====================================================\n');

  server.listen(PORT, async () => {
    try {
      // 1. Setup User A & User B
      console.log('--- TEST GROUP 1: PROFILE CREATION & RETRIEVAL ---');
      const userAReg = await request('/auth/register', 'POST', {
        email: 'alice.profile@eyeflow.app',
        password: 'AlicePassword123!',
        display_name: 'Alice Johnson',
        timezone: 'America/New_York',
      });
      assert(userAReg.status === 201 && userAReg.body.token, 'User A registered with initial profile');
      const tokenA = userAReg.body.token;

      const userBReg = await request('/auth/register', 'POST', {
        email: 'bob.profile@eyeflow.app',
        password: 'BobPassword123!',
        display_name: 'Bob Williams',
        timezone: 'Asia/Tokyo',
      });
      assert(userBReg.status === 201 && userBReg.body.token, 'User B registered with initial profile');
      const tokenB = userBReg.body.token;

      // 2. Profile Verification & Strict Isolation
      const profileA = await request('/auth/me', 'GET', null, tokenA);
      assert(profileA.status === 200, 'User A profile retrieved successfully');
      assert(profileA.body.user.display_name === 'Alice Johnson', 'User A display name correct');
      assert(profileA.body.user.timezone === 'America/New_York', 'User A timezone correct');

      const profileB = await request('/auth/me', 'GET', null, tokenB);
      assert(profileB.status === 200, 'User B profile retrieved successfully');
      assert(profileB.body.user.display_name === 'Bob Williams', 'User B display name correct');
      assert(profileB.body.user.timezone === 'Asia/Tokyo', 'User B timezone correct');
      assert(profileA.body.user.id !== profileB.body.user.id, 'User A and User B IDs are distinct');

      // 3. Edit Profile (Display Name & Timezone)
      console.log('\n--- TEST GROUP 2: EDIT DISPLAY NAME & TIMEZONE ---');
      const updateA = await request(
        '/auth/me',
        'PATCH',
        { display_name: 'Alice J. Senior', timezone: 'America/Los_Angeles' },
        tokenA
      );
      assert(updateA.status === 200, 'User A updated display name and timezone');
      assert(updateA.body.user.display_name === 'Alice J. Senior', 'User A new display name persisted');
      assert(updateA.body.user.timezone === 'America/Los_Angeles', 'User A new timezone persisted');

      // Verify User B profile did NOT change (Strict Isolation)
      const verifyB = await request('/auth/me', 'GET', null, tokenB);
      assert(verifyB.body.user.display_name === 'Bob Williams', 'User B display name unmodified after User A edit');
      assert(verifyB.body.user.timezone === 'Asia/Tokyo', 'User B timezone unmodified after User A edit');

      // 4. Avatar Upload
      console.log('\n--- TEST GROUP 3: AVATAR MANAGEMENT ---');
      const fakeAvatarData = 'data:image/jpeg;base64,' + Buffer.from('fake_image_pixels').toString('base64');
      const avatarRes = await request('/auth/avatar', 'POST', { avatar_data: fakeAvatarData }, tokenA);
      assert(avatarRes.status === 200 && avatarRes.body.avatar_url, 'User A uploaded avatar successfully');

      const verifyAvatarA = await request('/auth/me', 'GET', null, tokenA);
      assert(verifyAvatarA.body.user.avatar_url === fakeAvatarData, 'User A avatar URL retrieved in profile');

      const verifyAvatarB = await request('/auth/me', 'GET', null, tokenB);
      assert(verifyAvatarB.body.user.avatar_url === null, 'User B has no avatar (strict isolation)');

      // 5. Secure Email Change
      console.log('\n--- TEST GROUP 4: SECURE EMAIL CHANGE ---');
      // Bad password attempt
      const badPassEmailChange = await request(
        '/auth/change-email',
        'POST',
        { new_email: 'alice.new@eyeflow.app', current_password: 'WrongPassword' },
        tokenA
      );
      assert(badPassEmailChange.status === 401, 'Rejects email change with incorrect password');

      // Duplicate email attempt (try to take User B's email)
      const dupEmailChange = await request(
        '/auth/change-email',
        'POST',
        { new_email: 'bob.profile@eyeflow.app', current_password: 'AlicePassword123!' },
        tokenA
      );
      assert(dupEmailChange.status === 409, 'Rejects email change to an existing user email');

      // Valid email change
      const validEmailChange = await request(
        '/auth/change-email',
        'POST',
        { new_email: 'alice.updated@eyeflow.app', current_password: 'AlicePassword123!' },
        tokenA
      );
      assert(validEmailChange.status === 200, 'User A email changed successfully');
      assert(validEmailChange.body.user.email === 'alice.updated@eyeflow.app', 'User A email updated in profile');

      // Login with new email
      const newEmailLogin = await request('/auth/login', 'POST', {
        email: 'alice.updated@eyeflow.app',
        password: 'AlicePassword123!',
      });
      assert(newEmailLogin.status === 200 && newEmailLogin.body.token, 'Login with new email succeeds');

      // 6. Delete Account with Confirmation
      console.log('\n--- TEST GROUP 5: DELETE ACCOUNT ---');
      // User A logs some data before deletion
      await request('/reminders', 'POST', { type: 'water', scheduled_at: new Date().toISOString(), status: 'completed' }, tokenA);

      // Attempt deletion with wrong password
      const wrongPassDelete = await request('/auth/me', 'DELETE', { password: 'WrongPassword' }, tokenA);
      assert(wrongPassDelete.status === 401, 'Rejects account deletion with incorrect password', wrongPassDelete);

      // Valid deletion
      const validDelete = await request('/auth/me', 'DELETE', { password: 'AlicePassword123!' }, tokenA);
      assert(validDelete.status === 200 && validDelete.body.deleted === true, 'User A account permanently deleted');

      // Verify User A can no longer access /auth/me or log in
      const deletedMe = await request('/auth/me', 'GET', null, tokenA);
      assert(deletedMe.status === 401, 'Deleted User A token rejected with 401');

      const deletedLogin = await request('/auth/login', 'POST', {
        email: 'alice.updated@eyeflow.app',
        password: 'AlicePassword123!',
      });
      assert(deletedLogin.status === 404, 'Deleted user cannot log in (Account not found)');

      // Verify User B is completely unharmed
      const userBCheck = await request('/auth/me', 'GET', null, tokenB);
      assert(userBCheck.status === 200 && userBCheck.body.user.email === 'bob.profile@eyeflow.app', 'User B unaffected by User A account deletion');

      console.log('\n====================================================');
      console.log('✓ ALL PHASE 3 USER PROFILE TESTS PASSED!            ');
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

runProfileTests();
