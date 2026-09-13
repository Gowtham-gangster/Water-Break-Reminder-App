# PauseFlow — Digital Wellness Multi-Platform Application

> **"Drink water. Look away. Feel better."**

**PauseFlow** is a modern, cross-platform digital wellness application (**Web**, **Android**, and **Windows Desktop**) built with **React**, **TypeScript**, **Vite**, **Electron**, **Capacitor**, and **Supabase**. It protects eyesight and promotes consistent hydration with an autonomous **24/7 background scheduler**, **native toast & mobile notifications**, **cross-device cloud synchronization**, and **focused reminder countdown overlays**.

---

## 📱 Cross-Platform Support

| Platform | Runtime | Distribution Artifact | Key Features |
| :--- | :--- | :--- | :--- |
| **Android** | Capacitor 8 / Android Native | `releases/android/PauseFlow.apk` | Native AlarmManager background alarms, custom notification sound, lock screen actions. |
| **Windows Desktop** | Electron 43 | `dist-electron/win-unpacked/PauseFlow.exe` | System Tray integration, Windows Toast notifications, focused non-blocking modal overlay. |
| **Web** | Modern Browsers | `dist/` | Offline PWA support, reactive Realtime synchronization. |

---

## ✨ Core Features

1. **Hydration (Water) Reminders**:
   - Customizable intervals, daily active hours, active days of the week, and sound effects.
   - Idempotent logging and dynamic progress tracking.

2. **Look Outside (Screen Break) Reminders**:
   - 20-20-20 rule wellness breaks with fullscreen or popup countdowns.
   - Auto-dismiss at `00:00` with input release.

3. **Global Pause / Resume State**:
   - Pause reminders for 30m, 1h, 2h, or the rest of the day.
   - Authoritative cloud persistence (`public.reminder_pause_state`) synchronized across all your devices in real-time.

4. **Multi-Device Realtime Cloud Sync**:
   - Powered by Supabase PostgreSQL and Realtime Broadcast channels (`user_sync_<userId>`).
   - Changes on Web instantly propagate to Android and Windows Desktop without reloading.

5. **Dynamic Statistics & Streak Engine**:
   - Account-lifetime temporal boundaries (no fake historical days).
   - Daily rate, weekly rate, current/best streaks, 7-day trend chart, and finalized daily history.

6. **Offline-First Resilience**:
   - Full local cache and offline event queues. Reminders completed while offline automatically flush to Supabase upon reconnection.

---

## 🏗️ Architecture Overview

```
                      Supabase Cloud Backend
              (Auth • PostgreSQL RLS • Realtime • Storage)
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
          Web Browser    Android Mobile   Windows Desktop
         (React / PWA)    (Capacitor)     (Electron App)
               │                │                │
               └────────────────┼────────────────┘
                                ▼
                       authoritative engine
                   (src/engine/reminderEngine.ts)
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
            Water Reminder              Look Outside
             (Hydration)               (Screen Break)
```

---

## 🚀 Quick Start & Development

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Android Studio / SDK** *(optional, for Android APK builds)*

### 2. Setup Environment
Copy the template configuration and supply your Supabase credentials:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
# Web development server
npm run dev

# Windows desktop development mode
npm run desktop:dev
```

---

## 🛠️ Production Build Commands

```bash
# 1. Compile production web bundle
npm run build

# 2. Package Windows Desktop application (.exe)
npm run package:win

# 3. Compile Android Release APK
npm run android:build

# 4. Run code linter
npm run lint
```

---

## 🗄️ Database Setup

All database tables, Row Level Security (RLS) policies, triggers, indexes, and storage buckets are consolidated into:
[`supabase/migrations/00001_initial_schema.sql`](file:///d:/Gowtham%20Project's/Reminder%20App/supabase/migrations/00001_initial_schema.sql)

To apply to your Supabase project:
1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Paste the contents of `00001_initial_schema.sql` and run it.

---

## 🔒 Security & Privacy
- **Row Level Security (RLS)** enabled on 100% of tables (`auth.uid() = user_id`).
- Zero telemetry tracking, zero analytics scripts.
- Secure token storage with scoped device caching.

---

## 📄 License
MIT License. Developed with care by the PauseFlow Team.
