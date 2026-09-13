# EyeFlow V2 — Supabase PostgreSQL Database Specification & Documentation

## 1. Overview & Purpose
EyeFlow V2 uses **Supabase PostgreSQL** as its primary cloud data store for multi-user authentication, cloud configuration synchronization, reminder history logging, and multi-device coordination.

### Core Architecture Rules:
- **V1 Isolation:** EyeFlow V1 is completely isolated on `v1-stable` and uses purely local storage.
- **Identity Provider:** Supabase Auth (`auth.users`) provides identity and JWT credentials.
- **Data Isolation:** Enforced strictly at the database layer via PostgreSQL **Row Level Security (RLS)** using `auth.uid()`.
- **Offline Resiliency:** User-scoped local storage keys (`eyeflow:v2:<userId>:*`) cache data locally, enabling seamless offline reminders and background synchronization.

---

## 2. Supabase Tables & Schema

### 2.1 `profiles`
Stores user profile information.
- **Primary Key:** `id UUID` references `auth.users(id) ON DELETE CASCADE`.
- **Columns:**
  - `id` (`UUID PRIMARY KEY`): Maps directly to `auth.users.id`.
  - `display_name` (`TEXT`): User's custom or OAuth display name.
  - `avatar_url` (`TEXT`): URL to user avatar in Supabase Storage.
  - `timezone` (`TEXT NOT NULL DEFAULT 'UTC'`): User's local timezone.
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`): Record creation timestamp.
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`): Last modified timestamp (updated via trigger).

### 2.2 `user_settings`
Stores user application preferences.
- **Primary Key:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Columns:**
  - `id` (`UUID`): Record identifier.
  - `user_id` (`UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`): Owner ID.
  - `theme` (`TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark'))`): UI theme.
  - `time_format` (`TEXT NOT NULL DEFAULT '12h' CHECK (time_format IN ('12h', '24h'))`): Time display format.
  - `sound_enabled` (`BOOLEAN NOT NULL DEFAULT true`): Audio alert toggle.
  - `notifications_enabled` (`BOOLEAN NOT NULL DEFAULT true`): System notification toggle.
  - `default_water_duration` (`INTEGER NOT NULL DEFAULT 120 CHECK (default_water_duration > 0)`): Duration in seconds.
  - `default_look_outside_duration` (`INTEGER NOT NULL DEFAULT 300 CHECK (default_look_outside_duration > 0)`): Duration in seconds.
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).

### 2.3 `water_configurations`
Stores interval schedules for hydration breaks.
- **Primary Key:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Columns:**
  - `id` (`UUID`): Configuration identifier.
  - `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`): Owner ID.
  - `enabled` (`BOOLEAN NOT NULL DEFAULT true`): Schedule active toggle.
  - `interval_minutes` (`INTEGER NOT NULL DEFAULT 45 CHECK (interval_minutes > 0)`): Reminder frequency.
  - `start_time` (`TIME NOT NULL DEFAULT '09:00:00'`): Daily active window start.
  - `end_time` (`TIME NOT NULL DEFAULT '18:00:00'`): Daily active window end.
  - `duration_seconds` (`INTEGER NOT NULL DEFAULT 120 CHECK (duration_seconds > 0)`): Break duration.
  - `active_days` (`INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}'`): Days of week (1=Mon, 7=Sun).
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).

### 2.4 `look_outside_configurations`
Stores interval schedules for 20-20-20 eye strain breaks.
- **Primary Key:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Columns:**
  - `id` (`UUID`): Configuration identifier.
  - `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`): Owner ID.
  - `enabled` (`BOOLEAN NOT NULL DEFAULT true`): Schedule active toggle.
  - `interval_minutes` (`INTEGER NOT NULL DEFAULT 20 CHECK (interval_minutes > 0)`): Reminder frequency.
  - `start_time` (`TIME NOT NULL DEFAULT '09:00:00'`): Daily active window start.
  - `end_time` (`TIME NOT NULL DEFAULT '18:00:00'`): Daily active window end.
  - `duration_seconds` (`INTEGER NOT NULL DEFAULT 300 CHECK (duration_seconds > 0)`): Break duration.
  - `active_days` (`INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}'`): Days of week.
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).

### 2.5 `reminder_events`
Stores historical and telemetry records for break adherence.
- **Primary Key:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Columns:**
  - `id` (`UUID`): Event ID.
  - `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`): Owner ID.
  - `type` (`TEXT NOT NULL CHECK (type IN ('water', 'look_outside'))`): Break category.
  - `scheduled_at` (`TIMESTAMPTZ NOT NULL`): Expected trigger time.
  - `started_at` (`TIMESTAMPTZ`): User acknowledgment time.
  - `completed_at` (`TIMESTAMPTZ`): User completion time.
  - `status` (`TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'triggered', 'completed', 'expired', 'cancelled'))`).
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).

