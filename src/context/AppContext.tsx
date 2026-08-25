import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type {
  WaterConfig,
  ScreenBreakConfig,
  GeneralSettings,
  NotificationSettings,
  PauseState,
  WaterReminderLog,
  ScreenBreakLog,
  UserAccount,
  ReminderStatus,
  RealReminderEvent,
  PreviewReminderEvent,
} from '../types';
import { storageEngine } from '../engine/storageEngine';
import { reminderEngine, type NextReminderInfo } from '../engine/reminderEngine';
import { notificationEngine } from '../engine/notificationEngine';
import { APP_CONFIG } from '../config/app.config';
import { detectPlatform } from '../platform/systemLifecycle';
import { backgroundScheduler } from '../platform/backgroundScheduler';
import type { ScheduledNotification } from '../platform/types';
import { LocalNotifications } from '@capacitor/local-notifications';

function getTodayString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

interface AppContextType {
  waterConfig: WaterConfig;
  setWaterConfig: (cfg: WaterConfig) => Promise<void>;
  screenBreakConfig: ScreenBreakConfig;
  setScreenBreakConfig: (cfg: ScreenBreakConfig) => Promise<void>;
  generalSettings: GeneralSettings;
  setGeneralSettings: (settings: GeneralSettings) => Promise<void>;
  notificationSettings: NotificationSettings;
  setNotificationSettings: (settings: NotificationSettings) => Promise<void>;

  pauseState: PauseState;
  setPauseDuration: (minutes: number | 'tomorrow' | null) => Promise<void>;

  waterLogs: WaterReminderLog[];
  nextWaterSlot: WaterReminderLog | null;
  waterCompletedCount: number;
  waterTotalCount: number;
  markWaterStatus: (id: string, status: ReminderStatus) => Promise<void>;

  screenLogs: ScreenBreakLog[];
  nextScreenSlot: ScreenBreakLog | null;
  screenCompletedCount: number;
  screenTotalCount: number;
  screenBreakMinutesCompleted: number;
  markScreenStatus: (id: string, status: ReminderStatus) => Promise<void>;

  nextOverallSlot: NextReminderInfo | null;

  userAccount: UserAccount;
  setUserAccount: (acc: UserAccount) => Promise<void>;

  onboardingCompleted: boolean;
  completeOnboarding: () => Promise<void>;

  activeTab: 'dashboard' | 'water' | 'screenbreak' | 'statistics' | 'settings' | 'showcase';
  setActiveTab: (tab: 'dashboard' | 'water' | 'screenbreak' | 'statistics' | 'settings' | 'showcase') => void;

  // Active Reminder State (Explicit distinction between REAL scheduled events and PREVIEW)
  realActiveReminder: RealReminderEvent | null;
  previewReminder: PreviewReminderEvent | null;

  // Modals Visibility (Transient UI state - NEVER restored across restarts)
  activeBreakModalOpen: boolean;
  activeWaterModalOpen: boolean;
  activePauseModalOpen: boolean;
  setActivePauseModalOpen: (open: boolean) => void;
  activeAuthModalOpen: boolean;
  setActiveAuthModalOpen: (open: boolean) => void;

  // Dedicated Entry Points
  startPreview: (category: 'water' | 'screen' | 'both', durationSec?: number) => void;
  finishPreview: (category: 'water' | 'screen' | 'both') => void;
  startRealReminder: (
    category: 'water' | 'screen' | 'both',
    slotId: string,
    durationSec: number,
    extraOpts?: {
      startTimestamp?: number;
      endTimestamp?: number;
      waterDurationSeconds?: number;
      screenDurationSeconds?: number;
      waterSlotId?: string;
      screenSlotId?: string;
      waterEndTimestamp?: number;
      screenEndTimestamp?: number;
    }
  ) => void;
  completeRealReminder: (category: 'water' | 'screen' | 'both', slotId: string) => Promise<void>;

  // Legacy wrappers mapped safely to prevent side effects
  openBreakModal: () => void;
  closeBreakModal: () => void;
  openWaterModal: () => void;
  closeWaterModal: () => void;

