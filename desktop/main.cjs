// EyeFlow Windows Native Background Desktop Application & Scheduler Daemon
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, powerMonitor, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Path to user config persistence in AppData
const userDataPath = app.getPath('userData');
const configFilePath = path.join(userDataPath, 'eyeflow_desktop_config.json');

// Default initial configuration
const DEFAULT_CONFIG = {
  water: {
    enabled: true,
    startTime: '08:00',
    endTime: '22:00',
    intervalMinutes: 60,
    durationMinutes: 2,
    reminderStyle: 'popup',
  },
  screen: {
    enabled: true,
    startTime: '09:00',
    endTime: '23:00',
    screenIntervalMinutes: 30,
    breakDurationMinutes: 5,
    reminderStyle: 'fullscreen',
  },
  pauseState: {
    isPaused: false,
    pauseUntil: null,
    pauseMinutes: null,
  },
  general: {
    startOnStartup: true,
    minimizeToTray: true,
  },
};

// State Manager
class ConfigStore {
  constructor() {
    this.config = this.load();
  }

  load() {
    try {
      if (fs.existsSync(configFilePath)) {
        const raw = fs.readFileSync(configFilePath, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to load config:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  save(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(configFilePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[ConfigStore] Failed to save config:', err);
    }
  }
}

const configStore = new ConfigStore();

// ========================================================
// 1. NATIVE BACKGROUND SCHEDULER ENGINE (ZERO CPU IDLE)
// ========================================================
class NativeBackgroundScheduler {
  constructor() {
    this.waterTimer = null;
    this.screenTimer = null;
    this.firedSlots = new Set();
    this.todayCompletedWater = [];
    this.todayCompletedScreen = [];
  }

  // Pure dynamic occurrence generator derived from device Date.now()
  generateDailyOccurrences(baseDate, startTime, endTime, intervalMinutes) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const interval = Math.max(5, intervalMinutes);

    const occurrences = [];
    for (let m = startMinutes; m <= endMinutes; m += interval) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      const slotDate = new Date(baseDate);
      slotDate.setHours(hour, minute, 0, 0);

      occurrences.push({
        timeString,
        timestamp: slotDate.getTime(),
      });
    }
    return occurrences;
  }

  // Pure dynamic next occurrence calculation
  findNextOccurrence(now, startTime, endTime, intervalMinutes) {
    const currentTimestamp = now.getTime();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const interval = Math.max(5, intervalMinutes);
    const intervalMs = interval * 60 * 1000;

    const todayStart = new Date(now);
    todayStart.setHours(startH, startM, 0, 0);
    const todayStartTimestamp = todayStart.getTime();

    const todayEnd = new Date(now);
    todayEnd.setHours(endH, endM, 0, 0);
    const todayEndTimestamp = todayEnd.getTime();

    // 1. Before today's start
    if (currentTimestamp < todayStartTimestamp) {
      return {
        timeString: startTime,
        timestamp: todayStartTimestamp,
        isTomorrow: false,
      };
    }

    // 2. Active Window
    if (currentTimestamp <= todayEndTimestamp) {
      const elapsedMs = Math.max(0, currentTimestamp - todayStartTimestamp);
      const intervalsElapsed = Math.floor(elapsedMs / intervalMs);

      for (let idx = intervalsElapsed; ; idx++) {
        const candidateTimestamp = todayStartTimestamp + idx * intervalMs;
        if (candidateTimestamp > todayEndTimestamp) break;

        if (candidateTimestamp >= currentTimestamp) {
          const cDate = new Date(candidateTimestamp);
          const timeString = `${String(cDate.getHours()).padStart(2, '0')}:${String(
            cDate.getMinutes()
          ).padStart(2, '0')}`;

          return {
            timeString,
            timestamp: candidateTimestamp,
            isTomorrow: false,
          };
        }
      }
    }

    // 3. After today's end -> tomorrow start
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(startH, startM, 0, 0);

    return {
      timeString: startTime,
      timestamp: tomorrow.getTime(),
      isTomorrow: true,
    };
  }

  // Recalculates and arms background sleep timers
  reschedule() {
    if (this.waterTimer) clearTimeout(this.waterTimer);
    if (this.screenTimer) clearTimeout(this.screenTimer);

    const now = new Date();
    const cfg = configStore.config;

    const isPaused =
      cfg.pauseState.isPaused &&
      cfg.pauseState.pauseUntil &&
      new Date(cfg.pauseState.pauseUntil).getTime() > now.getTime();

    if (isPaused) {
      updateTrayMenu(null, null, true);
      return;
    }

    // 1. Water Reminder Scheduling
    let nextWater = null;
    if (cfg.water.enabled) {
      nextWater = this.findNextOccurrence(
        now,
        cfg.water.startTime,
        cfg.water.endTime,
        cfg.water.intervalMinutes
      );

      if (nextWater && !nextWater.isTomorrow) {
        const delay = Math.max(200, nextWater.timestamp - Date.now());
        this.waterTimer = setTimeout(() => {
          this.triggerRealReminder('water', nextWater);
        }, delay);
      }
    }

    // 2. Look Outside Screen Break Scheduling
    let nextScreen = null;
    if (cfg.screen.enabled) {
      nextScreen = this.findNextOccurrence(
        now,
        cfg.screen.startTime,
        cfg.screen.endTime,
        cfg.screen.screenIntervalMinutes
      );

      if (nextScreen && !nextScreen.isTomorrow) {
        const delay = Math.max(200, nextScreen.timestamp - Date.now());
        this.screenTimer = setTimeout(() => {
          this.triggerRealReminder('screen', nextScreen);
        }, delay);
      }
    }

    // Update dynamic System Tray tooltip and menu
    updateTrayMenu(nextWater, nextScreen, isPaused);

    // Notify React UI via IPC if active
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('status-updated', {
        nextWater,
        nextScreen,
        isPaused,
      });
    }

    console.log(
      `[Native Scheduler] Device Clock: ${now.toLocaleTimeString()} | Next Water: ${
        nextWater?.timeString || 'None'
      } | Next Screen: ${nextScreen?.timeString || 'None'}`
    );
  }

  // Fires real background reminder: Native Notification + Native Reminder Window
  triggerRealReminder(category, occurrence) {
    const slotId = `${category}-${occurrence.timeString}`;
    if (this.firedSlots.has(slotId)) return;
    this.firedSlots.add(slotId);

    const cfg = configStore.config;

    if (category === 'water') {
      // 1. Native Windows Notification
      if (Notification.isSupported()) {
        new Notification({
          title: '💧 WATER BREAK',
          body: 'Time to drink some water. Take a short break.',
          silent: false,
        }).show();
      }

      // 2. Open Native Water Overlay
      openNativeWaterPopup((cfg.water.durationMinutes || 2) * 60);
    } else {
      // 1. Native Windows Notification
      if (Notification.isSupported()) {
        new Notification({
          title: '👀 LOOK OUTSIDE',
          body: 'Give your eyes a short break. Look away from the screen.',
          silent: false,
        }).show();
      }

      // 2. Open Native Full-Screen Reminder Window
      openNativeScreenBreakWindow((cfg.screen.breakDurationMinutes || 5) * 60);
    }

    // Schedule subsequent slot dynamically
    setTimeout(() => {
      this.reschedule();
    }, 2000);
  }

  resetToday() {
    this.firedSlots.clear();
    this.todayCompletedWater = [];
    this.todayCompletedScreen = [];
    this.reschedule();
  }
}

const scheduler = new NativeBackgroundScheduler();

// ========================================================
// 2. WINDOW & TRAY MANAGEMENT
// ========================================================
let mainWindow = null;
let reminderWindow = null;
let waterPopupWindow = null;
let tray = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 700,
    minHeight: 550,
    title: 'EyeFlow',
    show: false,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load production dist bundle or localhost dev server
  const devUrl = 'http://localhost:9966';
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL(devUrl);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // CRITICAL REQUIREMENT: Closing main window hides to tray instead of exiting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// Fullscreen, Always-On-Top Native Break Window (Does NOT lock Alt+Tab)
function openNativeScreenBreakWindow(durationSeconds) {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.show();
    reminderWindow.focus();
    return;
  }

