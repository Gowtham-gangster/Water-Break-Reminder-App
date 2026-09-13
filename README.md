# PauseFlow

> **"Drink water. Look away. Feel better."**

**PauseFlow** is a unified digital wellness application designed to prevent eye strain and promote consistent daily hydration. Built with a unified account model across **Web**, **Android**, and **Windows Desktop**, PauseFlow provides autonomous background scheduling, native notifications, focused countdown break modals, and multi-device cloud synchronization.

---

## 🌟 Overview

Modern digital screen work causes chronic eye fatigue and dehydration. PauseFlow addresses this by enforcing consistent, non-intrusive wellness habits:
- **Hydration Breaks**: Timely reminders to drink water at configurable intervals throughout your active working hours.
- **Look Outside (20-20-20 Rule)**: Regular micro-breaks prompting you to rest your eyes by looking at distant objects.
- **Autonomous & Cross-Device**: Schedules run in the background on your device, synchronizing your status and pause states in real-time across phone and PC.

---

## ✨ Key Features

### 1. Authentication & Unified Profile
- Secure email & password authentication powered by Supabase.
- Persistent user sessions and user-scoped configuration.
- Profile customization with display name, avatar, and timezone selection.

### 2. Wellness Reminders
- **Hydration (Water)**:
  - Configurable reminder intervals (e.g., every 30, 45, or 60 minutes).
  - Start and end hours (e.g., 09:00 to 18:00).
  - Active days selector (Monday through Sunday).
  - Configurable break duration (default: 120 seconds).
- **Look Outside (Screen Breaks)**:
  - 20-20-20 rule wellness intervals (e.g., every 20 or 30 minutes).
  - Fullscreen or compact non-blocking countdown overlays.
  - Auto-dismiss at `00:00` with chime audio.

### 3. Global Pause & Snooze
- Pause reminders for **30 minutes**, **1 hour**, **2 hours**, or the **rest of the day**.
- Pause state is authoritatively persisted in Supabase (`reminder_pause_state`) and instantly synchronized across all your devices via Realtime Broadcast.

### 4. Dynamic Progress & Streak Tracking
- **Zero-Tap Progress Updates**: Progress increments the moment a notification is delivered.
- **Dynamic Expected Counts**: Computed dynamically from your schedule settings and account creation timestamp (no fabricated history).
- **Finalized Missed Reminders**: Missed slots are finalized only after the scheduled day ends.
- **Detailed History**: Chronological log of completed reminders with search and filtering.

---

## 📱 Supported Platforms

| Platform | Runtime / Framework | Primary Deliverable | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Android** | Capacitor 8 + Android Native Java | `releases/android/PauseFlow.apk` | Native `AlarmManager` exact alarms, background BroadcastReceiver, foreground/background notification delivery, custom sound channels. |
| **Windows Desktop** | Electron 43 + Node.js | `dist-electron/win-unpacked/PauseFlow.exe` | System Tray icon with quick controls, Windows Toast notifications, focused non-blocking modal overlays. |
| **Web** | Modern Browsers (SPA / PWA) | `dist/` | Instant browser access, IndexedDB offline cache, Supabase Realtime synchronization. |

> *Note: There is no iOS target in this repository.*

---

## 🏗️ System Architecture

```
                              Supabase Cloud Backend
              (Auth • PostgreSQL RLS • Realtime Broadcast • Storage)
                                        │
                       ┌────────────────┼────────────────┐
                       ▼                ▼                ▼
                  Web Browser     Android Mobile   Windows Desktop
                 (React / SPA)     (Capacitor)     (Electron App)
                       │                │                │
                       └────────────────┼────────────────┘
                                        ▼
                               Core Shared Engine
                      (src/engine/reminderEngine.ts)
                                        │
                        ┌───────────────┴───────────────┐
                        ▼                               ▼
                 Water Reminders               Look Outside Breaks
```

---

## 🔔 Reminder & Notification Pipeline

### The Critical Completion Semantic
> **NOTIFICATION DELIVERY = REMINDER COMPLETION**

