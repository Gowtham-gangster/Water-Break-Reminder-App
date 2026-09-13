-- ==============================================================================
-- PauseFlow — Complete Unified PostgreSQL Schema, Storage & Security Migration
-- Migration: 00001_initial_schema.sql
-- Purpose: Unified schema including profiles, settings, configurations, 
--          pause state, events, storage bucket, indexes, RLS, and Realtime sync
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. USER_SETTINGS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
    time_format TEXT NOT NULL DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
    sound_enabled BOOLEAN NOT NULL DEFAULT true,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    default_water_duration INTEGER NOT NULL DEFAULT 120, -- in seconds
    default_look_outside_duration INTEGER NOT NULL DEFAULT 300, -- in seconds
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. WATER_CONFIGURATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.water_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    interval_minutes INTEGER NOT NULL DEFAULT 45 CHECK (interval_minutes > 0),
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    duration_seconds INTEGER NOT NULL DEFAULT 120 CHECK (duration_seconds > 0),
    active_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. LOOK_OUTSIDE_CONFIGURATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.look_outside_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    interval_minutes INTEGER NOT NULL DEFAULT 20 CHECK (interval_minutes > 0),
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    duration_seconds INTEGER NOT NULL DEFAULT 20 CHECK (duration_seconds > 0),
    active_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. REMINDER_EVENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reminder_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('water', 'look_outside')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'triggered', 'completed', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. DEVICE_REGISTRATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.device_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('windows', 'android', 'web', 'macos', 'linux', 'ios')),
    device_name TEXT,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- ==============================================================================
-- 7. REMINDER_PAUSE_STATE TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reminder_pause_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    paused_until TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    paused_by_device_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. INDEXES FOR HIGH-SPEED QUERYING & DELTA SYNC
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_water_configs_user_id ON public.water_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_water_configs_user_updated ON public.water_configurations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_look_outside_configs_user_id ON public.look_outside_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_look_outside_configs_user_updated ON public.look_outside_configurations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_sched ON public.reminder_events(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_status ON public.reminder_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_sched_status ON public.reminder_events(user_id, scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_updated_at ON public.reminder_events(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_reg_user_id ON public.device_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_device_reg_last_seen ON public.device_registrations(last_seen DESC);

-- ==============================================================================
-- 9. TRIGGERS & AUTO-UPDATE TIMESTAMP FUNCTIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER set_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_water_configs_updated_at ON public.water_configurations;
CREATE TRIGGER set_water_configs_updated_at BEFORE UPDATE ON public.water_configurations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_look_outside_configs_updated_at ON public.look_outside_configurations;
CREATE TRIGGER set_look_outside_configs_updated_at BEFORE UPDATE ON public.look_outside_configurations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_reminder_events_updated_at ON public.reminder_events;
CREATE TRIGGER set_reminder_events_updated_at BEFORE UPDATE ON public.reminder_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_device_registrations_updated_at ON public.device_registrations;
CREATE TRIGGER set_device_registrations_updated_at BEFORE UPDATE ON public.device_registrations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_reminder_pause_state_updated_at ON public.reminder_pause_state;
CREATE TRIGGER set_reminder_pause_state_updated_at BEFORE UPDATE ON public.reminder_pause_state FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-provision user records on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, timezone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.water_configurations (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.look_outside_configurations (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.look_outside_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_pause_state ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User Settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Water Configurations
DROP POLICY IF EXISTS "Users can view own water config" ON public.water_configurations;
CREATE POLICY "Users can view own water config" ON public.water_configurations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own water config" ON public.water_configurations;
CREATE POLICY "Users can update own water config" ON public.water_configurations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own water config" ON public.water_configurations;
CREATE POLICY "Users can insert own water config" ON public.water_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Look Outside Configurations
DROP POLICY IF EXISTS "Users can view own look outside config" ON public.look_outside_configurations;
CREATE POLICY "Users can view own look outside config" ON public.look_outside_configurations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own look outside config" ON public.look_outside_configurations;
CREATE POLICY "Users can update own look outside config" ON public.look_outside_configurations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own look outside config" ON public.look_outside_configurations;
CREATE POLICY "Users can insert own look outside config" ON public.look_outside_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reminder Events
DROP POLICY IF EXISTS "Users can view own events" ON public.reminder_events;
CREATE POLICY "Users can view own events" ON public.reminder_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own events" ON public.reminder_events;
CREATE POLICY "Users can insert own events" ON public.reminder_events FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own events" ON public.reminder_events;
CREATE POLICY "Users can update own events" ON public.reminder_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own events" ON public.reminder_events;
CREATE POLICY "Users can delete own events" ON public.reminder_events FOR DELETE USING (auth.uid() = user_id);

-- Device Registrations
DROP POLICY IF EXISTS "Users can view own devices" ON public.device_registrations;
CREATE POLICY "Users can view own devices" ON public.device_registrations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own devices" ON public.device_registrations;
CREATE POLICY "Users can insert own devices" ON public.device_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own devices" ON public.device_registrations;
CREATE POLICY "Users can update own devices" ON public.device_registrations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own devices" ON public.device_registrations;
CREATE POLICY "Users can delete own devices" ON public.device_registrations FOR DELETE USING (auth.uid() = user_id);

-- Reminder Pause State
DROP POLICY IF EXISTS "Users can view own pause state" ON public.reminder_pause_state;
CREATE POLICY "Users can view own pause state" ON public.reminder_pause_state FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own pause state" ON public.reminder_pause_state;
CREATE POLICY "Users can insert own pause state" ON public.reminder_pause_state FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own pause state" ON public.reminder_pause_state;
CREATE POLICY "Users can update own pause state" ON public.reminder_pause_state FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 11. STORAGE BUCKET (AVATARS) & STORAGE RLS POLICIES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
CREATE POLICY "avatars_user_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
CREATE POLICY "avatars_user_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_user_delete" ON storage.objects;
CREATE POLICY "avatars_user_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==============================================================================
-- 12. REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
ALTER TABLE public.water_configurations REPLICA IDENTITY FULL;
ALTER TABLE public.look_outside_configurations REPLICA IDENTITY FULL;
ALTER TABLE public.reminder_events REPLICA IDENTITY FULL;
ALTER TABLE public.device_registrations REPLICA IDENTITY FULL;
ALTER TABLE public.reminder_pause_state REPLICA IDENTITY FULL;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.profiles,
            public.user_settings,
            public.water_configurations,
            public.look_outside_configurations,
            public.reminder_events,
            public.device_registrations,
            public.reminder_pause_state;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
