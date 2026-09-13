// scripts/testSupabaseAuthAndInsert.mjs
// Test user signup/signin + reminder_events insert with RLS

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../src/config/supabase.config.ts';

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

async function testAuthAndInsert() {
  console.log('--- 1. Testing Auth SignIn / SignUp for Test User ---');
  const testEmail = `eyeflow_test_${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: { display_name: 'Test Flow User' },
    },
  });

  if (signUpError) {
    console.error('Sign Up Error:', signUpError);
    return;
  }

  const user = signUpData.user;
  console.log('Created User ID:', user?.id);

  if (!signUpData.session) {
    console.log('Session not returned on signup (requires sign in)...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInError) {
      console.error('Sign In Error:', signInError);
      return;
    }
    console.log('Signed In Successfully! Session User:', signInData.user.id);
  } else {
    console.log('Signed In directly on signup!');
  }

  console.log('\n--- 2. Testing Insert into reminder_events ---');
  const testEventId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const now = new Date().toISOString();

  const { data: insertData, error: insertError } = await supabase
    .from('reminder_events')
    .insert({
      id: testEventId,
      user_id: user.id,
      type: 'water',
      scheduled_at: now,
      started_at: now,
      completed_at: null,
      status: 'triggered',
    })
    .select();

  console.log('Insert Result:', {
    success: !insertError,
    data: insertData,
    error: insertError ? { message: insertError.message, code: insertError.code, details: insertError.details } : null,
  });

  console.log('\n--- 3. Testing Update to completed on reminder_events ---');
  const { data: updateData, error: updateError } = await supabase
    .from('reminder_events')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', testEventId)
    .select();

  console.log('Update Result:', {
    success: !updateError,
    data: updateData,
    error: updateError ? { message: updateError.message, code: updateError.code } : null,
  });

  console.log('\n--- 4. Testing Select user history from reminder_events ---');
  const { data: historyData, error: historyError } = await supabase
    .from('reminder_events')
    .select('*')
    .eq('user_id', user.id);

  console.log('History Rows for User:', historyData?.length, historyData);
}

testAuthAndInsert().catch(console.error);
