import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Database, db } from '../server/db/database.ts';
import { createServer } from '../server/index.ts';
import { generateToken } from '../server/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, '..', 'eyeflow_v2_auth_test.json');

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Instantiate clean test database
const testDb = new Database(TEST_DB_PATH);
Object.assign(db, testDb);

process.env.NODE_ENV = 'test';
const app = createServer();
const server = http.createServer(app);

const PORT = 5566;
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
    server.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

async function runAuthTests() {
  console.log('====================================================');
  console.log('       EYEFLOW V2 — PHASE 2 AUTHENTICATION SUITE    ');
  console.log('====================================================\n');

  server.listen(PORT, async () => {
    try {
      // 1. Sign Up - Required Field & Format Validations
      console.log('--- TEST GROUP 1: SIGN UP & VALIDATION ---');
      const emptyEmail = await request('/auth/register', 'POST', { password: 'password123' });
      assert(emptyEmail.status === 400, 'Rejects registration when email is missing');

      const invalidEmail = await request('/auth/register', 'POST', { email: 'notanemail', password: 'password123' });
      assert(invalidEmail.status === 400, 'Rejects registration with invalid email format');

      const shortPassword = await request('/auth/register', 'POST', { email: 'user@example.com', password: '123' });
      assert(shortPassword.status === 400, 'Rejects password shorter than 6 characters');

      // 2. Successful Sign Up (User A)
      const userAReg = await request('/auth/register', 'POST', {
        email: 'alice@eyeflow.app',
        password: 'SecurePassword123!',
        display_name: 'Alice Designer',
      });
      assert(userAReg.status === 201 && userAReg.body.token, 'User A registered successfully with JWT');
      assert(userAReg.body.user.email === 'alice@eyeflow.app', 'User A email properly stored');
      assert(userAReg.body.user.display_name === 'Alice Designer', 'User A display name properly stored');
      const tokenA = userAReg.body.token;

      // Duplicate registration check
      const dupUserA = await request('/auth/register', 'POST', {
        email: 'alice@eyeflow.app',
        password: 'DifferentPassword123!',
      });
      assert(dupUserA.status === 409, 'Rejects duplicate email registration with 409 Conflict');

      // 3. Login & Invalid Credentials Testing
      console.log('\n--- TEST GROUP 2: LOGIN & CREDENTIALS ---');
      const nonExistentLogin = await request('/auth/login', 'POST', {
        email: 'nonexistent@eyeflow.app',
        password: 'password123',
      });
      assert(nonExistentLogin.status === 404 && nonExistentLogin.body.error === 'Account not found', 'Returns "Account not found" (404) for unknown email');

      const wrongPasswordLogin = await request('/auth/login', 'POST', {
        email: 'alice@eyeflow.app',
        password: 'WrongPassword456!',
      });
      assert(wrongPasswordLogin.status === 401 && wrongPasswordLogin.body.error === 'Incorrect password', 'Returns "Incorrect password" (401) for bad password');

      const successfulLogin = await request('/auth/login', 'POST', {
        email: 'alice@eyeflow.app',
        password: 'SecurePassword123!',
      });
      assert(successfulLogin.status === 200 && successfulLogin.body.token, 'Successful login returns valid JWT token and user profile');

      // 4. Session Persistence & /auth/me
      console.log('\n--- TEST GROUP 3: SESSION PERSISTENCE & TOKENS ---');
      const sessionMe = await request('/auth/me', 'GET', null, tokenA);
      assert(sessionMe.status === 200 && sessionMe.body.user.id === userAReg.body.user.id, 'Session verified via /auth/me with valid Bearer token');

      // 5. Expired / Invalid Session
      const fakeToken = 'eyeflow.invalid.jwt.signature';
      const invalidSession = await request('/auth/me', 'GET', null, fakeToken);
      assert(invalidSession.status === 401, 'Rejects malformed/invalid JWT token with 401');

      // Expired token simulation (expired 1 hour ago)
      const expiredToken = generateToken(userAReg.body.user, -3600);
      const expiredSession = await request('/auth/me', 'GET', null, expiredToken);
      assert(expiredSession.status === 401, 'Rejects expired token with 401 Unauthorized');

      // 6. Password Reset Flow
      console.log('\n--- TEST GROUP 4: PASSWORD RESET FLOW ---');
      const forgotReq = await request('/auth/forgot-password', 'POST', {
        email: 'alice@eyeflow.app',
      });
      assert(forgotReq.status === 200 && forgotReq.body.reset_token, 'Forgot password initiates reset and issues token');
      const resetToken = forgotReq.body.reset_token;

      // Reset password with token
      const resetReq = await request('/auth/reset-password', 'POST', {
        token: resetToken,
        new_password: 'NewSecurePassword789!',
      });
      assert(resetReq.status === 200, 'Password reset succeeded with valid reset token');

      // Attempt to reuse token (must fail)
      const reuseTokenReq = await request('/auth/reset-password', 'POST', {
        token: resetToken,
        new_password: 'AnotherPassword999!',
      });
      assert(reuseTokenReq.status === 400, 'Re-using consumed reset token is rejected');

      // Login with old password (must fail)
      const oldPassLogin = await request('/auth/login', 'POST', {
        email: 'alice@eyeflow.app',
        password: 'SecurePassword123!',
      });
      assert(oldPassLogin.status === 401, 'Login with old password fails after reset');

      // Login with new password (must succeed)
      const newPassLogin = await request('/auth/login', 'POST', {
        email: 'alice@eyeflow.app',
        password: 'NewSecurePassword789!',
      });
      assert(newPassLogin.status === 200 && newPassLogin.body.token, 'Login with newly reset password succeeds');
      const freshTokenA = newPassLogin.body.token;

      // 7. Email Verification Flow
      console.log('\n--- TEST GROUP 5: EMAIL VERIFICATION ---');
      const sendCode = await request('/auth/send-verification', 'POST', { email: 'alice@eyeflow.app' });
      assert(sendCode.status === 200 && sendCode.body.code, 'Verification code generated for user email');

      const verifyInvalid = await request('/auth/verify-email', 'POST', { email: 'alice@eyeflow.app', code: '000000' });
      assert(verifyInvalid.status === 400, 'Invalid verification code rejected');

      const verifyValid = await request('/auth/verify-email', 'POST', { email: 'alice@eyeflow.app', code: sendCode.body.code });
      assert(verifyValid.status === 200 && verifyValid.body.verified === true, 'Valid verification code successfully verified');

      // 8. Account Switching & Multi-User Isolation (User A -> User B)
      console.log('\n--- TEST GROUP 6: ACCOUNT SWITCHING & ISOLATION ---');
      // User A customizes water config to 15 minutes
      await request('/water', 'PUT', { enabled: true, interval_minutes: 15, duration_seconds: 180 }, freshTokenA);

      // User A logs a water reminder
      await request('/reminders', 'POST', { type: 'water', scheduled_at: new Date().toISOString(), status: 'completed' }, freshTokenA);

      // User B registers & logs in
      const userBReg = await request('/auth/register', 'POST', {
        email: 'bob@eyeflow.app',
        password: 'BobSecurePassword123!',
        display_name: 'Bob Engineer',
      });
      assert(userBReg.status === 201 && userBReg.body.token, 'User B registered successfully');
      const tokenB = userBReg.body.token;

      // Verify User B has default water config (45 minutes), NOT User A's (15 minutes)
      const userBWater = await request('/water', 'GET', null, tokenB);
      assert(userBWater.body.config.interval_minutes === 45, 'User B configuration is strictly isolated (does not inherit User A config)');

      // Verify User B has 0 reminder logs (does not inherit User A events)
      const userBReminders = await request('/reminders', 'GET', null, tokenB);
      assert(userBReminders.body.events.length === 0, 'User B events are strictly isolated (does not inherit User A history)');

      console.log('\n====================================================');
      console.log('✓ ALL 8 PHASE 2 AUTHENTICATION TEST SUITES PASSED!  ');
      console.log('====================================================\n');

      server.close();
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      process.exit(0);
    } catch (err) {
      console.error('Test execution exception:', err);
      server.close();
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      process.exit(1);
    }
  });
}

runAuthTests();
