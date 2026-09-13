-- ==============================================================================
-- EyeFlow V2 — Realtime Multi-Device Sync & Uniqueness Constraints
-- Migration: 00004_realtime_and_uniqueness_fix.sql
-- Purpose: Enforce one configuration row per user and enable Realtime replication
-- ==============================================================================

-- 1. Deduplicate water_configurations if any duplicate rows exist, preserving latest
DELETE FROM public.water_configurations a
USING public.water_configurations b
WHERE a.user_id = b.user_id AND a.updated_at < b.updated_at;

-- 2. Add UNIQUE constraint to water_configurations.user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'water_configurations_user_id_key'
    ) THEN
        ALTER TABLE public.water_configurations
        ADD CONSTRAINT water_configurations_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 3. Deduplicate look_outside_configurations if any duplicate rows exist, preserving latest
DELETE FROM public.look_outside_configurations a
USING public.look_outside_configurations b
WHERE a.user_id = b.user_id AND a.updated_at < b.updated_at;

-- 4. Add UNIQUE constraint to look_outside_configurations.user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'look_outside_configurations_user_id_key'
    ) THEN
        ALTER TABLE public.look_outside_configurations
        ADD CONSTRAINT look_outside_configurations_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 5. Enable REPLICA IDENTITY FULL for complete Realtime updates across all synchronized tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
ALTER TABLE public.water_configurations REPLICA IDENTITY FULL;
ALTER TABLE public.look_outside_configurations REPLICA IDENTITY FULL;
ALTER TABLE public.reminder_events REPLICA IDENTITY FULL;
ALTER TABLE public.device_registrations REPLICA IDENTITY FULL;

-- 6. Add all synchronized tables to Supabase Realtime publication
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.profiles,
            public.user_settings,
            public.water_configurations,
            public.look_outside_configurations,
            public.reminder_events,
            public.device_registrations;
    EXCEPTION
        WHEN duplicate_object THEN
            NULL; -- Table already in publication
        WHEN undefined_object THEN
            NULL; -- Publication does not exist in local mock env
    END;
END $$;