  triggerTestWaterNotification: () => void;
  triggerTestScreenNotification: () => void;
  trigger10SecRealTest: (category: 'water' | 'screen') => void;
  resetTodayData: () => Promise<void>;

  // Real-Time Diagnostic Clock State
  currentDeviceTimestamp: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [waterConfig, setWaterConfigState] = useState<WaterConfig>(APP_CONFIG.defaultWaterConfig);
  const [screenBreakConfig, setScreenBreakConfigState] = useState<ScreenBreakConfig>(
    APP_CONFIG.defaultScreenBreakConfig
  );
  const [generalSettings, setGeneralSettingsState] = useState<GeneralSettings>({
    startOnStartup: true,
    minimizeToTray: true,
    language: 'English',
    timeFormat: '12h',
    theme: 'system',
    localOnlyMode: false,
  });
  const [notificationSettings, setNotificationSettingsState] = useState<NotificationSettings>({
    enabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    previewMessage: true,
  });

  const [pauseState, setPauseState] = useState<PauseState>({
    isPaused: false,
    pauseUntil: null,
    pauseMinutes: null,
  });

  const [waterLogs, setWaterLogs] = useState<WaterReminderLog[]>([]);
  const [screenLogs, setScreenLogs] = useState<ScreenBreakLog[]>([]);
  const [userAccount, setUserAccountState] = useState<UserAccount>({ isLoggedIn: false });
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'water' | 'screenbreak' | 'statistics' | 'settings' | 'showcase'
  >('dashboard');

  // Real-Time Dynamic Timestamp State (Drives continuous reactive recalculation on device clock)
  const [currentDeviceTimestamp, setCurrentDeviceTimestamp] = useState<number>(Date.now());

  // Transient Runtime State (NEVER restored on process restart)
  const [realActiveReminder, setRealActiveReminder] = useState<RealReminderEvent | null>(null);
  const [previewReminder, setPreviewReminder] = useState<PreviewReminderEvent | null>(null);

  const [activeBreakModalOpen, setActiveBreakModalOpen] = useState(false);
  const [activeWaterModalOpen, setActiveWaterModalOpen] = useState(false);
  const [activePauseModalOpen, setActivePauseModalOpen] = useState(false);
  const [activeAuthModalOpen, setActiveAuthModalOpen] = useState(false);

