// PauseFlow Windows Native Background Desktop Application & Scheduler Daemon
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, powerMonitor, nativeImage, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Chromium command line flags for Windows compatibility
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Global Uncaught Exception & Promise Rejection Handlers
process.on('uncaughtException', (err) => {
  console.error('[PauseFlow UncaughtException]', err);
  try {
    dialog.showErrorBox('PauseFlow Unexpected Error', `An error occurred: ${err?.message || err}`);
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[PauseFlow UnhandledRejection]', reason);
});

// Ensure explicit, consistent application identity and durable storage partition
app.name = 'PauseFlow';
try {
  app.setAppUserModelId('com.pauseflow.desktop');
  const appData = app.getPath('appData');
  const oldUserData = path.join(appData, 'EyeFlow');
  const newUserData = path.join(appData, 'PauseFlow');

  // Migrate existing data from %APPDATA%\EyeFlow if %APPDATA%\PauseFlow does not exist
  if (fs.existsSync(oldUserData) && !fs.existsSync(newUserData)) {
    try {
      fs.cpSync(oldUserData, newUserData, { recursive: true });
      console.log('[PauseFlow] Migrated user data directory from EyeFlow to PauseFlow successfully.');
    } catch (migErr) {
      console.error('[PauseFlow] Migration warning:', migErr);
    }
  }

  app.setPath('userData', newUserData);
} catch (_) {}

// Paths resolution
const userDataPath = app.getPath('userData');
const configFilePath = path.join(userDataPath, 'pauseflow_desktop_config.json');
const logFilePath = path.join(userDataPath, 'pauseflow_startup.log');

// Migrate legacy config file if old one exists in directory
try {
  const legacyConfigFile = path.join(userDataPath, 'eyeflow_desktop_config.json');
  if (fs.existsSync(legacyConfigFile) && !fs.existsSync(configFilePath)) {
    fs.copyFileSync(legacyConfigFile, configFilePath);
  }
} catch (_) {}

function logToFile(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}\n`;
  try {
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch (_) {}
  console.log(...args);
}

logToFile('[PauseFlow] Process boot starting...');
logToFile('[PauseFlow] Process argv:', process.argv);
logToFile('[PauseFlow] AppPath:', app.getAppPath());
logToFile('[PauseFlow] UserData:', userDataPath);

// Deterministic resource path resolvers for both development and packaged production
function getRendererPath() {
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return candidates[0];
}

function getPreloadPath() {
  const candidates = [
    path.join(__dirname, 'preload.cjs'),
    path.join(app.getAppPath(), 'desktop', 'preload.cjs'),
    path.join(process.resourcesPath, 'app.asar', 'desktop', 'preload.cjs'),
    path.join(process.resourcesPath, 'app', 'desktop', 'preload.cjs'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return candidates[0];
}

function getTrayIcon() {
  const candidates = [
    path.join(__dirname, 'trayIcon.png'),
    path.join(app.getAppPath(), 'desktop', 'trayIcon.png'),
    path.join(process.resourcesPath, 'app.asar', 'desktop', 'trayIcon.png'),
    path.join(process.resourcesPath, 'desktop', 'trayIcon.png'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) return img;
      }
    } catch (_) {}
  }

  // Failsafe embedded 32x32 RGBA icon
  const rawPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAIcSURBVFhH7ZUxaxRBEMf/c9fcJVy8w16wsLAwsLCwsLCwsLCwsLCw0N/g21hYWlhYWlhYWlhYWlhYWFiY7c5u843d+S3b3M3m7t7tXhCCh7u97OzszG92d2bnhWJ0NTo6Oz/n5uZE0zTNlUolGo/HiqKoVCwW1TAMaZqm0TRNaZom27ZteZ4nRVEoTdMkSZLknPMkSYqmaaRpmtq2rZimqTzPk9/3hWEYHMchx3Ho6OhIC4KAdF2npVKJms1mbnNzc3Z7e3tmZWVlplgs1h8fH5fSNM3Nzs5qYRhaQRBYQRA4c3NzlmEYlmVZliRJ0jAMy7Ztq9/vW8PhUBqNhvV6vW6tVit5nqf7/b7q9Xqq2+2qKIpq2+12tdFoVFzXTcfjsfr9vjSZTOj+/r6o1WupTqejcDhU7/ev3N/fm6empurFYrHYbreLz8/P/d3d3aNyuXwUhqEVhqHneZ7neZ7ned7V1dVVbbfbJb/fn+p2u2Xf9/8LwA83t7e31efnZ7rdbjQYDNRwOJRlWVIURVIURbIsi5Ik0cHBgURRJL1eT+7u7urVavXk/v7+1OfnZ12v12VdV1IUhWzbJu/7vu/7vuu6vuu6/maz6Xmep5TL5dLz83Pl+770+31ptVrSdZ3EcfzfwM+Ojo7u/P9zRkdH/yP4A14eKxW+v/EAAAAASUVORK5CYII=',
    'base64'
  );
  return nativeImage.createFromBuffer(rawPng);
}

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

// Deep merge helper to prevent nested config loss
function deepMerge(target, source) {
  const output = { ...target };
  if (source && typeof source === 'object') {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = deepMerge(target[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        output[key] = source[key];
      }
    }
  }
  return output;
}

// State Manager
class ConfigStore {
  constructor() {
    this.config = this.load();
  }

  load() {
    try {
      if (fs.existsSync(configFilePath)) {
        const raw = fs.readFileSync(configFilePath, 'utf8');
        return deepMerge(DEFAULT_CONFIG, JSON.parse(raw));
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to load config:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  save(newConfig) {
    this.config = deepMerge(this.config, newConfig);
    try {
      fs.writeFileSync(configFilePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[ConfigStore] Failed to save config:', err);
    }
  }
}

const configStore = new ConfigStore();

// Multi-Monitor Active Display Calculation
function getActiveDisplayBounds() {
  try {
    const cursorPoint = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
    if (activeDisplay && activeDisplay.bounds) {
      return activeDisplay.bounds;
    }
  } catch (err) {
    console.warn('[Screen] Could not get display nearest cursor:', err);
  }
  try {
    const primary = screen.getPrimaryDisplay();
    if (primary && primary.bounds) {
      return primary.bounds;
    }
  } catch (err) {
    console.warn('[Screen] Could not get primary display:', err);
  }
  return { x: 0, y: 0, width: 1920, height: 1080 };
}

// Diagnostic Startup Logging
const rendererPath = getRendererPath();
const preloadPath = getPreloadPath();

console.log('[PauseFlow] Application starting...');
console.log('[PauseFlow] Packaged:', app.isPackaged);
console.log('[PauseFlow] App path:', app.getAppPath());
console.log('[PauseFlow] Resources path:', process.resourcesPath);
console.log('[PauseFlow] __dirname:', __dirname);
console.log('[PauseFlow] Renderer:', rendererPath);
console.log('[PauseFlow] Renderer exists:', fs.existsSync(rendererPath));
console.log('[PauseFlow] Preload:', preloadPath);
console.log('[PauseFlow] Preload exists:', fs.existsSync(preloadPath));

if (process.argv.includes('--diagnostic') || process.argv.includes('-d')) {
  console.log('====================================');
  console.log('   PauseFlow Diagnostic State Log   ');
  console.log('====================================');
  console.log('Config File:', configFilePath);
  console.log('Config State:', JSON.stringify(configStore.config, null, 2));
  console.log('====================================');
}

// Helper to load bundled HTML reliably with optional query parameters
function loadAppFile(targetWindow, queryParams = {}) {
  const query = new URLSearchParams(queryParams).toString();
  const fileTarget = getRendererPath();
  const fileUrl = url.pathToFileURL(fileTarget).href + (query ? `?${query}` : '');

  targetWindow.loadURL(fileUrl).catch((err1) => {
    console.warn('[PauseFlow Loader] loadURL failed:', err1?.message);
    targetWindow.loadFile(fileTarget, { query: queryParams }).catch((err2) => {
      console.error('[PauseFlow Loader] All loader strategies failed:', err2);
      dialog.showErrorBox(
        'PauseFlow Resource Error',
        `PauseFlow could not load its application interface.\n\nPath: ${fileTarget}\nError: ${err2?.message || err2}`
      );
    });
  });
}

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
    this.lastActiveDay = new Date().toISOString().split('T')[0];

    // Midnight rollover monitor
    setInterval(() => {
      const currentDay = new Date().toISOString().split('T')[0];
      if (this.lastActiveDay && this.lastActiveDay !== currentDay) {
        console.log('[Native Scheduler] Date rolled over at midnight. Resetting daily slots.');
        this.firedSlots.clear();
        this.todayCompletedWater = [];
        this.todayCompletedScreen = [];
        this.lastActiveDay = currentDay;
        this.reschedule();
      }
    }, 60000);
  }

  // Dynamic occurrence generator derived from device clock
  generateDailyOccurrences(baseDate, startTime, endTime, intervalMinutes) {
    const [startH, startM] = (startTime || '08:00').split(':').map(Number);
    const [endH, endM] = (endTime || '22:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const interval = Math.max(5, intervalMinutes || 30);

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

  // Dynamic next occurrence calculation strictly in the future (> currentTimestamp + 1000ms)
  findNextOccurrence(now, startTime, endTime, intervalMinutes) {
    const currentTimestamp = now.getTime();
    const [startH, startM] = (startTime || '08:00').split(':').map(Number);
    const [endH, endM] = (endTime || '22:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const interval = Math.max(5, intervalMinutes || 30);
    const intervalMs = interval * 60 * 1000;

    const todayStart = new Date(now);
    todayStart.setHours(startH, startM, 0, 0);
    const todayStartTimestamp = todayStart.getTime();

    const todayEnd = new Date(now);
    todayEnd.setHours(endH, endM, 0, 0);
    const todayEndTimestamp = todayEnd.getTime();

    // 1. Before today's start -> next occurrence is today's start
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

        // STRICT GUARANTEE: Must be strictly in the future
        if (candidateTimestamp > currentTimestamp + 1000) {
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

  // Recalculates and arms background sleep timers for upcoming future occurrences
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

    // 1. Water Reminder Scheduling (strictly future timers only)
    let nextWater = null;
    if (cfg.water.enabled) {
      nextWater = this.findNextOccurrence(
        now,
        cfg.water.startTime,
        cfg.water.endTime,
        cfg.water.intervalMinutes
      );

      if (nextWater && !nextWater.isTomorrow) {
        const delay = nextWater.timestamp - Date.now();
        if (delay > 1000) {
          this.waterTimer = setTimeout(() => {
            this.triggerRealReminder('water', nextWater);
          }, delay);
        }
      }
    }

    // 2. Look Outside Screen Break Scheduling (strictly future timers only)
    let nextScreen = null;
    if (cfg.screen.enabled) {
      nextScreen = this.findNextOccurrence(
        now,
        cfg.screen.startTime,
        cfg.screen.endTime,
        cfg.screen.screenIntervalMinutes
      );

      if (nextScreen && !nextScreen.isTomorrow) {
        const delay = nextScreen.timestamp - Date.now();
        if (delay > 1000) {
          this.screenTimer = setTimeout(() => {
            this.triggerRealReminder('screen', nextScreen);
          }, delay);
        }
      }
    }

    // Update dynamic System Tray tooltip and menu
    updateTrayMenu(nextWater, nextScreen, isPaused);

    // Notify React UI via IPC if active (Dashboard schedule display only, never pops up mainWindow)
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

  // Fires real background reminder: Opens full-display input blocking reminder window
  // mainWindow remains untouched (minimized / in tray / in background)
  triggerRealReminder(category, occurrence) {
    const todayIso = new Date(occurrence.timestamp).toISOString().split('T')[0];
    const slotId = `${category}:${todayIso}:${occurrence.timeString}`;

    if (this.firedSlots.has(slotId)) return;
    this.firedSlots.add(slotId);

    const cfg = configStore.config;
    const durationSeconds =
      category === 'water'
        ? (cfg.water.durationMinutes || 2) * 60
        : (cfg.screen.breakDurationMinutes || 5) * 60;

    console.log(`[Native Scheduler] Real reminder due: ${slotId} (${durationSeconds}s)`);

    // 1. Native Windows Notification
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: category === 'water' ? '💧 WATER BREAK' : '👀 LOOK OUTSIDE',
          body:
            category === 'water'
              ? 'Time to drink some water. Stay refreshed and hydrated.'
              : 'Give your eyes a short break. Look away from the screen.',
          silent: false,
        }).show();
      }
    } catch (err) {
      console.warn('[Notification] Failed to show notification:', err);
    }

    // 2. Add to active reminders and show inside the dedicated full-display input-blocking overlay window
    addActiveReminder({
      type: category,
      category,
      occurrenceId: slotId,
      slotId,
      durationSeconds,
      durationMs: durationSeconds * 1000,
      endTimestamp: Date.now() + durationSeconds * 1000,
      scheduledAt: occurrence.timeString,
      triggeredAt: Date.now(),
      isPreview: false,
    });

    // 3. Notify mainWindow immediately that real reminder was triggered
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('reminder-triggered', {
        type: category,
        slotId,
        scheduledAt: new Date(occurrence.timestamp).toISOString(),
        triggeredAt: Date.now(),
        durationSeconds,
      });
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
// 2. FULL-DISPLAY INPUT-BLOCKING OVERLAY WINDOW MANAGEMENT
// ========================================================
let mainWindow = null;
let reminderWindow = null;
let tray = null;

// Single Source of Truth for Live Active Reminders
const activeRemindersMap = new Map();
const activeReminderTimersMap = new Map();

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 700,
    minHeight: 550,
    title: 'PauseFlow',
    show: true,
    backgroundColor: '#090d16',
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Explicitly remove application menu at window level
  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  logToFile('[Electron] Main window created');
  loadAppFile(mainWindow, { mode: 'dashboard' });

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    console.error('[MainWindow] Failed to load index.html:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[MainWindow] Render process gone:', JSON.stringify(details));
  });

  // Closing main window hides to tray instead of exiting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      logToFile('[Electron] Main window hidden to tray');
    }
  });

  mainWindow.on('closed', () => {
    logToFile('[Electron] Main window closed');
    mainWindow = null;
  });
}

// Desktop reminder presentation completion function (Presentation-only: does NOT author database completion)
function completeActiveReminderItem(type, slotId, isPreview) {
  console.log(`[Reminder] DESKTOP_DISMISSED: ${type} (${slotId}) [desktop_triggered != completed]`);

  // Clear native timer for this slot
  if (activeReminderTimersMap.has(slotId)) {
    clearTimeout(activeReminderTimersMap.get(slotId));
    activeReminderTimersMap.delete(slotId);
  }

  if (!isPreview) {
    scheduler.reschedule();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('native-reminder-expired', {
        type,
        slotId,
        dismissedAt: new Date().toISOString(),
      });
    }
  }

  activeRemindersMap.delete(slotId);
  console.log(`[Reminder] ACTIVE_REMINDERS remaining: ${activeRemindersMap.size}`);

  // If no more reminders remain active, close and destroy the overlay window IMMEDIATELY
  if (activeRemindersMap.size === 0) {
    console.log('[Reminder] OVERLAY_CLOSE — releasing input block');
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.destroy();
      reminderWindow = null;
    }
    console.log('[Reminder] INPUT_BLOCK_RELEASED — desktop interaction restored');
  } else {
    // Other reminder is still counting down; update remaining reminders in the overlay
    console.log('[Reminder] keeping overlay because other reminder is still active');
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.webContents.send('active-reminders-updated', Array.from(activeRemindersMap.values()));
    }
  }
}

// Authoritative lifecycle expiration/skip function
function expireActiveReminderItem(type, slotId, isPreview) {
  console.log(`[Reminder] EXPIRE/SKIP: ${type} (${slotId})`);

  // Clear native timer for this slot
  if (activeReminderTimersMap.has(slotId)) {
    clearTimeout(activeReminderTimersMap.get(slotId));
    activeReminderTimersMap.delete(slotId);
  }

  if (!isPreview) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('native-reminder-expired', {
        type,
        slotId,
        expiredAt: new Date().toISOString(),
      });
    }
    scheduler.reschedule();
  }

  activeRemindersMap.delete(slotId);
  console.log(`[Reminder] ACTIVE_REMINDERS remaining: ${activeRemindersMap.size}`);

  if (activeRemindersMap.size === 0) {
    console.log('[Reminder] OVERLAY_CLOSE — releasing input block');
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.destroy();
      reminderWindow = null;
    }
    console.log('[Reminder] INPUT_BLOCK_RELEASED — desktop interaction restored');
  } else {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.webContents.send('active-reminders-updated', Array.from(activeRemindersMap.values()));
    }
  }
}

// Adds an active reminder (Water, Look Outside, or both) and manages ONE dedicated full-display input-blocking overlay
function addActiveReminder(item) {
  // Prevent duplicate occurrence
  if (activeRemindersMap.has(item.occurrenceId) || activeRemindersMap.has(item.slotId)) {
    console.log(`[Reminder] ${item.slotId} is already active.`);
    return;
  }

  activeRemindersMap.set(item.slotId, item);
  console.log(`[Reminder] START ${item.type} | END_TIMESTAMP: ${new Date(item.endTimestamp).toLocaleTimeString()}`);
  console.log(`[Reminder] ACTIVE_REMINDERS count: ${activeRemindersMap.size}`);

  // Schedule native authoritative completion timer in the main process
  const remainingMs = Math.max(0, item.endTimestamp - Date.now());
  const nativeTimer = setTimeout(() => {
    completeActiveReminderItem(item.type, item.slotId, item.isPreview);
  }, remainingMs);
  activeReminderTimersMap.set(item.slotId, nativeTimer);

  const displayBounds = getActiveDisplayBounds();

  // If overlay window does NOT exist or is destroyed, create full-display input-blocking window
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    reminderWindow = new BrowserWindow({
      x: displayBounds.x,
      y: displayBounds.y,
      width: displayBounds.width,
      height: displayBounds.height,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      skipTaskbar: false, // Normal Windows Alt+Tab support
      focusable: true,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: getPreloadPath(),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    reminderWindow.setMenu(null);
    reminderWindow.setMenuBarVisibility(false);
    reminderWindow.setIgnoreMouseEvents(false); // Capture mouse input everywhere across the display

    loadAppFile(reminderWindow, { mode: 'reminder' });

    reminderWindow.once('ready-to-show', () => {
      if (reminderWindow && !reminderWindow.isDestroyed()) {
        reminderWindow.show();
        reminderWindow.focus();
        try {
          reminderWindow.setAlwaysOnTop(true, 'screen-saver');
        } catch (_) {
          reminderWindow.setAlwaysOnTop(true);
        }
      }
    });

    reminderWindow.webContents.once('did-finish-load', () => {
      if (reminderWindow && !reminderWindow.isDestroyed()) {
        reminderWindow.webContents.send('active-reminders-updated', Array.from(activeRemindersMap.values()));
      }
    });

    reminderWindow.on('closed', () => {
      logToFile('[Electron] Reminder overlay window closed');
      reminderWindow = null;
    });
  } else {
    // Window is ALREADY open (e.g. Look Outside is added while Water is counting down)
    reminderWindow.setBounds(displayBounds);
    if (!reminderWindow.isVisible()) {
      reminderWindow.show();
    }
    reminderWindow.focus();
    try {
      reminderWindow.setAlwaysOnTop(true, 'screen-saver');
    } catch (_) {
      reminderWindow.setAlwaysOnTop(true);
    }
    reminderWindow.webContents.send('active-reminders-updated', Array.from(activeRemindersMap.values()));
  }
}

// ========================================================
// 3. SYSTEM TRAY IMPLEMENTATION
// ========================================================
function createSystemTray() {
  try {
    const trayIcon = getTrayIcon();
    tray = new Tray(trayIcon);
    tray.setToolTip('PauseFlow — Digital Wellness Background Daemon');

    tray.on('double-click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });

    updateTrayMenu(null, null, false);
    console.log('[PauseFlow] Tray initialized');
  } catch (err) {
    console.warn('[SystemTray] Tray initialization warning:', err);
  }
}

function updateTrayMenu(nextWater, nextScreen, isPaused) {
  if (!tray) return;

  const waterStr = nextWater ? nextWater.timeString : 'Disabled / None';
  const screenStr = nextScreen ? nextScreen.timeString : 'Disabled / None';

  tray.setToolTip(
    isPaused
      ? 'PauseFlow — Reminders Paused'
      : `PauseFlow\n💧 Water: ${waterStr}\n👀 Look Outside: ${screenStr}`
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open PauseFlow',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
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
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('onNativePauseStateChange', configStore.config.pauseState);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Exit PauseFlow',
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

  ipcMain.handle('getActiveReminders', () => {
    return Array.from(activeRemindersMap.values());
  });

  ipcMain.handle('getReminderData', () => {
    return Array.from(activeRemindersMap.values())[0] || null;
  });

  ipcMain.handle('completeReminderItem', (_e, type, slotId, isPreview) => {
    completeActiveReminderItem(type, slotId, Boolean(isPreview));
    return { success: true };
  });

  ipcMain.handle('completeReminder', (_e, category, slotId) => {
    completeActiveReminderItem(category, slotId, false);
    return { success: true };
  });

  ipcMain.handle('skipReminderItem', (_e, type, slotId, isPreview) => {
    expireActiveReminderItem(type, slotId, Boolean(isPreview));
    return { success: true };
  });

  ipcMain.handle('skipReminder', (_e, category, slotId) => {
    expireActiveReminderItem(category, slotId, false);
    return { success: true };
  });

  ipcMain.handle('closeReminderWindow', () => {
    for (const timer of activeReminderTimersMap.values()) {
      clearTimeout(timer);
    }
    activeReminderTimersMap.clear();
    activeRemindersMap.clear();
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.destroy();
      reminderWindow = null;
    }
    return { success: true };
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

  // Preview opens dedicated reminder overlay in preview mode (zero history/scheduler modification)
  ipcMain.handle('startPreview', (_e, category, durationSec) => {
    const duration = durationSec || 10;
    const slotId = `preview:${category}:${Date.now()}`;
    addActiveReminder({
      type: category,
      category,
      occurrenceId: slotId,
      slotId,
      durationSeconds: duration,
      durationMs: duration * 1000,
      endTimestamp: Date.now() + duration * 1000,
      scheduledAt: new Date().toLocaleTimeString(),
      triggeredAt: Date.now(),
      isPreview: true,
    });
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
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
    return { success: true };
  });

  ipcMain.handle('showMainWindow', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
    return { success: true };
  });

  // V2 User-Scoped Schedule Synchronization Handlers
  let currentActiveUserId = null;
  const userDaemonTimers = new Map();

  ipcMain.handle('syncUserSchedule', (_e, userId, notifications) => {
    // 1. If switching user, cancel all previous user timers
    if (currentActiveUserId && currentActiveUserId !== userId) {
      for (const [key, timer] of userDaemonTimers.entries()) {
        clearTimeout(timer);
        userDaemonTimers.delete(key);
      }
    }
    currentActiveUserId = userId;

    // 2. Clear existing timers for this user
    for (const [key, timer] of userDaemonTimers.entries()) {
      if (key.startsWith(`${userId}:`)) {
        clearTimeout(timer);
        userDaemonTimers.delete(key);
      }
    }

    // 3. Queue future notifications
    if (Array.isArray(notifications)) {
      const now = Date.now();
      for (const notif of notifications) {
        if (notif.scheduledTimestamp > now + 1000) {
          const delay = notif.scheduledTimestamp - now;
          const key = `${userId}:${notif.id}`;
          const timer = setTimeout(() => {
            userDaemonTimers.delete(key);
            // Verify current active user is still matching
            if (currentActiveUserId !== userId) return;

            // Display non-intrusive native Windows Notification
            if (Notification.isSupported()) {
              const nativeNotif = new Notification({
                title: notif.title || (notif.category === 'water' ? '💧 Time for water' : '👁 Look outside'),
                body: notif.body || (notif.category === 'water' ? 'Take a short water break.' : 'Rest your eyes from the screen.'),
                icon: getTrayIcon(),
                silent: false,
              });

              nativeNotif.on('click', () => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  if (mainWindow.isMinimized()) mainWindow.restore();
                  mainWindow.show();
                  mainWindow.focus();
                  mainWindow.webContents.send('notification-tap', {
                    category: notif.category,
                    slotId: notif.id,
                    userId,
                  });
                }
              });

              nativeNotif.show();
            }
          }, delay);

          userDaemonTimers.set(key, timer);
        }
      }
    }

    return { success: true, queuedCount: userDaemonTimers.size };
  });

  ipcMain.handle('cancelUserSchedule', (_e, userId) => {
    for (const [key, timer] of userDaemonTimers.entries()) {
      if (!userId || key.startsWith(`${userId}:`)) {
        clearTimeout(timer);
        userDaemonTimers.delete(key);
      }
    }
    if (currentActiveUserId === userId) {
      currentActiveUserId = null;
    }
    return { success: true };
  });

  ipcMain.handle('cancelAllReminders', () => {
    for (const timer of userDaemonTimers.values()) {
      clearTimeout(timer);
    }
    userDaemonTimers.clear();
    currentActiveUserId = null;
    return { success: true };
  });
}

// ========================================================
// 5. APPLICATION INITIALIZATION & POWER MONITOR
// ========================================================
// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
logToFile('[PauseFlow] Single instance lock acquired:', gotTheLock);

if (!gotTheLock) {
  logToFile('[PauseFlow] Another instance is already running. Quitting duplicate.');
  app.quit();
} else {
  app.on('second-instance', () => {
    logToFile('[PauseFlow] Second instance detected. Restoring/focusing main window.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });

  app.whenReady().then(() => {
    // 1. Explicitly remove the default Electron File/Edit/View/Window menu globally
    Menu.setApplicationMenu(null);

    logToFile('[PauseFlow] Application initialized');
    logToFile('[PauseFlow] Electron application menu disabled (Menu.setApplicationMenu(null))');
    logToFile('[PauseFlow] Clearing transient reminder state');
    logToFile('[PauseFlow] Recalculating schedule from Date.now()');

    createMainWindow();
    createSystemTray();
    setupIpcHandlers();
    scheduler.reschedule();
    logToFile('[PauseFlow] Scheduler initialized');
    logToFile('[PauseFlow] Ready');

    // Sleep/Wake listener
    powerMonitor.on('resume', () => {
      console.log('[Native Scheduler] System resumed from sleep. Rescheduling on device clock.');
      scheduler.reschedule();
    });

    powerMonitor.on('unlock-screen', () => {
      scheduler.reschedule();
    });
  });

  app.on('before-quit', () => {
    logToFile('[PauseFlow] App preparing to quit (before-quit)');
    app.isQuitting = true;
  });

  app.on('will-quit', () => {
    logToFile('[PauseFlow] App will quit. Cleaning up system tray and timers.');
    if (tray) {
      try {
        tray.destroy();
        tray = null;
      } catch (_) {}
    }
  });

  app.on('window-all-closed', () => {
    // Keep background daemon alive in system tray on Windows unless quitting
    if (!app.isQuitting) {
      logToFile('[PauseFlow] All windows closed. Background daemon remaining in system tray.');
    }
  });
}
