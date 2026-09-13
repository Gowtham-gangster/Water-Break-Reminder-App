// scripts/verifyV2DatabaseOps.mjs
// EyeFlow V2 — Database Production, Backup & Rollback Verification Script

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { Database } from '../server/db/database.ts';

const testDbPath = path.resolve(process.cwd(), `eyeflow_ops_test_${Date.now()}.json`);
const backupDbPath = path.resolve(process.cwd(), `eyeflow_ops_backup_${Date.now()}.json`);

console.log('================================================================');
console.log('       EYEFLOW V2: PRODUCTION DATABASE & ROLLBACK OPS           ');
console.log('================================================================\n');

try {
  // 1. Initialize Test Database
  const db = new Database(testDbPath);
  console.log('✓ Initialized test database at:', testDbPath);

  // 2. Schema Verification: Insert Seed User & Related Entities
  const nowIso = new Date().toISOString();
  const seedUser = db.insertUser({
    id: db.generateId('usr'),
    email: `prod_ops_${Date.now()}@example.com`,
    password_hash: 'argon2_hashed_secret',
    display_name: 'Production Ops User',
    avatar_url: null,
    timezone: 'UTC',
    created_at: nowIso,
    updated_at: nowIso,
  });
  assert(seedUser && seedUser.id, 'Seed user creation must succeed');
  console.log('✓ [SCHEMA] User entity insertion validated');

  const settings = db.upsertSettings(seedUser.id, {
    theme: 'dark',
    time_format: '24h',
    sound_enabled: true,
    notifications_enabled: true,
    water_sound: 'chime',
    look_outside_sound: 'bell',
    water_default_duration: 2,
    look_outside_default_duration: 5,
  });
  assert(settings && settings.theme === 'dark', 'User settings insertion must succeed');
  console.log('✓ [SCHEMA] User settings entity insertion validated');

  const waterCfg = db.upsertWaterConfig(seedUser.id, {
    enabled: true,
    interval_minutes: 45,
    start_time: '08:30',
    end_time: '18:30',
    duration_seconds: 120,
    active_days: [1, 2, 3, 4, 5],
  });
  assert(waterCfg && waterCfg.interval_minutes === 45, 'Water configuration entity insertion must succeed');
  console.log('✓ [SCHEMA] Water configuration entity insertion validated');

  const screenCfg = db.upsertLookOutsideConfig(seedUser.id, {
    enabled: true,
    interval_minutes: 20,
    start_time: '09:00',
    end_time: '17:00',
    duration_seconds: 300,
    active_days: [1, 2, 3, 4, 5],
  });
  assert(screenCfg && screenCfg.interval_minutes === 20, 'Look outside configuration entity insertion must succeed');
  console.log('✓ [SCHEMA] Look Outside configuration entity insertion validated');

  // Insert Reminder Event
  const event = db.insertReminderEvent(seedUser.id, {
    type: 'water',
    scheduled_at: nowIso,
    completed_at: nowIso,
    status: 'completed',
  });
  assert(event && event.status === 'completed', 'Reminder event insertion must succeed');
  console.log('✓ [SCHEMA] Reminder event entity insertion validated');

  // 3. Database Backup / Snapshot Creation
  db.save();
  assert(fs.existsSync(testDbPath), 'Database file must be written to disk');
  fs.copyFileSync(testDbPath, backupDbPath);
  assert(fs.existsSync(backupDbPath), 'Backup snapshot must exist');
  console.log('✓ [BACKUP] Point-in-time database snapshot created at:', backupDbPath);

  // 4. Data Modification Simulation (Accidental Deletion or Bad Migration)
  console.log('\n--- Simulating Accidental Modification / Data Corruption ---');
  db.upsertWaterConfig(seedUser.id, {
    interval_minutes: 999, // Bad value
  });
  db.insertReminderEvent(seedUser.id, {
    type: 'water',
    scheduled_at: '2099-01-01T00:00:00Z',
    status: 'missed',
  });
  db.save();

  const corruptedCfg = db.getWaterConfigByUserId(seedUser.id);
  assert.strictEqual(corruptedCfg.interval_minutes, 999, 'Bad state present before rollback');
  console.log('✓ Bad modification applied (interval = 999)');

  // 5. Point-in-Time Rollback Verification
  console.log('\n--- Executing Database Rollback from Backup Snapshot ---');
  fs.copyFileSync(backupDbPath, testDbPath);
  
  // Reload database instance from restored file
  const restoredDb = new Database(testDbPath);
  const restoredCfg = restoredDb.getWaterConfigByUserId(seedUser.id);
  assert.strictEqual(restoredCfg.interval_minutes, 45, 'Restored database must revert to original interval');
  
  const restoredStats = restoredDb.getUserStatistics(seedUser.id);
  assert.strictEqual(restoredStats.waterCompleted, 1, 'Restored database must retain original completed events');
  console.log('✓ [ROLLBACK] Database successfully rolled back to pre-incident state (interval restored to 45)');

  // 6. Row-Level Security Verification
  console.log('\n--- Verifying Row-Level User Isolation & Ownership Security ---');
  const userB = restoredDb.insertUser({
    id: restoredDb.generateId('usr'),
    email: `intruder_${Date.now()}@example.com`,
    password_hash: 'hash_b',
    display_name: 'Intruder User',
    created_at: nowIso,
    updated_at: nowIso,
  });

  // User B attempts to access User A's config/stats
  const bStats = restoredDb.getUserStatistics(userB.id);
  assert.strictEqual(bStats.waterCompleted, 0, 'User B stats must be completely isolated (0 water completed)');
  assert.strictEqual(bStats.totalWaterReminders, 0, 'User B must see zero User A reminders');

  const bEvents = restoredDb.getUserHistory(userB.id);
  assert.strictEqual(bEvents.total, 0, 'User B must see 0 events');
  console.log('✓ [SECURITY] Strict row-level user data isolation verified');

  console.log('\n================================================================');
  console.log('   ✓ ALL DATABASE PRODUCTION & ROLLBACK OPS PASSED (100% PASS)  ');
  console.log('================================================================\n');
} finally {
  // Safe cleanup of temporary verification databases
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(backupDbPath)) fs.unlinkSync(backupDbPath);
  } catch (_) {}
}