### 2.6 `device_registrations`
Tracks user devices for multi-device sync.
- **Primary Key:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Columns:**
  - `id` (`UUID`): Device record ID.
  - `user_id` (`UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`): Owner ID.
  - `device_id` (`TEXT NOT NULL`): Hardware/installation UUID.
  - `platform` (`TEXT NOT NULL CHECK (platform IN ('windows', 'android', 'web', 'macos', 'linux', 'ios'))`).
  - `device_name` (`TEXT`): User-friendly machine hostname or model name.
  - `last_sync_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`): Heartbeat sync timestamp.
  - `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).
  - `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`).
  - **Constraint:** `UNIQUE (user_id, device_id)` prevents duplicate registrations.

---

## 3. Database Indexes

| Table | Index Name | Columns | Purpose |
|---|---|---|---|
| `user_settings` | `idx_user_settings_user_id` | `user_id` | Fast user lookup |
| `water_configurations` | `idx_water_configs_user_id` | `user_id` | Fast config retrieval |
| `look_outside_configurations` | `idx_look_outside_configs_user_id` | `user_id` | Fast config retrieval |
| `reminder_events` | `idx_reminder_events_user_id` | `user_id` | User history filtering |
| `reminder_events` | `idx_reminder_events_scheduled_at` | `scheduled_at` | Time range scans |
| `reminder_events` | `idx_reminder_events_status` | `status` | State queries |
| `reminder_events` | `idx_reminder_events_user_sched` | `user_id, scheduled_at DESC` | Timeline pagination |
| `reminder_events` | `idx_reminder_events_user_type` | `user_id, type` | Category analytics |
| `device_registrations` | `idx_device_reg_user_id` | `user_id` | Device list queries |
| `device_registrations` | `idx_device_reg_user_device` | `user_id, device_id` | Device reconciliation |

---

## 4. Automatic Triggers

### 4.1 Automatic `updated_at` Trigger (`handle_updated_at`)
Automatically updates the `updated_at` column to `NOW()` on all tables on `BEFORE UPDATE`.

### 4.2 New User Auto-Provisioning Trigger (`handle_new_user`)
Attached to `auth.users` on `AFTER INSERT`:
- Automatically provisions `profiles` with display name and timezone.
- Automatically creates default `user_settings`.
- Automatically creates default `water_configurations` (45 min interval, 09:00–18:00).
- Automatically creates default `look_outside_configurations` (20 min interval, 09:00–18:00).

---

## 5. Row Level Security (RLS) Policies

All 6 tables have `ROW LEVEL SECURITY` enabled. Access is strictly bound to `auth.uid()`.

| Table | Policy Name | Command | Expression |
|---|---|---|---|
| `profiles` | `profiles_select_own` | SELECT | `auth.uid() = id` |
| `profiles` | `profiles_insert_own` | INSERT | `auth.uid() = id` |
| `profiles` | `profiles_update_own` | UPDATE | `auth.uid() = id` (USING & WITH CHECK) |
| `profiles` | `profiles_delete_own` | DELETE | `auth.uid() = id` |
| `user_settings` | `user_settings_select_own` | SELECT | `auth.uid() = user_id` |
| `user_settings` | `user_settings_insert_own` | INSERT | `auth.uid() = user_id` |
| `user_settings` | `user_settings_update_own` | UPDATE | `auth.uid() = user_id` (USING & WITH CHECK) |
| `user_settings` | `user_settings_delete_own` | DELETE | `auth.uid() = user_id` |
| `water_configurations` | `water_configs_select_own` | SELECT | `auth.uid() = user_id` |
| `water_configurations` | `water_configs_insert_own` | INSERT | `auth.uid() = user_id` |
| `water_configurations` | `water_configs_update_own` | UPDATE | `auth.uid() = user_id` (USING & WITH CHECK) |
| `water_configurations` | `water_configs_delete_own` | DELETE | `auth.uid() = user_id` |
| `look_outside_configurations` | `look_outside_configs_select_own` | SELECT | `auth.uid() = user_id` |
| `look_outside_configurations` | `look_outside_configs_insert_own` | INSERT | `auth.uid() = user_id` |
| `look_outside_configurations` | `look_outside_configs_update_own` | UPDATE | `auth.uid() = user_id` (USING & WITH CHECK) |
| `look_outside_configurations` | `look_outside_configs_delete_own` | DELETE | `auth.uid() = user_id` |
| `reminder_events` | `reminder_events_select_own` | SELECT | `auth.uid() = user_id` |
| `reminder_events` | `reminder_events_insert_own` | INSERT | `auth.uid() = user_id` |
| `reminder_events` | `reminder_events_update_own` | UPDATE | `auth.uid() = user_id` (USING & WITH CHECK) |
| `reminder_events` | `reminder_events_delete_own` | DELETE | `auth.uid() = user_id` |
| `device_registrations` | `device_registrations_select_own` | SELECT | `auth.uid() = user_id` |
| `device_registrations` | `device_registrations_insert_own` | INSERT | `auth.uid() = user_id` |
| `device_registrations` | `device_registrations_update_own` | UPDATE | `auth.uid() = user_id` (USING & WITH CHECK) |
| `device_registrations` | `device_registrations_delete_own` | DELETE | `auth.uid() = user_id` |

---

## 6. Storage Bucket Configuration (Avatars)

When avatar uploads are enabled:
1. Bucket: `avatars` (Public: `false`).
2. Objects path: `<user_id>/avatar.<ext>`.
3. Storage RLS:
   - `SELECT`: `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text`
   - `INSERT / UPDATE / DELETE`: `bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text`

---

## 7. Migration Application Procedure

### Option A: Supabase CLI (Recommended)
```bash
# Link your Supabase project (enter DB password when prompted)
npx supabase link --project-ref <YOUR_PROJECT_REF>

# Apply the migration
npx supabase db push
```

### Option B: Supabase Dashboard SQL Editor
1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Select your EyeFlow V2 project.
3. Open **SQL Editor** -> **New Query**.
4. Paste the entire content of `supabase/migrations/00001_initial_schema.sql`.
5. Click **Run**.
