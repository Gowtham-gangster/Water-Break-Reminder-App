# EyeFlow Multiplatform Architecture (Windows Desktop & Android Mobile)

## 1. Unified Architecture Overview

EyeFlow uses a decoupled multiplatform design where shared pure business logic is maintained across all platforms, while platform-specific services (notifications, background scheduling, hardware lifecycle) are delegated to native services.

```
                         EyeFlow Core
                (Pure TypeScript Business Logic)
                               |
              -----------------------------------
              |                                 |
           Windows                           Android
           Desktop                            Mobile
              |                                 |
       Electron Daemon                  AlarmManager / Alarms
              |                                 |
       React Shared UI                     Capacitor UI
```

---

## 2. Shared Core Logic (`src/engine/` & `src/types/`)

The following modules contain **zero platform-specific code** and run identically across Windows, Android, and Web:

- **`src/engine/reminderEngine.ts`**: Pure deterministic schedule calculation (`findNextOccurrence`, `calculateSchedule`, `scheduleTimer`), date/time calculation, quiet hours evaluation, and slot ID generation (`water:YYYY-MM-DD:HH:mm`).
- **`src/engine/waterScheduler.ts` & `src/engine/screenBreakScheduler.ts`**: Standalone daily occurrence and interval generators.
- **`src/engine/storageEngine.ts`**: Persistent models for configuration, user preferences, and daily completion logs.
- **`src/types/index.ts`**: Data contracts for water configuration, screen break configuration, pause state, and log entries.

---

## 3. Platform Native Services Abstraction (`src/platform/`)

The application consumes platform services through abstract interfaces:

```
src/platform/
├── types.ts                   # Service contracts (INotificationService, IBackgroundSchedulerService, etc.)
├── systemLifecycle.ts         # Runtime platform detection & sleep/wake/power event hooks
├── notificationService.ts     # Platform-specific audio chimes and native notifications
├── backgroundScheduler.ts     # Platform-specific background daemon & OS alarm hooks
├── storageService.ts          # Unified persistence contract
└── index.ts                   # Barrel export
```

---

## 4. Platform-Specific Implementations

### A. Windows Desktop (Electron)
- **Engine**: Electron 43.4.0 with Node.js integration in background main process.
- **Menu Bar**: Native Electron application menu (`File`, `Edit`, `View`, `Window`) is disabled via `Menu.setApplicationMenu(null)` and `autoHideMenuBar: true`.
- **Background Daemon**: `desktop/main.cjs` runs a zero-polling sleep timer loop.
- **Notifications & Modals**: Windows Native Toast Notifications (`new Notification(...)`) + always-on-top overlay windows (`waterPopupWindow` and `reminderWindow`).
- **System Tray**: System tray daemon icon with pause/resume and quick status tooltips.
- **Lifecycle**: Windows power monitor (`powerMonitor.on('resume')`, `powerMonitor.on('unlock-screen')`).

### B. Android Mobile
- **Local Notifications**: Scheduled at the OS level using Android `AlarmManager` (Exact Alarms) via `@capacitor/local-notifications`.
- **Execution when Terminated**: Notifications fire natively without requiring the React WebView to remain open in memory.
- **Device Reboot Recovery**: Receives `BOOT_COMPLETED` broadcast intent to reschedule pending slots on device restart.
- **Look Outside Experience**: Tapping the notification launches the app directly into the full-screen calming eye-break countdown. Emergency calls, navigation, and system functions remain unaffected.

---

## 5. Responsive UI Layouts

- **Desktop (Windows)**:
  - Sidebar navigation (208px fixed).
  - Next Reminders: **Water** and **Look Outside** cards displayed **side-by-side** in a 2-column grid (`grid grid-cols-2`).
- **Mobile (Android & Responsive Web)**:
  - Fixed compact top bar and bottom navigation bar (`MobileNav`).
  - Next Reminders: Stacked touch-friendly cards in a single-column layout (`grid-cols-1`).
  - Touch target sizes minimum 44x44px.
