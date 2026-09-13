// scripts/testSupabaseConnectionAndHealth.mjs
// Execute and verify checkSupabaseConnection() diagnostic health check

import { checkSupabaseConnection } from '../src/services/healthCheckService.ts';
import { SUPABASE_CONFIG } from '../src/config/supabase.config.ts';

console.log('====================================================');
console.log('      EYEFLOW SUPABASE CONNECTION HEALTH CHECK      ');
console.log('====================================================\n');

async function run() {
  console.log('--- 1. Testing Config Constants ---');
  console.log('SUPABASE URL:                  ', SUPABASE_CONFIG.url);
  console.log('SUPABASE ANON KEY:             ', SUPABASE_CONFIG.anonKey ? 'PRESENT (Valid format)' : 'MISSING');
  console.log('IS CONFIGURED:                 ', SUPABASE_CONFIG.isConfigured);

  console.log('\n--- 2. Running checkSupabaseConnection() ---');
  const report = await checkSupabaseConnection();

  console.log('DIAGNOSTIC REPORT:');
  console.log('Configured:                    ', report.configured);
  console.log('Auth Reachable:                ', report.authReachable);
  console.log('Database Reachable:            ', report.databaseReachable);
  console.log('Authenticated:                 ', report.authenticated);
  console.log('User ID:                       ', report.userId || 'No session (Anon client check)');
  console.log('Project Domain:                ', report.project);
  console.log('Latency:                       ', `${report.latencyMs}ms`);
  console.log('Table Access:');
  Object.entries(report.tables).forEach(([tbl, ok]) => {
    console.log(`  - ${tbl.padEnd(28)}: ${ok ? '✓ REACHABLE' : '✗ FAILED'}`);
  });

  const allTablesOk = Object.values(report.tables).every(Boolean);
  const success = report.configured && report.authReachable && report.databaseReachable && allTablesOk;

  console.log('\n====================================================');
  console.log('SUPABASE HEALTH RESULT:        ', success ? 'PASS (100% HEALTHY)' : 'FAIL');
  console.log('====================================================\n');

  if (!success) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
