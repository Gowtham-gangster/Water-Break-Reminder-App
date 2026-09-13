import assert from 'node:assert';
import { db } from '../server/db/database.ts';

console.log('--- EYEFLOW V2: PHASE 8 - USER-SPECIFIC STATISTICS TEST SUITE ---');

// 1. Create two test users (User A and User B)
const nowIso = new Date().toISOString();
const userA = db.insertUser({
  id: db.generateId('usr'),
  email: `stats_user_a_${Date.now()}@example.com`,
  password_hash: 'hash_a',
  full_name: 'User A Stats',
  email_verified: true,
  is_anonymous: false,
  created_at: nowIso,
  updated_at: nowIso,
});

const userB = db.insertUser({
  id: db.generateId('usr'),
  email: `stats_user_b_${Date.now()}@example.com`,
  password_hash: 'hash_b',
  full_name: 'User B Stats',
  email_verified: true,
  is_anonymous: false,
  created_at: nowIso,
  updated_at: nowIso,
});

console.log('✓ Created test users: User A and User B');

// 2. Setup dates for testing streaks and filters
const now = new Date();
const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const todayStr = formatDate(now);

const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = formatDate(yesterday);

const day2Ago = new Date(now);
day2Ago.setDate(day2Ago.getDate() - 2);
const day2AgoStr = formatDate(day2Ago);

const day3Ago = new Date(now);
day3Ago.setDate(day3Ago.getDate() - 3);
const day3AgoStr = formatDate(day3Ago);

const day10Ago = new Date(now);
day10Ago.setDate(day10Ago.getDate() - 10);
const day10AgoStr = formatDate(day10Ago);

// 3. Seed User A Events
// Today: 2 water completed, 1 screen completed, 1 water missed
db.insertReminderEvent(userA.id, {
  type: 'water',
  scheduled_at: `${todayStr}T09:00:00Z`,
  completed_at: `${todayStr}T09:02:00Z`,
  status: 'completed',
});
db.insertReminderEvent(userA.id, {
  type: 'water',
  scheduled_at: `${todayStr}T10:00:00Z`,
  completed_at: `${todayStr}T10:02:00Z`,
  status: 'completed',
});
db.insertReminderEvent(userA.id, {
  type: 'screen',
  scheduled_at: `${todayStr}T10:30:00Z`,
  completed_at: `${todayStr}T10:35:00Z`,
  status: 'completed',
});
db.insertReminderEvent(userA.id, {
  type: 'water',
  scheduled_at: `${todayStr}T11:00:00Z`,
  status: 'missed',
});

// Yesterday: 2 water completed
db.insertReminderEvent(userA.id, {
  type: 'water',
  scheduled_at: `${yesterdayStr}T14:00:00Z`,
  completed_at: `${yesterdayStr}T14:02:00Z`,
  status: 'completed',
});
db.insertReminderEvent(userA.id, {
  type: 'water',
  scheduled_at: `${yesterdayStr}T15:00:00Z`,
  completed_at: `${yesterdayStr}T15:02:00Z`,
  status: 'completed',
});

// 2 Days Ago: 1 screen completed
db.insertReminderEvent(userA.id, {
  type: 'screen',
  scheduled_at: `${day2AgoStr}T16:00:00Z`,
  completed_at: `${day2AgoStr}T16:05:00Z`,
  status: 'completed',
});

// 3 Days Ago: 1 water completed
db.insertReminderEvent(userA.id, {
  type: 'water',
  scheduled_at: `${day3AgoStr}T11:00:00Z`,
  completed_at: `${day3AgoStr}T11:02:00Z`,
  status: 'completed',
});

// 10 Days Ago: 1 screen completed
db.insertReminderEvent(userA.id, {
  type: 'screen',
  scheduled_at: `${day10AgoStr}T09:00:00Z`,
  completed_at: `${day10AgoStr}T09:05:00Z`,
  status: 'completed',
});

// 4. Seed User B Events (User B has different history)
db.insertReminderEvent(userB.id, {
  type: 'water',
  scheduled_at: `${todayStr}T08:00:00Z`,
  completed_at: `${todayStr}T08:02:00Z`,
  status: 'completed',
});
db.insertReminderEvent(userB.id, {
  type: 'screen',
  scheduled_at: `${todayStr}T08:30:00Z`,
  status: 'missed',
});

console.log('✓ Seeded test events for User A and User B');

// 5. Test User Isolation in Statistics
const statsA = db.getUserStatistics(userA.id);
const statsB = db.getUserStatistics(userB.id);