In PauseFlow, a reminder is officially **completed** when the notification is delivered and posted to the system. 
- **Zero-Tap Completion**: The user does **not** need to open or tap the notification to count the reminder as completed.
- **Optional Tap**: Tapping a notification opens the reminder modal / countdown experience in the application. Tapping **never** creates a duplicate completion.
- **Suppressed / Paused Reminders**: A reminder slot suppressed because PauseFlow is in a paused state is **not** counted as completed.

---

## 🤖 Android Native Architecture

Android requires background resilience even when the app is backgrounded or removed from the recent apps list.

```
PauseFlow Scheduler (Dynamic Occurrence Matrix)
                   │
                   ▼
Android Native Plugin (PauseFlowNativePlugin.java)
                   │
                   ▼ (Exact Alarms)
Android AlarmManager (SCHEDULE_EXACT_ALARM)
                   │
                   ▼ (Alarm Triggers)
PauseFlowNotificationReceiver (Native BroadcastReceiver)
                   │
                   ├─► 1. Synchronous Disk Commit (SharedPreferences: pauseflow_delivered_reminders)
                   ├─► 2. Native Notification Post (NotificationCompat.Builder)
                   │        ├─ setSmallIcon(R.drawable.pauseflow_notification)
                   │        └─ setLargeIcon(R.drawable.pauseflow_large_icon)
                   │
                   └─► 3. Live Bridge Emit (if app process is alive)
                            │
                            ▼
                   AppContext / reminderService
                            │
                            ├─► Update React Progress State (Instant UI Increment)
                            └─► Async Supabase Cloud Sync (reminder_events)
```

### Android Lifecycle Guarantees
- **App Foreground**: Notification arrives $\rightarrow$ live bridge event dispatched $\rightarrow$ UI progress increments immediately $\rightarrow$ completion synced to Supabase.
- **App Background**: Notification arrives $\rightarrow$ native delivery recorded $\rightarrow$ notification sound & banner shown $\rightarrow$ synced in background.
- **App Killed / Terminated**: AlarmManager fires $\rightarrow$ `PauseFlowNotificationReceiver` executes in background $\rightarrow$ delivery record is saved atomically to `SharedPreferences`. When the app is opened, startup reconciliation flushes pending completions and updates progress.
- **Force Stop Note**: As per Android OS security specifications, if a user manually performs a "Force Stop" from Android Settings, Android suppresses all pending alarms until the user manually relaunches the app.

### Android Notification Branding & Icons
- **Master Source Asset**: `icon.png` (1118x1118 px) in the project root.
- **Notification Small Icon (`setSmallIcon`)**: Android-compliant notification resource representing PauseFlow's branding.
- **Notification Large Icon (`setLargeIcon`)**: Full-color PauseFlow brand icon badge (`pauseflow_large_icon.png`).

---

## 🗓️ Scheduling & Event Identity

### Dynamic Occurrence Generation
Reminder schedules are computed dynamically at runtime using:
- Current date and local time.
- User's selected timezone.
- Configured active window (`startTime` to `endTime`).
- Interval duration (`intervalMinutes`).
- Active days of the week (`activeDays`).

### Deterministic Occurrence ID Format
Every reminder occurrence has a canonical deterministic ID:
```
water:YYYY-MM-DD:HH:mm
look_outside:YYYY-MM-DD:HH:mm
```
*Example:* `water:2026-09-13:14:30`

- **Idempotency**: All completion tracking, local storage, and database inserts use the deterministic occurrence ID to ensure that processing the same occurrence multiple times never causes duplicate counts or duplicate records.
- **Timezone Stability**: Occurrence IDs are generated using the scheduled slot time, never the physical delivery timestamp.

---

## 🔄 Cross-Device Cloud Synchronization

PauseFlow keeps multiple active devices synchronized through Supabase:
1. **User Scoping**: All queries are automatically scoped to the authenticated `auth.uid()`.
2. **Realtime Broadcast Channels**: Device state changes (such as pause/resume, config updates, and completions) broadcast over `user_sync_<userId>` channels.
3. **Device Registration**: Active clients register in `device_registrations` with platform and last-seen timestamps.
4. **Pause State Sync**: Pausing reminders on Windows immediately pauses scheduling on Android and Web.

