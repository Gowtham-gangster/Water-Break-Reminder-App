# EyeFlow — Digital Wellness Desktop Application

> **"Drink water. Look away. Feel better."**

EyeFlow is a native digital wellness application designed to prevent eye strain and maintain healthy hydration habits. It runs as an independent Windows background application with a **24/7 background scheduler**, **system tray presence**, **native Windows notifications**, and **unobtrusive fullscreen screen break overlays**.

---

## 🏗️ Production Architecture

```
                 EyeFlow.exe
                     │
          ┌──────────┴──────────┐
          │                     │
     Control Panel         Background Engine
       React UI            Native Daemon
                                │
                           Scheduler
                                │
                         Device Clock (Date.now())
                                │
                 ┌──────────────┴──────────────┐
                 ↓                             ↓
          Water Reminder                Look Outside
                 ↓                             ↓
        Native Notification           Native Notification
                 ↓                             ↓
        Native Reminder Window        Native Reminder Window
```

- **Independent Background Daemon**: The scheduler runs continuously in the desktop process (`desktop/main.cjs`) even when the main window is closed.
- **System Tray Presence**: Minimizes to the Windows System Tray on close (`X`).
- **Zero Localhost/Browser Dependency**: Does not require browser tabs, Chrome/Edge, or a dev server in production.
- **True Timestamp Math**: Dynamic occurrence calculation derived from `Date.now()` without clock drift or polling overhead.

---

## ⚡ Features

1. **💧 Water Reminders**:
   - Customizable active windows, intervals, and reminder durations.
   - Native Windows toast notifications and non-blocking popup reminder window.
2. **👁 Look Outside Screen Breaks**:
   - Dedicated borderless, fullscreen, always-on-top break overlay.
   - **Alt+Tab Task Switching**: Full Windows multitasking freedom without OS lockouts.
   - Automatic timestamp countdown with completion screen and auto-dismissal.
3. **📊 Today's Progress & Statistics**:
   - Real-time hydration and break completion metrics persisted offline in IndexedDB and AppData.
4. **⚙️ Windows Startup Integration**:
   - Optional auto-launch with Windows in minimized background mode.
5. **⏸ Smart Pause**:
   - Quick pause presets (30 min, 1 hr, today) via UI and System Tray context menu.

---

## 🚀 Installation & Launch

### 1. Run Pre-built Windows Application
Run the packaged application directly:
```bash
dist-desktop\EyeFlow-win32-x64\EyeFlow.exe
```

### 2. Install to Windows (with Desktop & Start Menu Shortcuts)
Double-click `desktop/install.bat` to install EyeFlow into `%LOCALAPPDATA%\Programs\EyeFlow`.

### 3. Release Archive
The complete standalone Windows release zip is available at:
```
dist-desktop/EyeFlow-Windows-x64-v1.0.0.zip
```

---

## 💻 Developer Commands

```bash
# Start Vite development server
npm run dev

# Run desktop app in development
npm run desktop:dev

# Clean production web build
npm run build

# Package standalone Windows application
npm run package:win
```

---

## 📋 System Requirements
- **OS**: Windows 10 / Windows 11 (x64)
- **Permissions**: Normal user level (No Administrator privileges required)
- **Network**: 100% Offline-first (No internet connection needed for core reminders)
