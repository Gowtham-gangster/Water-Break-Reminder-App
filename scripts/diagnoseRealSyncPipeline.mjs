// scripts/diagnoseRealSyncPipeline.mjs
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../src/config/supabase.config.ts';

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

async function diagnose() {
  console.log('====================================================');
  console.log('      EYEFLOW REAL-WORLD SYNC PIPELINE DIAGNOSIS    ');
  console.log('====================================================\n');

  const testEmail = `eyeflow_diag_${Date.now()}@gmail.com`;
  const testPassword = 'Password123!';

  console.log('1. Signing up authenticated test account...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: { display_name: 'Diag User' },
    },
  });

  console.log('SignUp result:', { user: authData?.user?.id, session: !!authData?.session, error: authError });

  if (authError) {
    console.error('Auth signup failed:', authError);
    return;
  }

  let session = authData?.session;
  let user = authData?.user;
  if (!session) {
    const signIn = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    console.log('SignIn result:', { user: signIn?.data?.user?.id, session: !!signIn?.data?.session, error: signIn?.error });
    session = signIn.data?.session;
    user = signIn.data?.user;
  }

  if (!user) {
    console.error('Could not authenticate user!');
    return;
  }

  console.log('✓ Authenticated User ID:', user.id);

  // 2. Query initial trigger rows
  console.log('\n2. Inspecting auto-provisioned rows in Supabase:');
  const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id);
  console.log('Profiles query count:', prof?.length, 'error:', profErr?.message || 'NONE', prof?.[0]);

  const { data: water, error: waterErr } = await supabase.from('water_configurations').select('*').eq('user_id', user.id);
  console.log('Water configs count:', water?.length, 'error:', waterErr?.message || 'NONE', water?.[0]);

  const { data: look, error: lookErr } = await supabase.from('look_outside_configurations').select('*').eq('user_id', user.id);
  console.log('Look outside count:', look?.length, 'error:', lookErr?.message || 'NONE', look?.[0]);

  const { data: sett, error: settErr } = await supabase.from('user_settings').select('*').eq('user_id', user.id);
  console.log('User settings count:', sett?.length, 'error:', settErr?.message || 'NONE', sett?.[0]);

  // 3. Testing UPDATE on water_configurations
  console.log('\n3. Testing UPDATE on water_configurations (e.g. interval_minutes = 45):');
  const updateWaterRes = await supabase
    .from('water_configurations')
    .update({ interval_minutes: 45, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select();
  console.log('Update result data:', updateWaterRes.data, 'error:', updateWaterRes.error);

  // 4. Testing UPDATE on profiles (e.g. avatar_url)
  console.log('\n4. Testing UPDATE on profiles (avatar_url):');
  const testAvatarUrl = `https://supabase.co/storage/v1/object/public/avatars/${user.id}/avatar_${Date.now()}.webp`;
  const updateProfileRes = await supabase
    .from('profiles')
    .update({ avatar_url: testAvatarUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select();
  console.log('Update profile data:', updateProfileRes.data, 'error:', updateProfileRes.error);

  // 5. Test Realtime Channel Listeners
  console.log('\n5. Testing Supabase Realtime Channel Subscription for postgres_changes...');
  let realtimeReceived = false;

  const channel = supabase
    .channel(`diag_sync_${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'water_configurations',
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        console.log('>>> [REALTIME EVENT RECEIVED] water_configurations:', payload);
        realtimeReceived = true;
      }
    )
    .subscribe(async (status) => {
      console.log('Realtime subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Sending another update to trigger Realtime event...');
        await supabase
          .from('water_configurations')
          .update({ interval_minutes: 60, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
      }
    });

  // Wait 4 seconds for realtime event
  await new Promise((resolve) => setTimeout(resolve, 4000));
  console.log('Realtime event received status:', realtimeReceived ? '✓ PASS' : '✗ NOT RECEIVED (Publication / Schema check needed)');

  supabase.removeChannel(channel);
}

diagnose().catch(console.error);
