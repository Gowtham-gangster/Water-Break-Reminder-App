-- ==============================================================================
-- EYEFLOW V2 — HIGH-SPEED DATABASE & CROSS-DEVICE INDEX OPTIMIZATIONS
-- ==============================================================================

-- 1. Targeted user status index for fast progress calculation
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_status 
ON public.reminder_events(user_id, status);

-- 2. Composite index for scheduled range queries and status filtering
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_sched_status 
ON public.reminder_events(user_id, scheduled_at, status);

-- 3. Delta-sync index for high-speed incremental sync on application resume
CREATE INDEX IF NOT EXISTS idx_reminder_events_user_updated_at 
ON public.reminder_events(user_id, updated_at DESC);

-- 4. Configurations fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_water_configs_user_updated 
ON public.water_configurations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_look_outside_configs_user_updated 
ON public.look_outside_configurations(user_id, updated_at DESC);
