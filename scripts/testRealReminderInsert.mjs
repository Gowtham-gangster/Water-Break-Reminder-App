// scripts/testRealReminderInsert.mjs
// Directly test Supabase reminder_events insert with current config & anon key

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../src/config/supabase.config.ts';

console.log('Supabase URL:', SUPABASE_CONFIG.url);
console.log('Supabase Key:', SUPABASE_CONFIG.anonKey ? 'Present' : 'Missing');

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

async function run() {
  console.log('\n--- 1. Testing Supabase Connectivity & reminder_events Table ---');
  
  // Test query on reminder_events
  const { data: selectData, error: selectError } = await supabase
    .from('reminder_events')
    .select('*')
    .limit(5);

  console.log('Select Result:', {
    count: selectData ? selectData.length : 0,
    rows: selectData,
    error: selectError ? selectError.message : null,
  });

  console.log('\n--- 2. Checking Current Auth Session ---');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  console.log('Session User:', sessionData?.session?.user?.id || 'No active CLI session (expected for anon)');

  console.log('\n--- 3. Testing Sign In / Insert Flow ---');
  // Attempt with test user or inspect table schema
  const { data: rpcData, error: rpcError } = await supabase
    .from('reminder_events')
    .select('id, user_id, type, status, scheduled_at')
    .limit(1);

  console.log('Table Accessible via Anon:', !rpcError);
  if (rpcError) {
    console.error('Table Query Error:', rpcError);
  }
}

run().catch(console.error);