---

## ⚡ Offline Resilience

PauseFlow operates offline-first:
- Native alarms and notifications trigger locally on the device without requiring network connectivity.
- Completed occurrences are committed immediately to local storage (`IndexedDB` on Web/Desktop, `SharedPreferences` on Android).
- Pending completions are queued in an offline queue and automatically synchronized with Supabase once network connection is restored.

---

## 📊 Statistics & Streak Engine

- **Account Creation Boundary**: Expected reminder calculations begin from the user's account creation date (`profiles.created_at`), preventing false historical "missed" days.
- **Active Day Calculation**: During an ongoing day, missed reminders are not finalized prematurely; remaining future slots are treated as upcoming.
- **Daily Summary**: Tracks daily completion rate, total completed, total expected, and daily streak counts.

---

## 🗄️ Database Schema (Supabase)

All database tables, constraints, RLS policies, and triggers are defined in [`supabase/migrations/00001_initial_schema.sql`](file:///d:/Gowtham%20Project's/Reminder%20App/supabase/migrations/00001_initial_schema.sql):

| Table | Description |
| :--- | :--- |
| `public.profiles` | User profile details, display name, avatar URL, and timezone. |
| `public.user_settings` | Theme, time format (12h/24h), sound preferences, and default break durations. |
| `public.water_configurations` | Water interval, start/end time, active days, and duration. |
| `public.look_outside_configurations` | Screen break interval, start/end time, active days, and duration. |
| `public.reminder_events` | Authoritative log of scheduled, completed, and expired reminder events. |
| `public.device_registrations` | Registered user devices, platform types, and heartbeat timestamps. |
| `public.reminder_pause_state` | Authoritative global pause state (`paused_until`, `paused_by_device_id`). |

---

## 💻 Technology Stack

### Frontend & Core
- **React 19** (`react`, `react-dom`) — Component-driven reactive user interface.
- **TypeScript 6** — Strict type safety across application and platform services.
- **Vite 8** — Fast modern frontend build tool and dev server.
- **Tailwind CSS v4** — Utility-first styling with modern dark theme palette.
- **Lucide React** — Consistent iconography.
- **Recharts** — Responsive data visualization for statistics.
- **IndexedDB (`idb`)** — High-performance client-side offline storage.

### Desktop (Windows)
- **Electron 43** — Cross-platform desktop runtime.
- **Electron Builder 26** — Windows NSIS installer and unpacked executable packager.

### Mobile (Android)
- **Capacitor 8** (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/local-notifications`) — Native bridge.
- **Android Native (Java)** — Exact alarm management, custom BroadcastReceivers, and notification channels.

### Backend & Cloud
- **Supabase** (`@supabase/supabase-js`) — PostgreSQL database, Authentication, Row Level Security (RLS), and Realtime Broadcast.

---

## 📂 Project Directory Structure

```
├── .env.example              # Environment variables template
├── capacitor.config.ts       # Capacitor native bridge configuration
├── index.cjs                 # Electron main entry point
├── package.json              # Project dependencies and build scripts
├── vite.config.ts            # Vite build configuration
├── android/                  # Android native project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/pauseflow/app/
│   │   │   ├── MainActivity.java
│   │   │   ├── PauseFlowNativePlugin.java
│   │   │   ├── PauseFlowNotificationReceiver.java
│   │   │   └── PauseFlowBootReceiver.java
│   │   └── res/              # Android drawables, mipmaps, and notification icons
├── desktop/                  # Electron desktop support files and tray manager
├── public/                   # Public static web assets and favicons
├── releases/                 # Release packages
│   ├── android/
│   │   └── PauseFlow.apk     # Production Android Release APK
│   └── desktop/
│       ├── install.bat       # Windows desktop installation script
│       └── uninstall.bat     # Windows desktop uninstallation script
├── src/                      # Application source code
│   ├── assets/               # Brand logos and images
│   ├── components/           # UI components, modals, break screens, layouts
│   ├── config/               # App configuration and Supabase clients
│   ├── context/              # AppContext and global state management
│   ├── engine/               # Scheduler, dynamic matrix, and notification engine
│   ├── platform/             # Android, Electron, and Web platform bridges
│   ├── services/             # Supabase sync, reminder history, auth, and profile
│   └── types/                # TypeScript type definitions
└── supabase/
    └── migrations/           # PostgreSQL schema, RLS policies, and triggers
```

---

## ⚙️ Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Java Development Kit (JDK)**: JDK 17 or higher *(for Android builds)*
- **Android SDK / Android Studio**: Command-line tools or Studio with API Level 34+ *(for Android builds)*

---

## 🚀 Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Gowtham-gangster/Water-Break-Reminder-App.git
cd Water-Break-Reminder-App
```

### 2. Configure Environment Variables
Create a local `.env` file from the provided template:
```bash
cp .env.example .env
```
Open `.env` and configure your Supabase URL and Publishable/Anon Key:
```env
VITE_APP_ENV=development
VITE_APP_VERSION=1.0.0
VITE_STORAGE_PREFIX=pauseflow:v2:

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

### 3. Install Dependencies
```bash
npm install
```

---

## 🏃 Running the Application

### Run Web Development Server
```bash
npm run dev
```
Access the application at `http://localhost:5173`.

### Run Windows Desktop in Development Mode
```bash
npm run desktop:dev
```

### Open Android Project in Android Studio
```bash
npm run android:open
```

---

## 📦 Build & Packaging

| Target | Command | Output Directory |
| :--- | :--- | :--- |
| **Production Web Bundle** | `npm run build` | `dist/` |
| **Windows Desktop Executable** | `npm run package:win` | `dist-electron/win-unpacked/` |
| **Windows NSIS Installer** | `npm run dist:win` | `dist-electron/` |
| **Capacitor Android Sync** | `npm run android:sync` | `android/app/src/main/assets/public/` |
| **Android Release APK** | `npm run android:build` | `releases/android/PauseFlow.apk` |
| **Code Linting** | `npm run lint` | CLI output |

---

## 🚚 Release Artifacts

- **Android Release APK**: [`releases/android/PauseFlow.apk`](file:///d:/Gowtham%20Project's/Reminder%20App/releases/android/PauseFlow.apk)
- **Windows Desktop Application**: `dist-electron/win-unpacked/PauseFlow.exe`

---

## 🧪 Testing & Validation Expectations

When validating reminder delivery and progress calculation, verify against the following test matrix:

| Scenario | Expected Behavior | Verification Status |
| :--- | :--- | :--- |
| **App Foreground** | Notification arrives on time $\rightarrow$ progress increments immediately without tapping. | Code & Pipeline Verified |
| **App Background** | Notification arrives on time $\rightarrow$ native completion recorded $\rightarrow$ progress accurate upon resume. | Code & Pipeline Verified |
| **App Closed / Killed** | AlarmManager fires BroadcastReceiver $\rightarrow$ disk write committed $\rightarrow$ startup reconciliation syncs progress. | Code & Pipeline Verified |
| **Notification Tap** | Tapping notification opens reminder modal $\rightarrow$ does NOT create a duplicate completion record. | Code & Pipeline Verified |
| **Offline Delivery** | Reminders trigger locally $\rightarrow$ completion cached $\rightarrow$ flushes to Supabase upon reconnection. | Code & Pipeline Verified |
| **Paused State** | Reminders during paused window are suppressed and not counted as completed. | Code & Pipeline Verified |

---

## 🔒 Security & Privacy

- **Row Level Security (RLS)**: Enforced on 100% of tables in PostgreSQL. Users can strictly only read and write their own data (`auth.uid() = user_id`).
- **Client Key Safety**: Client applications only use the Supabase public anon key. The Supabase service-role secret key is **never** embedded in client bundles.
- **Data Minimization**: PauseFlow only collects data required for scheduling reminders and computing wellness streaks.

---

## 📄 License

This project is licensed under the MIT License.