assert.strictEqual(statsA.waterCompleted, 5, 'User A waterCompleted should be 5');
assert.strictEqual(statsA.waterMissed, 1, 'User A waterMissed should be 1');
assert.strictEqual(statsA.screenCompleted, 3, 'User A screenCompleted should be 3');
assert.strictEqual(statsA.screenMissed, 0, 'User A screenMissed should be 0');
assert.strictEqual(statsA.totalWaterReminders, 6, 'User A totalWaterReminders should be 6');
assert.strictEqual(statsA.totalScreenBreaks, 3, 'User A totalScreenBreaks should be 3');

// User B must be completely isolated
assert.strictEqual(statsB.waterCompleted, 1, 'User B waterCompleted should be 1');
assert.strictEqual(statsB.screenMissed, 1, 'User B screenMissed should be 1');
assert.strictEqual(statsB.totalWaterReminders, 1, 'User B totalWaterReminders should be 1');
assert.strictEqual(statsB.totalScreenBreaks, 1, 'User B totalScreenBreaks should be 1');

console.log('✓ User isolation verified: User A stats strictly separate from User B');

// 6. Test Streak Calculation for User A
// Consecutive days completed: today, yesterday, 2 days ago, 3 days ago = 4 consecutive days
assert.strictEqual(statsA.currentStreak, 4, `User A current streak should be 4 days, got ${statsA.currentStreak}`);
assert.strictEqual(statsA.bestStreak, 4, `User A best streak should be 4 days, got ${statsA.bestStreak}`);

// User B streak: only today = 1 day
assert.strictEqual(statsB.currentStreak, 1, `User B current streak should be 1 day, got ${statsB.currentStreak}`);

console.log('✓ Streak calculation verified: consecutive day streaks calculated accurately');

// 7. Test Today Dashboard Progress
assert.strictEqual(statsA.today.waterCompleted, 2, 'User A today waterCompleted should be 2');
assert.strictEqual(statsA.today.waterScheduled, 3, 'User A today waterScheduled should be 3');
assert.strictEqual(statsA.today.screenCompleted, 1, 'User A today screenCompleted should be 1');
assert.strictEqual(statsA.today.screenScheduled, 1, 'User A today screenScheduled should be 1');
assert.strictEqual(statsA.dailyCompletionRate, 75, `User A daily completion rate should be 75%, got ${statsA.dailyCompletionRate}%`);

console.log("✓ Today's dashboard progress verified: water completed/scheduled and screen completed/scheduled");

// 8. Test History Filtering (User A)
// Today filter
const historyToday = db.getUserHistory(userA.id, { range: 'today' });
assert.strictEqual(historyToday.total, 4, `History 'today' should have 4 events, got ${historyToday.total}`);
assert.strictEqual(historyToday.events.length, 4);

// Yesterday filter
const historyYesterday = db.getUserHistory(userA.id, { range: 'yesterday' });
assert.strictEqual(historyYesterday.total, 2, `History 'yesterday' should have 2 events, got ${historyYesterday.total}`);

// Custom Date Range filter (day 3 ago to day 2 ago)
const historyCustom = db.getUserHistory(userA.id, {
  range: 'custom',
  startDate: `${day3AgoStr}T00:00:00Z`,
  endDate: `${day2AgoStr}T23:59:59Z`,
});
assert.strictEqual(historyCustom.total, 2, `History 'custom' should have 2 events, got ${historyCustom.total}`);

// 9. Test Pagination
const historyPage1 = db.getUserHistory(userA.id, { limit: 3, page: 1 });
assert.strictEqual(historyPage1.events.length, 3, 'Page 1 limit 3 should return 3 events');
assert.strictEqual(historyPage1.page, 1);
assert.strictEqual(historyPage1.totalPages, 3); // 9 total / 3 = 3 pages
assert.strictEqual(historyPage1.total, 9);

const historyPage2 = db.getUserHistory(userA.id, { limit: 3, page: 2 });
assert.strictEqual(historyPage2.events.length, 3, 'Page 2 should return 3 events');
assert.notDeepStrictEqual(historyPage1.events[0].id, historyPage2.events[0].id, 'Page 2 events must differ from Page 1');

// User B history must not include User A's events
const historyUserB = db.getUserHistory(userB.id);
assert.strictEqual(historyUserB.total, 2, 'User B should have exactly 2 history events');
assert(historyUserB.events.every((e) => e.user_id === userB.id), 'All events in User B history must belong to User B');

console.log('✓ Range filtering & pagination verified: page sizes, limits, and date slices accurate');
console.log('\n--- ALL PHASE 8 USER-SPECIFIC STATISTICS TESTS PASSED ---');