  reminderWindow = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    skipTaskbar: false, // Allows standard Alt+Tab task switching
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    reminderWindow.loadFile(distPath);
  } else {
    reminderWindow.loadURL('http://localhost:9966');
  }

  reminderWindow.webContents.once('did-finish-load', () => {
    reminderWindow.webContents.send('reminder-triggered', {
      category: 'screen',
      durationSeconds,
      endTimestamp: Date.now() + durationSeconds * 1000,
    });
  });

  // Auto-close after duration + completion delay
  setTimeout(() => {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.close();
      reminderWindow = null;
    }
  }, (durationSeconds + 2) * 1000);
}

// Small Non-Blocking Native Water Popup Window
function openNativeWaterPopup(durationSeconds) {
  if (waterPopupWindow && !waterPopupWindow.isDestroyed()) {
    waterPopupWindow.show();
    return;
  }

  waterPopupWindow = new BrowserWindow({
    width: 400,
    height: 320,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    waterPopupWindow.loadFile(distPath);
  } else {
    waterPopupWindow.loadURL('http://localhost:9966');
  }

  waterPopupWindow.webContents.once('did-finish-load', () => {
    waterPopupWindow.webContents.send('reminder-triggered', {
      category: 'water',
      durationSeconds,
      endTimestamp: Date.now() + durationSeconds * 1000,
    });
  });

  setTimeout(() => {
    if (waterPopupWindow && !waterPopupWindow.isDestroyed()) {
      waterPopupWindow.close();
      waterPopupWindow = null;
    }
  }, (durationSeconds + 2) * 1000);
}

// ========================================================
// 3. SYSTEM TRAY IMPLEMENTATION
// ========================================================
function createSystemTray() {
  const iconPath = path.join(__dirname, 'trayIcon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);

  tray.setToolTip('EyeFlow — Digital Wellness Background Daemon');

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  updateTrayMenu(null, null, false);
}

function updateTrayMenu(nextWater, nextScreen, isPaused) {
  if (!tray) return;

  const waterStr = nextWater ? nextWater.timeString : 'Disabled / None';
  const screenStr = nextScreen ? nextScreen.timeString : 'Disabled / None';

  tray.setToolTip(
    isPaused
      ? 'EyeFlow — Reminders Paused'
      : `EyeFlow\n💧 Water: ${waterStr}\n👀 Look Outside: ${screenStr}`
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open EyeFlow',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: `💧 Next Water: ${waterStr}`,
      enabled: false,
    },
    {
      label: `👀 Next Screen Break: ${screenStr}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isPaused ? '▶ Resume Reminders' : '⏸ Pause for 1 Hour',
      click: () => {
        if (isPaused) {
          configStore.config.pauseState = { isPaused: false, pauseUntil: null, pauseMinutes: null };
        } else {
          const pauseUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          configStore.config.pauseState = { isPaused: true, pauseUntil, pauseMinutes: 60 };
        }
        configStore.save(configStore.config);
        scheduler.reschedule();
      },
    },
    { type: 'separator' },
    {
      label: 'Exit EyeFlow',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ========================================================
// 4. NATIVE IPC COMMUNICATION BRIDGE
// ========================================================
function setupIpcHandlers() {
  ipcMain.handle('getSchedulerStatus', () => {
    const now = new Date();
    const cfg = configStore.config;
    const nextWater = cfg.water.enabled
      ? scheduler.findNextOccurrence(now, cfg.water.startTime, cfg.water.endTime, cfg.water.intervalMinutes)
      : null;
    const nextScreen = cfg.screen.enabled
      ? scheduler.findNextOccurrence(now, cfg.screen.startTime, cfg.screen.endTime, cfg.screen.screenIntervalMinutes)
      : null;

    return {
      config: cfg,
      nextWater,
      nextScreen,
      deviceTimestamp: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  });

  ipcMain.handle('updateWaterConfig', (_e, newWaterConfig) => {
    configStore.config.water = { ...configStore.config.water, ...newWaterConfig };
    configStore.save(configStore.config);
    scheduler.reschedule();
    return { success: true };
  });

  ipcMain.handle('updateScreenConfig', (_e, newScreenConfig) => {
    configStore.config.screen = { ...configStore.config.screen, ...newScreenConfig };
    configStore.save(configStore.config);
    scheduler.reschedule();
    return { success: true };
  });

  ipcMain.handle('pauseReminders', (_e, minutes) => {
    if (minutes === null) {
      configStore.config.pauseState = { isPaused: false, pauseUntil: null, pauseMinutes: null };
    } else {
      const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      configStore.config.pauseState = { isPaused: true, pauseUntil: until, pauseMinutes: minutes };
    }
    configStore.save(configStore.config);
    scheduler.reschedule();
    return { success: true };
  });

  ipcMain.handle('resumeReminders', () => {
    configStore.config.pauseState = { isPaused: false, pauseUntil: null, pauseMinutes: null };
    configStore.save(configStore.config);
    scheduler.reschedule();
    return { success: true };
  });

  ipcMain.handle('startPreview', (_e, category, durationSec) => {
    const duration = durationSec || 10;
    if (category === 'water') {
      openNativeWaterPopup(duration);
    } else {
      openNativeScreenBreakWindow(duration);
    }
    return { success: true };
  });

  ipcMain.handle('completeReminder', (_e, category, slotId) => {
    if (category === 'water') {
      scheduler.todayCompletedWater.push({ id: slotId, time: new Date().toLocaleTimeString() });
    } else {
      scheduler.todayCompletedScreen.push({ id: slotId, time: new Date().toLocaleTimeString() });
    }
    scheduler.reschedule();
    return { success: true };
  });

  ipcMain.handle('resetTodayData', () => {
    scheduler.resetToday();
    return { success: true };
  });

  ipcMain.handle('setStartWithWindows', (_e, enable) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: true,
    });
    configStore.config.general.startOnStartup = enable;
    configStore.save(configStore.config);
    return { success: true };
  });

  ipcMain.handle('getStartWithWindows', () => {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  });

  ipcMain.handle('minimizeToTray', () => {
    if (mainWindow) mainWindow.hide();
    return { success: true };
  });

  ipcMain.handle('showMainWindow', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return { success: true };
  });
}

// ========================================================
// 5. APPLICATION INITIALIZATION & POWER MONITOR
// ========================================================
// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();
    createSystemTray();
    setupIpcHandlers();
    scheduler.reschedule();

    // Sleep/Wake listener
    powerMonitor.on('resume', () => {
      console.log('[Native Scheduler] System resumed from sleep. Rescheduling on device clock.');
      scheduler.reschedule();
    });

    powerMonitor.on('unlock-screen', () => {
      scheduler.reschedule();
    });
  });

  app.on('window-all-closed', (e) => {
    // Keep background process alive in system tray
    e.preventDefault();
  });
}
