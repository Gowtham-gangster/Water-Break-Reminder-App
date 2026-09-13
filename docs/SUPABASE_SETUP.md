# EyeFlow V2 — Supabase Foundation & Setup Guide

This document explains the setup, architecture, and security policies for the Supabase backend in EyeFlow V2.

---

## 1. Environment Configuration

EyeFlow V2 uses environment variables for Supabase connectivity. Create a `.env` (or `.env.local`) file based on `.env.example`:

```bash
# Application Environment
VITE_APP_ENV=development
VITE_APP_VERSION=2.0.0-rc1
VITE_STORAGE_PREFIX=eyeflow:v2:

# Supabase API Credentials (from Supabase Dashboard -> Settings -> API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

> [!CAUTION]
> **Security Rule:** Never commit secret keys (e.g. `service_role` key, database passwords, private certificates) to Git, Android source, or Electron renderers. Only the public/anonymous client key is permitted on the client side.

---

## 2. Database Schema & SQL Migrations

Migrations are version-controlled in [`supabase/migrations/`](file:///d:/Gowtham%20Project's/Reminder%20App/supabase/migrations):

- `00001_initial_schema.sql`: Initializes all core V2 tables, triggers, indexes, and Row Level Security (RLS) policies.

### Core Tables:

1. **`profiles`**
   - Linked directly to `auth.users(id)` via foreign key.
   - Stores `display_name`, `avatar_url`, and `timezone`.
2. **`user_settings`**
   - User preferences: `theme`, `time_format`, `sound_enabled`, `notifications_enabled`, default durations.
3. **`water_configurations`**
   - Personal hydration schedule: `interval_minutes`, `start_time`, `end_time`, `duration_seconds`, `active_days`.
4. **`look_outside_configurations`**
   - Personal screen break schedule: `interval_minutes`, `start_time`, `end_time`, `duration_seconds`, `active_days`.
5. **`reminder_events`**
   - Complete log of reminder occurrences: `type` (`water` | `look_outside`), `scheduled_at`, `started_at`, `completed_at`, `status`.
6. **`device_registrations`**
   - Cross-device sync registry (`windows`, `android`, `web`).

---

## 3. Row Level Security (RLS) Policies

All tables have Row Level Security enabled. Policies enforce that users can only read, write, update, or delete records where `user_id = auth.uid()` (or `id = auth.uid()` for `profiles`).

```sql
-- Example policy for water_configurations
ALTER TABLE public.water_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_configs_select_own" 
ON public.water_configurations 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "water_configs_insert_own" 
ON public.water_configurations 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "water_configs_update_own" 
ON public.water_configurations 
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "water_configs_delete_own" 
ON public.water_configurations 
FOR DELETE USING (auth.uid() = user_id);
```

---

## 4. Applying Migrations

### Via Supabase CLI:
```bash
# Link project
npx supabase link --project-ref <your-project-id>

# Push migrations
npx supabase db push
```

### Via Supabase Dashboard:
1. Open the SQL Editor in your Supabase Dashboard.
2. Paste the contents of `supabase/migrations/00001_initial_schema.sql`.
3. Click **Run**.

---

## 5. Offline-First Architecture & Namespacing

EyeFlow V2 operates with a resilient offline-first strategy:
- **Cloud Source of Truth**: Supabase PostgreSQL + Auth.
- **Local User-Scoped Cache**: Namespaced under `eyeflow:v2:<userId>:settings`, `eyeflow:v2:<userId>:water`, `eyeflow:v2:<userId>:lookOutside`.
- **Offline Queue**: Reminders completed while offline are stored in `eyeflow:v2:<userId>:pending_sync_queue` and flushed automatically when internet connectivity returns.
- **Logout Isolation**: When a user logs out, all transient state, countdown timers, and active reminders for that user are immediately purged to prevent cross-user contamination.
