-- ==============================================================================
-- EyeFlow V2 — Supabase PostgreSQL Schema & Security Migration
-- Migration: 00001_initial_schema.sql
-- Purpose: Complete schema, constraints, triggers, indexes, and RLS policies
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
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    interval_minutes INTEGER NOT NULL DEFAULT 20 CHECK (interval_minutes > 0),
    start_time TIME NOT NULL DEFAULT '09:00:00',
    end_time TIME NOT NULL DEFAULT '18:00:00',
    duration_seconds INTEGER NOT NULL DEFAULT 300 CHECK (duration_seconds > 0),
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
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'triggered', 'completed', 'expired', 'cancelled')),
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
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id)
);

-- ==============================================================================
-- 7. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_water_configs_user_id ON public.water_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_look_outside_configs_user_id ON public.look_outside_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_id ON public.reminder_events(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_events_scheduled_at ON public.reminder_events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_reminder_events_status ON public.reminder_events(status);
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_sched ON public.reminder_events(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_type ON public.reminder_events(user_id, type);
CREATE INDEX IF NOT EXISTS idx_device_reg_user_id ON public.device_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_device_reg_user_device ON public.device_registrations(user_id, device_id);

-- ==============================================================================
-- 8. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach updated_at triggers
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

-- ==============================================================================
-- 9. AUTOMATIC USER INITIALIZATION TRIGGER
-- Automatically provision Profile, Settings, Water Config, Look Outside Config
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Create Profile
    INSERT INTO public.profiles (id, display_name, timezone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
    );

    -- 2. Create Default User Settings
    INSERT INTO public.user_settings (user_id, theme, time_format, sound_enabled, notifications_enabled, default_water_duration, default_look_outside_duration)
    VALUES (NEW.id, 'system', '12h', true, true, 120, 300);

    -- 3. Create Default Water Configuration
    INSERT INTO public.water_configurations (user_id, enabled, interval_minutes, start_time, end_time, duration_seconds, active_days)
    VALUES (NEW.id, true, 45, '09:00', '18:00', 120, '{1,2,3,4,5}');

    -- 4. Create Default Look Outside Configuration
    INSERT INTO public.look_outside_configurations (user_id, enabled, interval_minutes, start_time, end_time, duration_seconds, active_days)
    VALUES (NEW.id, true, 20, '09:00', '18:00', 300, '{1,2,3,4,5}');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: User A cannot read, insert, update, or delete User B records
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.look_outside_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;

-- 10.1 Profiles Policies (id = auth.uid())
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 10.2 User Settings Policies (user_id = auth.uid())
CREATE POLICY "user_settings_select_own" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert_own" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update_own" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_delete_own" ON public.user_settings FOR DELETE USING (auth.uid() = user_id);

-- 10.3 Water Configurations Policies (user_id = auth.uid())
CREATE POLICY "water_configs_select_own" ON public.water_configurations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "water_configs_insert_own" ON public.water_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "water_configs_update_own" ON public.water_configurations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "water_configs_delete_own" ON public.water_configurations FOR DELETE USING (auth.uid() = user_id);

-- 10.4 Look Outside Configurations Policies (user_id = auth.uid())
CREATE POLICY "look_outside_configs_select_own" ON public.look_outside_configurations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "look_outside_configs_insert_own" ON public.look_outside_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "look_outside_configs_update_own" ON public.look_outside_configurations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "look_outside_configs_delete_own" ON public.look_outside_configurations FOR DELETE USING (auth.uid() = user_id);

-- 10.5 Reminder Events Policies (user_id = auth.uid())
CREATE POLICY "reminder_events_select_own" ON public.reminder_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminder_events_insert_own" ON public.reminder_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminder_events_update_own" ON public.reminder_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminder_events_delete_own" ON public.reminder_events FOR DELETE USING (auth.uid() = user_id);

-- 10.6 Device Registrations Policies (user_id = auth.uid())
CREATE POLICY "device_registrations_select_own" ON public.device_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "device_registrations_insert_own" ON public.device_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "device_registrations_update_own" ON public.device_registrations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "device_registrations_delete_own" ON public.device_registrations FOR DELETE USING (auth.uid() = user_id);
