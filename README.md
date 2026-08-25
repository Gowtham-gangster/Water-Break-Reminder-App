# EyeFlow — Digital Wellness Desktop Application

> **"Drink water. Look away. Feel better."**

EyeFlow is a native digital wellness Windows desktop application built with React, TypeScript, Vite, and Electron. It protects eyesight and promotes consistent hydration with an autonomous **24/7 background scheduler**, **system tray presence**, **native Windows toast notifications**, and **focused reminder countdown overlays** that automatically release input blocking at 00:00.

---

## 📦 Beta Distribution Artifacts

The standalone production releases are packaged ready for distribution in the `release/` directory:

| Package Type | File Path | Description |
|---|---|---|
| **Windows Installer (Recommended)** | [`release/EyeFlow-Setup-1.0.0.exe`](file:///release/EyeFlow-Setup-1.0.0.exe) | Standard NSIS installer for Windows 10 & 11 (64-bit). Creates Desktop & Start Menu shortcuts, registers in Windows Settings > Installed Apps, and supports clean uninstallation. |
| **Portable Archive** | [`release/EyeFlow-1.0.0-win-x64-portable.zip`](file:///release/EyeFlow-1.0.0-win-x64-portable.zip) | Standalone portable zero-install archive. Extract anywhere and launch `EyeFlow.exe` directly. |

> [!NOTE]
> Neither package requires Node.js, npm, or any development dependencies on the end-user's machine.

---

## 🏗️ Architecture & Core Components

```
                   EyeFlow-Setup-1.0.0.exe
                              │
                      (User Installation)
                              │
                              ▼
                %LOCALAPPDATA%\Programs\EyeFlow\
                              │
                              ▼
                         EyeFlow.exe
                              │
           ┌──────────────────┴──────────────────┐
           ▼                                     ▼
   Main Dashboard UI                    Background Daemon Engine
   (React + TypeScript)                     (desktop/main.cjs)
           │                                     │
   • Config & Schedules                 • Continuous Timestamp Scheduler
   • Activity Log & History             • System Tray Controller & Menu
   • Minimize to Tray on Close          • Windows Toast Notifications
                                        • Native Modal Overlay Window
                                                 │
                               ┌─────────────────┴─────────────────┐
                               ▼                                   ▼
                        Water Reminder                  Look Outside Screen Break
                               │                                   │
                               └─────────────────┬─────────────────┘
                                                 ▼
                                     Dedicated Modal Window
                                  (Auto-dismiss & Input Release)
```

1. **Autonomous Background Scheduler**:
   - Executes 24/7 in the native Electron main process (`desktop/main.cjs`).
   - Maintains schedule integrity and timer calculations even when the main dashboard is minimized or closed.
2. **System Tray Integration**:
   - Closes (`X`) send the main window to the Windows System Tray.
   - Context menu provides instant access to open the dashboard, trigger manual reminders, pause reminders (30m, 1h, today), or quit cleanly.
3. **Dedicated Reminder Overlays & Dual-Timer Support**:
   - When scheduled times arrive, only the dedicated reminder modal appears on top of other applications.
   - When both water and screen break reminders occur at the same time, both countdowns are unified into a single window.
   - Timers are authoritative native countdowns: at `00:00`, the overlay immediately disappears and restores normal desktop mouse and keyboard interactions.
4. **Offline Persistence**:
   - Schedules, break logs, and hydration metrics are persisted locally in IndexedDB and `%APPDATA%\eyeflow`.

---

## 🚀 Installation & Uninstallation Guide (Beta Testers)

### Installation:
1. Download or copy `EyeFlow-Setup-1.0.0.exe` to the target Windows computer.
2. Double-click `EyeFlow-Setup-1.0.0.exe`.
3. Follow the setup wizard (installs to `%LOCALAPPDATA%\Programs\EyeFlow` without requiring administrative elevation).
4. Launch EyeFlow from the Desktop shortcut, Start Menu, or the installer finish screen.

### Running Portably:
1. Download and extract `EyeFlow-1.0.0-win-x64-portable.zip`.
2. Double-click `EyeFlow.exe` in the extracted folder.

### Uninstallation:
1. Open **Windows Settings > Apps > Installed Apps** (or Control Panel > Programs and Features).
2. Locate **EyeFlow Digital Wellness**.
3. Click **Uninstall** (or run `%LOCALAPPDATA%\Programs\EyeFlow\Uninstall EyeFlow.exe`).

---

## 🛠️ Build & Packaging Reproduction

To reproduce the complete production build from source:

### Prerequisites:
- Windows 10 / 11 (64-bit)
- Node.js (v18+) and npm

### Build Commands:

```bash
# 1. Install project dependencies
npm install

# 2. Build the React web application bundle
npm run build

# 3. Package and build all distribution artifacts (NSIS Installer + Portable ZIP)
npm run dist:all

# Alternative target-specific commands:
npm run dist:win       # Builds NSIS installer only
npm run package:win    # Unpacked directory build (dist-electron/win-unpacked)
```

The resulting distribution files will be placed directly in the `release/` folder with verified SHA256 checksums.

---

## 📋 System Requirements
- **Operating System**: Windows 10 / Windows 11 (64-bit)
- **User Privileges**: Standard user (No Administrator privileges required)
- **Runtime Dependencies**: Zero external dependencies (Embedded Electron runtime)
- **Network**: Fully offline capable
