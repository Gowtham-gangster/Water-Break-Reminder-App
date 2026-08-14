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

  // Modals Visibility
  activeBreakModalOpen: boolean;
  activeWaterModalOpen: boolean;
  activePauseModalOpen: boolean;
  setActivePauseModalOpen: (open: boolean) => void;
  activeAuthModalOpen: boolean;
  setActiveAuthModalOpen: (open: boolean) => void;

  // Dedicated Entry Points
  startPreview: (category: 'water' | 'screen', durationSec?: number) => void;
  finishPreview: (category: 'water' | 'screen') => void;
  startRealReminder: (category: 'water' | 'screen', slotId: string, durationSec: number) => void;
  completeRealReminder: (category: 'water' | 'screen', slotId: string) => Promise<void>;

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

  // Explicit Separate State for Real vs. Preview Reminders
  const [realActiveReminder, setRealActiveReminder] = useState<RealReminderEvent | null>(null);
  const [previewReminder, setPreviewReminder] = useState<PreviewReminderEvent | null>(null);

  const [activeBreakModalOpen, setActiveBreakModalOpen] = useState(false);
  const [activeWaterModalOpen, setActiveWaterModalOpen] = useState(false);
  const [activePauseModalOpen, setActivePauseModalOpen] = useState(false);
  const [activeAuthModalOpen, setActiveAuthModalOpen] = useState(false);

  // References for zero-polling sleep timers
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

  // Load storage & settings on boot
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

      notificationEngine.requestPermission();
    }

    loadData();
  }, []);

  // Theme synchronization
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
  };

  const setScreenBreakConfig = async (cfg: ScreenBreakConfig) => {
    setScreenBreakConfigState(cfg);
    await storageEngine.saveScreenBreakConfig(cfg);
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
      const slotTime = id.includes('-water-') ? id.split('-water-')[1] : id.replace('water-', '');
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
      const slotTime = id.includes('-screen-') ? id.split('-screen-')[1] : id.replace('screen-', '');
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
  const startPreview = (category: 'water' | 'screen', durationSec?: number) => {
    const duration =
      durationSec && durationSec > 0
        ? durationSec
        : category === 'water'
        ? (waterConfig.durationMinutes || 2) * 60
        : (screenBreakConfig.breakDurationMinutes || 5) * 60;

    const event: PreviewReminderEvent = {
      type: 'PREVIEW',
      category,
      durationSeconds: duration,
      endTimestamp: Date.now() + duration * 1000,
    };

    setPreviewReminder(event);

    if (category === 'water') {
      setActiveWaterModalOpen(true);
    } else {
      setActiveBreakModalOpen(true);
    }
  };

  const finishPreview = (category: 'water' | 'screen') => {
    setPreviewReminder(null);
    if (category === 'water') {
      setActiveWaterModalOpen(false);
    } else {
      setActiveBreakModalOpen(false);
    }
  };

  // ========================================================
  // 2. REAL REMINDER LIFECYCLE (PERSISTS HISTORY & STATS)
  // ========================================================
  const startRealReminder = (
    category: 'water' | 'screen',
    slotId: string,
    durationSec: number
  ) => {
    const event: RealReminderEvent = {
      type: 'REAL',
      category,
      slotId,
      durationSeconds: durationSec,
      endTimestamp: Date.now() + durationSec * 1000,
    };

    setRealActiveReminder(event);

    if (category === 'water') {
      setActiveWaterModalOpen(true);
    } else {
      setActiveBreakModalOpen(true);
    }
  };

  const completeRealReminder = async (category: 'water' | 'screen', slotId: string) => {
    if (category === 'water') {
      await markWaterStatus(slotId, 'completed');
      setActiveWaterModalOpen(false);
    } else {
      await markScreenStatus(slotId, 'completed');
      setActiveBreakModalOpen(false);
    }
    setRealActiveReminder(null);
  };

  // Reset corrupted development data
  const resetTodayData = async () => {
    const todayStr = getTodayString();
    setWaterLogs([]);
    setScreenLogs([]);
    await storageEngine.saveDailyWaterLogs(todayStr, []);
    await storageEngine.saveDailyScreenLogs(todayStr, []);
    reminderEngine.clearFiredHistory();
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
    const testSlotId = `test-${category}-${Date.now()}`;

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

  // ZERO-POLLING DYNAMIC TIMER SCHEDULER
  // Schedules a single setTimeout for the exact next reminder timestamp. Zero CPU while idle!
  useEffect(() => {
    if (waterTimerRef.current) clearTimeout(waterTimerRef.current);
    if (screenTimerRef.current) clearTimeout(screenTimerRef.current);

    if (!notificationSettings.enabled) return;

    // Schedule Water Reminder
    if (waterConfig.enabled && scheduleResult.nextWaterSlot) {
      const waterSlot = scheduleResult.nextWaterSlot;
      if (!reminderEngine.hasFired(waterSlot.id)) {
        waterTimerRef.current = reminderEngine.scheduleTimer(
          waterSlot.scheduledTimestamp,
          () => {
            reminderEngine.markFired(waterSlot.id);
            notificationEngine.sendWaterNotification();
            const duration = (waterConfig.durationMinutes || 2) * 60;
            startRealReminder('water', waterSlot.id, duration);
          }
        );
      }
    }

    // Schedule Screen Break Reminder
    if (screenBreakConfig.enabled && scheduleResult.nextScreenSlot) {
      const screenSlot = scheduleResult.nextScreenSlot;
      if (!reminderEngine.hasFired(screenSlot.id)) {
        screenTimerRef.current = reminderEngine.scheduleTimer(
          screenSlot.scheduledTimestamp,
          () => {
            reminderEngine.markFired(screenSlot.id);
            notificationEngine.sendScreenBreakNotification();
            const duration = (screenBreakConfig.breakDurationMinutes || 5) * 60;
            startRealReminder('screen', screenSlot.id, duration);
          }
        );
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