  // References for zero-polling sleep timers (Web mode only)
  const waterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Reactive Real-Time Device Clock Pulse & Sleep/Wake Detection
  useEffect(() => {
    const handleTimeSync = () => {
      setCurrentDeviceTimestamp(Date.now());
    };

    // 1-second pulse for real-time reactive countdowns and second transitions
    const timer = setInterval(handleTimeSync, 1000);

    // Instant sync on window focus, visibility change, and device wake
    window.addEventListener('focus', handleTimeSync);
    window.addEventListener('visibilitychange', handleTimeSync);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleTimeSync);
      window.removeEventListener('visibilitychange', handleTimeSync);
    };
  }, []);

  // 2. Load storage & settings on boot (Configuration & History ONLY - No active modal restore)
  useEffect(() => {
    async function loadData() {
      const wConfig = await storageEngine.loadWaterConfig();
      const sConfig = await storageEngine.loadScreenBreakConfig();
      const gSettings = await storageEngine.loadGeneralSettings();
      const nSettings = await storageEngine.loadNotificationSettings();
      const pState = await storageEngine.loadPauseState();
      const uAccount = await storageEngine.loadUserAccount();
      const isOnboarded = await storageEngine.getOnboardingStatus();

      const todayStr = getTodayString();
      const todayWaterLogs = await storageEngine.loadDailyWaterLogs(todayStr);
      const todayScreenLogs = await storageEngine.loadDailyScreenLogs(todayStr);

      setWaterConfigState(wConfig);
      setScreenBreakConfigState(sConfig);
      setGeneralSettingsState(gSettings);
      setNotificationSettingsState(nSettings);
      setPauseState(pState);
      setUserAccountState(uAccount);
      setOnboardingCompleted(isOnboarded);

      setWaterLogs(todayWaterLogs);
      setScreenLogs(todayScreenLogs);

      // Clean transient state guarantee
      setRealActiveReminder(null);
      setPreviewReminder(null);
      setActiveWaterModalOpen(false);
      setActiveBreakModalOpen(false);

      notificationEngine.requestPermission();
    }

    loadData();
  }, []);

  // 3. Listen to Native Background Daemon Status Updates (Desktop Electron Environment)
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).eyeflowNative?.isDesktop) return;

    const cleanupStatus = (window as any).eyeflowNative.onStatusUpdated?.(() => {
      setCurrentDeviceTimestamp(Date.now());
    });

    return () => {
      if (cleanupStatus) cleanupStatus();
    };
  }, []);

  // 4. Theme synchronization
  useEffect(() => {
    const root = document.documentElement;
    if (generalSettings.theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (generalSettings.theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }, [generalSettings.theme]);

  // Unified Centralized Dynamic Real-Time Engine Calculation
  const scheduleResult = reminderEngine.calculateSchedule(
    waterConfig,
    screenBreakConfig,
    pauseState,
    waterLogs,
    screenLogs,
    new Date(currentDeviceTimestamp)
  );

  // Save Handlers
  const setWaterConfig = async (cfg: WaterConfig) => {
    setWaterConfigState(cfg);
    await storageEngine.saveWaterConfig(cfg);
    if ((window as any).eyeflowNative?.updateWaterConfig) {
      await (window as any).eyeflowNative.updateWaterConfig(cfg);
    }
  };

  const setScreenBreakConfig = async (cfg: ScreenBreakConfig) => {
    setScreenBreakConfigState(cfg);
    await storageEngine.saveScreenBreakConfig(cfg);
    if ((window as any).eyeflowNative?.updateScreenConfig) {
      await (window as any).eyeflowNative.updateScreenConfig(cfg);
    }
  };

  const setGeneralSettings = async (settings: GeneralSettings) => {
    setGeneralSettingsState(settings);
    await storageEngine.saveGeneralSettings(settings);
  };

  const setNotificationSettings = async (settings: NotificationSettings) => {
    setNotificationSettingsState(settings);
    await storageEngine.saveNotificationSettings(settings);
  };

  const setPauseDuration = async (minutes: number | 'tomorrow' | null) => {
    if (minutes === null) {
      const newState: PauseState = { isPaused: false, pauseUntil: null, pauseMinutes: null };
      setPauseState(newState);
      await storageEngine.savePauseState(newState);
      if ((window as any).eyeflowNative?.resumeReminders) {
        await (window as any).eyeflowNative.resumeReminders();
      }
      return;
    }

    const now = new Date();
    let untilDate: Date;

    if (minutes === 'tomorrow') {
      untilDate = new Date();
      untilDate.setDate(untilDate.getDate() + 1);
      untilDate.setHours(8, 0, 0, 0);
    } else {
      untilDate = new Date(now.getTime() + minutes * 60 * 1000);
    }

    const newState: PauseState = {
      isPaused: true,
      pauseUntil: untilDate.toISOString(),
      pauseMinutes: typeof minutes === 'number' ? minutes : 1440,
    };

    setPauseState(newState);
    await storageEngine.savePauseState(newState);
    if ((window as any).eyeflowNative?.pauseReminders) {
      await (window as any).eyeflowNative.pauseReminders(typeof minutes === 'number' ? minutes : 1440);
    }
  };

  // REAL Reminder Status Update
  const markWaterStatus = async (id: string, status: ReminderStatus) => {
    const todayStr = getTodayString();
    const existing = waterLogs.find((l) => l.id === id);
    let updated: WaterReminderLog[];

    if (existing) {
      updated = waterLogs.map((l) =>
        l.id === id ? { ...l, status, completedAt: new Date().toLocaleTimeString() } : l
      );
    } else {
      const slotTime = id.includes(':') ? id.split(':').pop() || '12:00' : id.replace('water-', '');
      updated = [
        ...waterLogs,
        {
          id,
          time: slotTime,
          scheduledTimestamp: Date.now(),
          status,
          completedAt: new Date().toLocaleTimeString(),
        },
      ];
    }

    setWaterLogs(updated);
    await storageEngine.saveDailyWaterLogs(todayStr, updated);
  };

  const markScreenStatus = async (id: string, status: ReminderStatus) => {
    const todayStr = getTodayString();
    const existing = screenLogs.find((l) => l.id === id);
    let updated: ScreenBreakLog[];

    if (existing) {
      updated = screenLogs.map((l) =>
        l.id === id ? { ...l, status, completedAt: new Date().toLocaleTimeString() } : l
      );
    } else {
      const slotTime = id.includes(':') ? id.split(':').pop() || '12:00' : id.replace('screen-', '');
      updated = [
        ...screenLogs,
        {
          id,
          time: slotTime,
          scheduledTimestamp: Date.now(),
          durationMinutes: screenBreakConfig.breakDurationMinutes,
          status,
          completedAt: new Date().toLocaleTimeString(),
        },
      ];
    }

    setScreenLogs(updated);
    await storageEngine.saveDailyScreenLogs(todayStr, updated);
  };

  // ========================================================
  // 1. PREVIEW LIFECYCLE (100% EPHEMERAL - ZERO SIDE EFFECTS)
  // ========================================================
  const startPreview = (category: 'water' | 'screen' | 'both', durationSec?: number) => {
    const duration =
      durationSec && durationSec > 0
        ? durationSec
        : category === 'water'
        ? (waterConfig.durationMinutes || 2) * 60
        : (screenBreakConfig.breakDurationMinutes || 5) * 60;

    // In Desktop Electron mode, open the dedicated native reminder window!
    if (typeof window !== 'undefined' && (window as any).eyeflowNative?.startPreview) {
      (window as any).eyeflowNative.startPreview(category === 'both' ? 'water' : category, duration);
      return;
    }

    // In Web/Mobile browser preview mode
    const now = Date.now();
    const event: PreviewReminderEvent = {
      type: 'PREVIEW',
      category,
      durationSeconds: duration,
      endTimestamp: now + duration * 1000,
      waterEndTimestamp: now + ((waterConfig.durationMinutes || 2) * 60 * 1000),
      screenEndTimestamp: now + ((screenBreakConfig.breakDurationMinutes || 5) * 60 * 1000),
    };

    setPreviewReminder(event);

    if (category === 'water') {
      setActiveWaterModalOpen(true);
    } else if (category === 'screen') {
      setActiveBreakModalOpen(true);
    } else {
      setActiveWaterModalOpen(true);
      setActiveBreakModalOpen(true);
    }
  };

  const finishPreview = (category: 'water' | 'screen' | 'both') => {
    setPreviewReminder(null);
    if (category === 'water') {
      setActiveWaterModalOpen(false);
    } else if (category === 'screen') {
      setActiveBreakModalOpen(false);
    } else {
      setActiveWaterModalOpen(false);
      setActiveBreakModalOpen(false);
    }
  };

  // ========================================================
  // 2. REAL REMINDER LIFECYCLE
  // ========================================================
  const startRealReminder = (
    category: 'water' | 'screen' | 'both',
    slotId: string,
    durationSec: number,
    extraOpts?: {
      startTimestamp?: number;
      endTimestamp?: number;
      waterDurationSeconds?: number;
      screenDurationSeconds?: number;
      waterSlotId?: string;
      screenSlotId?: string;
      waterEndTimestamp?: number;
      screenEndTimestamp?: number;
    }
  ) => {
    const now = Date.now();
    const startTimestamp = extraOpts?.startTimestamp || now;
    const endTimestamp = extraOpts?.endTimestamp || (now + durationSec * 1000);

    const event: RealReminderEvent = {
      type: 'REAL',
      category,
      slotId,
      waterSlotId: extraOpts?.waterSlotId,
      screenSlotId: extraOpts?.screenSlotId,
      durationSeconds: durationSec,
      waterDurationSeconds: extraOpts?.waterDurationSeconds,
      screenDurationSeconds: extraOpts?.screenDurationSeconds,
      startTimestamp,
      endTimestamp,
      waterEndTimestamp: extraOpts?.waterEndTimestamp,
      screenEndTimestamp: extraOpts?.screenEndTimestamp,
    };

    setRealActiveReminder(event);

    if (category === 'water') {
      setActiveWaterModalOpen(true);
    } else if (category === 'screen') {
      setActiveBreakModalOpen(true);
    } else {
      setActiveWaterModalOpen(true);
      setActiveBreakModalOpen(true);
    }
  };

  const completeRealReminder = async (category: 'water' | 'screen' | 'both', slotId: string) => {
    if (category === 'water') {
      await markWaterStatus(slotId, 'completed');
      setActiveWaterModalOpen(false);
    } else if (category === 'screen') {
      await markScreenStatus(slotId, 'completed');
      setActiveBreakModalOpen(false);
    } else {
      if (realActiveReminder?.waterSlotId) {
        await markWaterStatus(realActiveReminder.waterSlotId, 'completed');
      }
      if (realActiveReminder?.screenSlotId) {
        await markScreenStatus(realActiveReminder.screenSlotId, 'completed');
      }
      setActiveWaterModalOpen(false);
      setActiveBreakModalOpen(false);
    }
    setRealActiveReminder(null);

    if ((window as any).eyeflowNative?.completeReminder) {
      await (window as any).eyeflowNative.completeReminder(category === 'both' ? 'water' : category, slotId);
    }
  };

  // Reset corrupted development data
  const resetTodayData = async () => {
    const todayStr = getTodayString();
    setWaterLogs([]);
    setScreenLogs([]);
    await storageEngine.saveDailyWaterLogs(todayStr, []);
    await storageEngine.saveDailyScreenLogs(todayStr, []);
    reminderEngine.clearFiredHistory();
    if ((window as any).eyeflowNative?.resetTodayData) {
      await (window as any).eyeflowNative.resetTodayData();
    }
  };

  // Legacy wrappers mapped safely to Preview
  const openBreakModal = () => startPreview('screen');
  const closeBreakModal = () => finishPreview('screen');
  const openWaterModal = () => startPreview('water');
  const closeWaterModal = () => finishPreview('water');

  // Test Notifications (Sends native/web notification only, zero state modification)
  const triggerTestWaterNotification = () => {
    notificationEngine.sendWaterNotification();
  };

  const triggerTestScreenNotification = () => {
    notificationEngine.sendScreenBreakNotification();
  };

  // Real Test Reminder Trigger in 10s (Fires real notification, opens real modal, records in real history)
  const trigger10SecRealTest = (category: 'water' | 'screen') => {
    const testSlotId = `test:${category}:${Date.now()}`;

    setTimeout(() => {
      if (category === 'water') {
        notificationEngine.sendWaterNotification();
        startRealReminder('water', testSlotId, 10);
      } else {
        notificationEngine.sendScreenBreakNotification();
        startRealReminder('screen', testSlotId, 10);
      }
    }, 10000);
  };

  const setUserAccount = async (acc: UserAccount) => {
    setUserAccountState(acc);
    await storageEngine.saveUserAccount(acc);
  };

  const completeOnboarding = async () => {
    setOnboardingCompleted(true);
    await storageEngine.setOnboardingStatus(true);
  };

  // ZERO-POLLING DYNAMIC TIMER SCHEDULER (WEB ONLY)
  // When running on Desktop, Electron owns the background daemon.
  // When running on Android, AlarmManager owns the background scheduler.
  useEffect(() => {
    if (waterTimerRef.current) clearTimeout(waterTimerRef.current);
    if (screenTimerRef.current) clearTimeout(screenTimerRef.current);

    const platform = detectPlatform();
    // Do NOT run web timers on Windows Desktop (Electron) or Android (Native AlarmManager)
    if (platform === 'windows' || platform === 'android') {
      return;
    }

    if (!notificationSettings.enabled) return;

    // Schedule Water Reminder (strictly future occurrences)
    if (waterConfig.enabled && scheduleResult.nextWaterSlot) {
      const waterSlot = scheduleResult.nextWaterSlot;
      if (!reminderEngine.hasFired(waterSlot.id)) {
        const timer = reminderEngine.scheduleTimer(waterSlot.scheduledTimestamp, () => {
          reminderEngine.markFired(waterSlot.id);
          notificationEngine.sendWaterNotification();
          const duration = (waterConfig.durationMinutes || 2) * 60;
          startRealReminder('water', waterSlot.id, duration);
        });
        if (timer) waterTimerRef.current = timer;
      }
    }

    // Schedule Screen Break Reminder (strictly future occurrences)
    if (screenBreakConfig.enabled && scheduleResult.nextScreenSlot) {
      const screenSlot = scheduleResult.nextScreenSlot;
      if (!reminderEngine.hasFired(screenSlot.id)) {
        const timer = reminderEngine.scheduleTimer(screenSlot.scheduledTimestamp, () => {
          reminderEngine.markFired(screenSlot.id);
          notificationEngine.sendScreenBreakNotification();
          const duration = (screenBreakConfig.breakDurationMinutes || 5) * 60;
          startRealReminder('screen', screenSlot.id, duration);
        });
        if (timer) screenTimerRef.current = timer;
      }
    }

    return () => {
      if (waterTimerRef.current) clearTimeout(waterTimerRef.current);
      if (screenTimerRef.current) clearTimeout(screenTimerRef.current);
    };
  }, [
    scheduleResult.nextWaterSlot?.id,
    scheduleResult.nextScreenSlot?.id,
    waterConfig.enabled,
    screenBreakConfig.enabled,
    notificationSettings.enabled,
  ]);

  // 5. Native Mobile Lifecycle Listener (Resync on app resume / return from Android Settings)
  useEffect(() => {
    let appStateListener: any = null;
    const platform = detectPlatform();
    if (platform === 'android') {
      import('@capacitor/app').then(({ App: CapApp }) => {
        CapApp.addListener('appStateChange', (state) => {
          if (state.isActive) {
            console.log('[AppContext] App returned to foreground. Syncing device timestamp...');
            setCurrentDeviceTimestamp(Date.now());
          }
        }).then((listener) => {
          appStateListener = listener;
        });
      });
    }

    return () => {
      if (appStateListener?.remove) {
        appStateListener.remove();
      }
    };
  }, []);

  // 6. Capacitor Mobile Background Scheduling (Android)
  useEffect(() => {
    const platform = detectPlatform();
    if (platform !== 'android') return;

    if (pauseState.isPaused || !notificationSettings.enabled) {
      backgroundScheduler.cancelAllNotifications();
      return;
    }

    const scheduledList: ScheduledNotification[] = [];
    const now = Date.now();

    if (waterConfig.enabled && scheduleResult.waterSlots) {
      for (const slot of scheduleResult.waterSlots) {
        if (slot.status === 'pending' && slot.scheduledTimestamp > now + 2000) {
          scheduledList.push({
            id: slot.id,
            title: '💧 Time for water',
            body: 'Take a 2-minute water break.',
            category: 'water',
            scheduledTimestamp: slot.scheduledTimestamp,
            durationSeconds: (waterConfig.durationMinutes || 2) * 60,
          });
        }
      }
    }

    if (screenBreakConfig.enabled && scheduleResult.screenSlots) {
      for (const slot of scheduleResult.screenSlots) {
        if (slot.status === 'pending' && slot.scheduledTimestamp > now + 2000) {
          scheduledList.push({
            id: slot.id,
            title: '👁 Look outside',
            body: 'Give your eyes a short break from the screen.',
            category: 'screen',
            scheduledTimestamp: slot.scheduledTimestamp,
            durationSeconds: (screenBreakConfig.breakDurationMinutes || 5) * 60,
          });
        }
      }
    }

    backgroundScheduler.scheduleLocalNotifications(scheduledList);
  }, [
    scheduleResult.nextWaterSlot?.id,
    scheduleResult.nextScreenSlot?.id,
    waterConfig,
    screenBreakConfig,
    pauseState,
    notificationSettings.enabled,
    currentDeviceTimestamp,
  ]);

  // 7. Capacitor Mobile Notification Tap Listener (Deep Link into Break Screen)
  useEffect(() => {
    let actionListener: any = null;

    async function setupMobileListener() {
      const platform = detectPlatform();
      if (platform !== 'android') return;

      try {
        actionListener = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (action) => {
            const extra = action.notification.extra;
            if (extra?.category) {
              const category = extra.category as 'water' | 'screen' | 'both';
              const now = Date.now();
              const startTs = extra.startTimestamp || now;
              const defaultDuration =
                category === 'water'
                  ? (waterConfig.durationMinutes || 2) * 60
                  : category === 'screen'
                  ? (screenBreakConfig.breakDurationMinutes || 5) * 60
                  : Math.max((waterConfig.durationMinutes || 2) * 60, (screenBreakConfig.breakDurationMinutes || 5) * 60);

              const endTs = extra.endTimestamp || startTs + (extra.durationSeconds || defaultDuration) * 1000;

              // STALE NOTIFICATION CHECK
              if (now >= endTs) {
                console.log('[AppContext] Notification tapped after expiration window. Marking completed without opening stale timer.');
                if (category === 'water' && extra.slotId) {
                  markWaterStatus(extra.slotId, 'completed');
                } else if (category === 'screen' && extra.slotId) {
                  markScreenStatus(extra.slotId, 'completed');
                } else if (category === 'both') {
                  if (extra.waterSlotId) markWaterStatus(extra.waterSlotId, 'completed');
                  if (extra.screenSlotId) markScreenStatus(extra.screenSlotId, 'completed');
                }
                return;
              }

              // ACTIVE COUNTDOWN WINDOW (Continuously calculated from actual timestamps)
              const remainingSecs = Math.max(1, Math.floor((endTs - now) / 1000));
              startRealReminder(
                category,
                extra.slotId || `notif-${now}`,
                remainingSecs,
                {
                  startTimestamp: startTs,
                  endTimestamp: endTs,
                  waterDurationSeconds: extra.waterDurationSeconds || (waterConfig.durationMinutes || 2) * 60,
                  screenDurationSeconds: extra.screenDurationSeconds || (screenBreakConfig.breakDurationMinutes || 5) * 60,
                  waterSlotId: extra.waterSlotId,
                  screenSlotId: extra.screenSlotId,
                  waterEndTimestamp: extra.waterDurationSeconds ? startTs + extra.waterDurationSeconds * 1000 : endTs,
                  screenEndTimestamp: extra.screenDurationSeconds ? startTs + extra.screenDurationSeconds * 1000 : endTs,
                }
              );
            }
          }
        );
      } catch (err) {
        console.warn('Could not register notification action listener:', err);
      }
    }

    setupMobileListener();

    return () => {
      if (actionListener?.remove) {
        actionListener.remove();
      }
    };
  }, [waterConfig.durationMinutes, screenBreakConfig.breakDurationMinutes]);

  return (
    <AppContext.Provider
      value={{
        waterConfig,
        setWaterConfig,
        screenBreakConfig,
        setScreenBreakConfig,
        generalSettings,
        setGeneralSettings,
        notificationSettings,
        setNotificationSettings,

        pauseState,
        setPauseDuration,

        waterLogs: scheduleResult.waterSlots,
        nextWaterSlot: scheduleResult.nextWaterSlot,
        waterCompletedCount: scheduleResult.waterCompletedCount,
        waterTotalCount: scheduleResult.waterTotalCount,
        markWaterStatus,

        screenLogs: scheduleResult.screenSlots,
        nextScreenSlot: scheduleResult.nextScreenSlot,
        screenCompletedCount: scheduleResult.screenCompletedCount,
        screenTotalCount: scheduleResult.screenTotalCount,
        screenBreakMinutesCompleted: scheduleResult.screenBreakMinutesCompleted,
        markScreenStatus,

        nextOverallSlot: scheduleResult.nextOverallSlot,

        userAccount,
        setUserAccount,

        onboardingCompleted,
        completeOnboarding,

        activeTab,
        setActiveTab,

        realActiveReminder,
        previewReminder,

        activeBreakModalOpen,
        activeWaterModalOpen,
        activePauseModalOpen,
        setActivePauseModalOpen,
        activeAuthModalOpen,
        setActiveAuthModalOpen,

        startPreview,
        finishPreview,
        startRealReminder,
        completeRealReminder,

        openBreakModal,
        closeBreakModal,
        openWaterModal,
        closeWaterModal,

        triggerTestWaterNotification,
        triggerTestScreenNotification,
        trigger10SecRealTest,
        resetTodayData,

        currentDeviceTimestamp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
