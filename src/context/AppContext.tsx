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
import { androidScheduler, PauseFlowNative } from '../platform/androidScheduler';
import { LocalNotifications } from '@capacitor/local-notifications';

import { authService, type UserProfile } from '../services/authService';
import { settingsService } from '../services/settingsService';
import { reminderService, getLocalDateString } from '../services/reminderService';
import { waterConfigService } from '../services/waterConfigService';
import { lookOutsideConfigService } from '../services/lookOutsideConfigService';
import { profileService } from '../services/profileService';
import { profileAvatarService } from '../services/profileAvatarService';
import { realtimeSyncService } from '../services/realtimeSyncService';
import { syncService } from '../services/syncService';
import { pauseService } from '../services/pauseService.ts';
import { performanceDiagnostics } from '../services/performanceDiagnostics';

const getDesktopBridge = () =>
  typeof window !== 'undefined'
    ? ((window as any).pauseflowNative || (window as any).eyeflowNative)
    : undefined;

function getTodayString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export type AuthStateType = 'checking' | 'authenticated' | 'unauthenticated';

interface AppContextType {
  authState: AuthStateType;
  currentUser: UserProfile | null;
  loginUser: (user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;

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

  activeTab: 'dashboard' | 'water' | 'screenbreak' | 'statistics' | 'settings' | 'profile';
  setActiveTab: (tab: 'dashboard' | 'water' | 'screenbreak' | 'statistics' | 'settings' | 'profile') => void;

  // Active Reminder State (Explicit distinction between REAL scheduled events and PREVIEW)
  realActiveReminder: RealReminderEvent | null;
  previewReminder: PreviewReminderEvent | null;

  // Modals Visibility (Transient UI state - NEVER restored across restarts)
  activeBreakModalOpen: boolean;
  activeWaterModalOpen: boolean;
  activePauseModalOpen: boolean;
  setActivePauseModalOpen: (open: boolean) => void;

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
  skipRealReminder: (category: 'water' | 'screen' | 'both', slotId: string) => Promise<void>;

  // Legacy wrappers mapped safely to prevent side effects
  openBreakModal: () => void;
  closeBreakModal: () => void;
  openWaterModal: () => void;
  closeWaterModal: () => void;

  resetTodayData: () => Promise<void>;

  // Real-Time Diagnostic Clock State
  currentDeviceTimestamp: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthStateType>('checking');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

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
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    localOnlyMode: false,
  });
  const [notificationSettings, setNotificationSettingsState] = useState<NotificationSettings>({
    enabled: true,
    soundEnabled: true,
    waterSound: 'water',
    lookOutsideSound: 'bell',
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
    'dashboard' | 'water' | 'screenbreak' | 'statistics' | 'settings' | 'profile'
  >('dashboard');

  // Real-Time Dynamic Timestamp State (Drives continuous reactive recalculation on device clock)
  const [currentDeviceTimestamp, setCurrentDeviceTimestamp] = useState<number>(Date.now());

  // Transient Runtime State (NEVER restored on process restart)
  const [realActiveReminder, setRealActiveReminder] = useState<RealReminderEvent | null>(null);
  const [previewReminder, setPreviewReminder] = useState<PreviewReminderEvent | null>(null);
  // Modals Visibility State
  const [activeBreakModalOpen, setActiveBreakModalOpen] = useState(false);
  const [activeWaterModalOpen, setActiveWaterModalOpen] = useState(false);
  const [activePauseModalOpen, setActivePauseModalOpen] = useState(false);

  // References for zero-polling sleep timers (Web mode only)
  const waterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to load all user-scoped configurations immediately from local storage
  const loadUserScopedData = async (user: UserProfile) => {
    const userId = user.id;
    const cacheStart = performance.now();

    // 0. Reconcile any native delivered reminders from when app was killed/backgrounded
    const initialTz = user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    try {
      await androidScheduler.reconcileDeliveredReminders(userId, user.created_at, initialTz);
    } catch (rErr) {
      console.warn('[AppContext] Startup native reconciliation warning:', rErr);
    }

    // 1. Instant local cache load
    const wConfig = await storageEngine.loadWaterConfig(userId);
    const sConfig = await storageEngine.loadScreenBreakConfig(userId);
    const gSettings = await storageEngine.loadGeneralSettings(userId);
    const nSettings = await storageEngine.loadNotificationSettings(userId);
    const pStateRaw = await pauseService.getPauseState(userId);
    const pState = pauseService.mapToPauseState(pStateRaw, Date.now());
    const isOnboarded = await storageEngine.getOnboardingStatus(userId);

    // Use profile timezone if general settings timezone not set
    if (user.timezone && !gSettings.timezone) {
      gSettings.timezone = user.timezone;
    }

    const userTz = gSettings.timezone || user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

    // Authoritative today's logs mapped directly from reminderService (prevents duplicate counting)
    const todayWaterLogs: WaterReminderLog[] = [];
    const todayScreenLogs: ScreenBreakLog[] = [];

    try {
      const todayEvents = await reminderService.getTodayEvents(userId, userTz);
      for (const ev of todayEvents) {
        if (ev.status === 'completed') {
          const evDate = new Date(ev.scheduled_at || ev.completed_at || ev.created_at || Date.now());
          const dateStr = getLocalDateString(evDate, userTz);
          
          let timeStr = '';
          try {
            const timeFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: userTz,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const parts = timeFormatter.formatToParts(evDate);
            const hour = parts.find((p) => p.type === 'hour')?.value || '00';
            const minute = parts.find((p) => p.type === 'minute')?.value || '00';
            timeStr = `${hour}:${minute}`;
          } catch (_) {
            timeStr = `${String(evDate.getHours()).padStart(2, '0')}:${String(evDate.getMinutes()).padStart(2, '0')}`;
          }

          if (ev.type === 'water') {
            const slotId = reminderEngine.generateSlotId('water', dateStr, timeStr);
            if (!todayWaterLogs.some((l) => l.id === slotId || l.id === ev.id || l.time === timeStr)) {
              todayWaterLogs.push({
                id: slotId,
                time: timeStr,
                scheduledTimestamp: evDate.getTime(),
                status: 'completed',
                completedAt: new Date(ev.completed_at || evDate).toISOString(),
              });
            }
          } else if (ev.type === 'look_outside' || (ev.type as any) === 'screen') {
            const slotId = reminderEngine.generateSlotId('screen', dateStr, timeStr);
            if (!todayScreenLogs.some((l) => l.id === slotId || l.id === ev.id || l.time === timeStr)) {
              todayScreenLogs.push({
                id: slotId,
                time: timeStr,
                scheduledTimestamp: evDate.getTime(),
                durationMinutes: sConfig.breakDurationMinutes || 5,
                status: 'completed',
                completedAt: new Date(ev.completed_at || evDate).toISOString(),
              });
            }
          }
        }
      }
      console.log(`[PauseFlow][TRACE] stage=PROGRESS_CALCULATED waterCompleted=${todayWaterLogs.length} screenCompleted=${todayScreenLogs.length}`);
    } catch (err) {
      console.warn('[AppContext] Could not restore today events from reminderService:', err);
    }

    // 2. Update React State immediately (Instant 0ms-ish Local UI Render)
    setWaterConfigState(wConfig);
    setScreenBreakConfigState(sConfig);
    setGeneralSettingsState(gSettings);
    setNotificationSettingsState(nSettings);
    setPauseState(pState);
    setOnboardingCompleted(isOnboarded);
    setWaterLogs(todayWaterLogs);
    setScreenLogs(todayScreenLogs);
    performanceDiagnostics.markStartupLocalCache(performance.now() - cacheStart);

    setUserAccountState({
      id: user.id,
      name: user.display_name,
      email: user.email,
      isLoggedIn: true,
      lastSyncedAt: new Date().toLocaleTimeString(),
    });

    // 3. Asynchronous background cross-device cloud synchronization
    (async () => {
      try {
        const syncResult = await syncService.syncUserAccount(userId);
        if (syncResult && syncResult.success) {
          // Reconcile Water Configuration from Cloud
          if (syncResult.waterConfig) {
            const mappedWater: WaterConfig = {
              enabled: syncResult.waterConfig.enabled,
              startTime: syncResult.waterConfig.start_time?.slice(0, 5) || '08:00',
              endTime: syncResult.waterConfig.end_time?.slice(0, 5) || '22:00',
              intervalMinutes: syncResult.waterConfig.interval_minutes,
              durationMinutes: Math.round(syncResult.waterConfig.duration_seconds / 60) || 2,
              sound: 'water',
              activeDays: syncResult.waterConfig.active_days || [0, 1, 2, 3, 4, 5, 6],
              quietHoursEnabled: false,
              quietStartTime: '13:00',
              quietEndTime: '14:00',
              reminderStyle: 'popup',
            };
            setWaterConfigState(mappedWater);
            await storageEngine.saveWaterConfig(mappedWater, userId);
            const desktopBridge = getDesktopBridge();
            if (desktopBridge?.updateWaterConfig) {
              await desktopBridge.updateWaterConfig(mappedWater);
            }
          } else if (wConfig) {
            // Upload local Water config to cloud as initial source of truth
            await waterConfigService.updateWaterConfig(userId, {
              enabled: wConfig.enabled,
              interval_minutes: wConfig.intervalMinutes,
              start_time: wConfig.startTime ? (wConfig.startTime.length === 5 ? `${wConfig.startTime}:00` : wConfig.startTime) : '08:00:00',
              end_time: wConfig.endTime ? (wConfig.endTime.length === 5 ? `${wConfig.endTime}:00` : wConfig.endTime) : '22:00:00',
              duration_seconds: (wConfig.durationMinutes || 2) * 60,
              active_days: wConfig.activeDays || [0, 1, 2, 3, 4, 5, 6],
            });
          }

          // Reconcile Look Outside Configuration from Cloud
          if (syncResult.lookOutsideConfig) {
            const mappedScreen: ScreenBreakConfig = {
              enabled: syncResult.lookOutsideConfig.enabled,
              startTime: syncResult.lookOutsideConfig.start_time?.slice(0, 5) || '09:00',
              endTime: syncResult.lookOutsideConfig.end_time?.slice(0, 5) || '22:00',
              screenIntervalMinutes: syncResult.lookOutsideConfig.interval_minutes,
              breakDurationMinutes: Math.round(syncResult.lookOutsideConfig.duration_seconds / 60) || 5,
              sound: 'bell',
              activeDays: syncResult.lookOutsideConfig.active_days || [0, 1, 2, 3, 4, 5, 6],
              reminderStyle: 'fullscreen',
            };
            setScreenBreakConfigState(mappedScreen);
            await storageEngine.saveScreenBreakConfig(mappedScreen, userId);
            const desktopBridge = getDesktopBridge();
            if (desktopBridge?.updateScreenConfig) {
              await desktopBridge.updateScreenConfig(mappedScreen);
            }
          } else if (sConfig) {
            // Upload local Look Outside config to cloud as initial source of truth
            await lookOutsideConfigService.updateLookOutsideConfig(userId, {
              enabled: sConfig.enabled,
              interval_minutes: sConfig.screenIntervalMinutes,
              start_time: sConfig.startTime ? (sConfig.startTime.length === 5 ? `${sConfig.startTime}:00` : sConfig.startTime) : '09:00:00',
              end_time: sConfig.endTime ? (sConfig.endTime.length === 5 ? `${sConfig.endTime}:00` : sConfig.endTime) : '22:00:00',
              duration_seconds: (sConfig.breakDurationMinutes || 5) * 60,
              active_days: sConfig.activeDays || [0, 1, 2, 3, 4, 5, 6],
            });
          }

          // Reconcile User Settings from Cloud
          if (syncResult.settings) {
            const cloud = syncResult.settings;
            if (cloud.theme) setGeneralSettingsState((prev) => ({ ...prev, theme: cloud.theme }));
            if (cloud.time_format) setGeneralSettingsState((prev) => ({ ...prev, timeFormat: cloud.time_format }));
            if (cloud.notifications_enabled !== undefined) setNotificationSettingsState((prev) => ({ ...prev, enabled: cloud.notifications_enabled }));
            if (cloud.sound_enabled !== undefined) setNotificationSettingsState((prev) => ({ ...prev, soundEnabled: cloud.sound_enabled }));
          } else if (gSettings) {
            await settingsService.updateSettings(userId, {
              theme: gSettings.theme,
              time_format: gSettings.timeFormat,
              sound_enabled: nSettings.soundEnabled,
              notifications_enabled: nSettings.enabled,
            });
          }

          // Reconcile Profile (Avatar, Display Name, Timezone)
          if (syncResult.profile) {
            let authoritativeAvatarUrl = syncResult.profile.avatar_url;

            // Handle legacy base64 avatar auto-migration to Supabase Storage
            if (authoritativeAvatarUrl && authoritativeAvatarUrl.startsWith('data:image/')) {
              try {
                const migratedUrl = await profileAvatarService.migrateLegacyBase64Avatar(
                  userId,
                  authoritativeAvatarUrl
                );
                if (migratedUrl) {
                  authoritativeAvatarUrl = migratedUrl;
                }
              } catch (migErr) {
                console.warn('[AppContext] Legacy avatar migration skipped:', migErr);
              }
            }

            if (syncResult.profile.timezone) {
              setGeneralSettingsState((prev) => ({ ...prev, timezone: syncResult.profile!.timezone }));
            }

            setCurrentUser((prev) => {
              if (!prev || prev.id !== userId) return prev;
              return {
                ...prev,
                display_name: syncResult.profile!.display_name || prev.display_name,
                avatar_url: authoritativeAvatarUrl ?? null,
                timezone: syncResult.profile!.timezone || prev.timezone,
              };
            });

            setUserAccountState((prev) => ({
              ...prev,
              name: syncResult.profile!.display_name || prev.name,
            }));

            await storageEngine.saveProfile(
              {
                id: userId,
                display_name: syncResult.profile.display_name,
                avatar_url: authoritativeAvatarUrl,
                timezone: syncResult.profile.timezone || gSettings.timezone,
              },
              userId
            );
          }

          // Reconcile Pause State from Cloud
          if (syncResult.pauseState) {
            const mappedPause = pauseService.mapToPauseState(syncResult.pauseState, Date.now());
            setPauseState(mappedPause);
            await storageEngine.savePauseState(mappedPause, userId);
            if (mappedPause.isPaused) {
              backgroundScheduler.pause(mappedPause.pauseMinutes || 1440);
            } else {
              backgroundScheduler.resume();
            }
          }
        }
      } catch (e) {
        console.warn('[AppContext] Background cloud sync skipped/offline:', e);
      }
    })();
  };

  const loginUser = async (user: UserProfile) => {
    setCurrentUser(user);
    await loadUserScopedData(user);
    setAuthState('authenticated');
  };

  // COMPLETE 6-STEP LOGOUT PIPELINE
  const logout = async () => {
    // 1. Cancel current user's local reminders & Realtime subscription
    try {
      realtimeSyncService.unsubscribe();
      await backgroundScheduler.cancelAllNotifications();
      const desktopBridge = getDesktopBridge();
      if (desktopBridge?.resumeReminders) {
        await desktopBridge.resumeReminders();
      }
    } catch (e) {
      console.warn('[Logout] Error cancelling local notifications:', e);
    }

    // 2. Stop current user's active timers
    if (waterTimerRef.current) clearTimeout(waterTimerRef.current);
    if (screenTimerRef.current) clearTimeout(screenTimerRef.current);
    reminderEngine.clearFiredHistory();

    // 3. Clear user-specific transient state
    setRealActiveReminder(null);
    setPreviewReminder(null);
    setActiveBreakModalOpen(false);
    setActiveWaterModalOpen(false);
    setActivePauseModalOpen(false);
    setWaterLogs([]);
    setScreenLogs([]);

    // 4. Clear cached user configuration & reset state to defaults
    const currentUserId = currentUser?.id;
    if (currentUserId) {
      await storageEngine.clearUserData(currentUserId);
      reminderService.clearUserCache(currentUserId);
    }
    reminderService.clearAllMemoryCache();
    setWaterConfigState(APP_CONFIG.defaultWaterConfig);
    setScreenBreakConfigState(APP_CONFIG.defaultScreenBreakConfig);
    setGeneralSettingsState({
      startOnStartup: true,
      minimizeToTray: true,
      language: 'English',
      timeFormat: '12h',
      theme: 'system',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      localOnlyMode: false,
    });
    setNotificationSettingsState({
      enabled: true,
      soundEnabled: true,
      waterSound: 'water',
      lookOutsideSound: 'bell',
      vibrationEnabled: true,
      previewMessage: true,
    });
    setPauseState({
      isPaused: false,
      pauseUntil: null,
      pauseMinutes: null,
    });

    // 5. Invalidate session & cancel native user notifications
    const oldUserId = currentUser?.id;
    if (oldUserId) {
      backgroundScheduler.cancelUserSchedule(oldUserId);
    } else {
      backgroundScheduler.cancelAllNotifications();
    }
    await authService.signOut(oldUserId);
    setCurrentUser(null);
    setUserAccountState({ isLoggedIn: false });

    // 6. Return to Login
    setAuthState('unauthenticated');
  };

  // 1. Reactive Real-Time Device Clock Pulse & Sleep/Wake Detection + App Resume Cloud Sync
  useEffect(() => {
    const handleTimeSync = () => {
      const now = Date.now();
      setCurrentDeviceTimestamp(now);

      // Check if pause duration has expired
      setPauseState((prev) => {
        if (prev.isPaused && prev.pauseUntil) {
          const untilMs = new Date(prev.pauseUntil).getTime();
          if (!isNaN(untilMs) && now >= untilMs) {
            console.log('[AppContext] Pause duration elapsed. Automatically resuming reminders...');
            const cleared: PauseState = { isPaused: false, pauseUntil: null, pauseMinutes: null, userId: prev.userId };
            if (prev.userId) {
              storageEngine.savePauseState(cleared, prev.userId);
              pauseService.resume(prev.userId);
            }
            backgroundScheduler.resume();
            const desktopBridge = getDesktopBridge();
            if (desktopBridge?.resumeReminders) {
              desktopBridge.resumeReminders();
            }
            return cleared;
          }
        }
        return prev;
      });
    };

    const handleAppResumeSync = async () => {
      handleTimeSync();
      if (document.visibilityState === 'visible' && currentUser?.id) {
        try {
          const syncRes = await syncService.syncUserAccount(currentUser.id);
          if (syncRes && syncRes.success) {
            if (syncRes.waterConfig) {
              const mappedWater: WaterConfig = {
                enabled: syncRes.waterConfig.enabled,
                startTime: syncRes.waterConfig.start_time?.slice(0, 5) || '08:00',
                endTime: syncRes.waterConfig.end_time?.slice(0, 5) || '22:00',
                intervalMinutes: syncRes.waterConfig.interval_minutes,
                durationMinutes: Math.round(syncRes.waterConfig.duration_seconds / 60) || 2,
                sound: 'water',
                activeDays: syncRes.waterConfig.active_days || [0, 1, 2, 3, 4, 5, 6],
                quietHoursEnabled: false,
                quietStartTime: '13:00',
                quietEndTime: '14:00',
                reminderStyle: 'popup',
              };
              setWaterConfigState(mappedWater);
              await storageEngine.saveWaterConfig(mappedWater, currentUser.id);
            }
            if (syncRes.lookOutsideConfig) {
              const mappedScreen: ScreenBreakConfig = {
                enabled: syncRes.lookOutsideConfig.enabled,
                startTime: syncRes.lookOutsideConfig.start_time?.slice(0, 5) || '09:00',
                endTime: syncRes.lookOutsideConfig.end_time?.slice(0, 5) || '22:00',
                screenIntervalMinutes: syncRes.lookOutsideConfig.interval_minutes,
                breakDurationMinutes: Math.round(syncRes.lookOutsideConfig.duration_seconds / 60) || 5,
                sound: 'bell',
                activeDays: syncRes.lookOutsideConfig.active_days || [0, 1, 2, 3, 4, 5, 6],
                reminderStyle: 'fullscreen',
              };
              setScreenBreakConfigState(mappedScreen);
              await storageEngine.saveScreenBreakConfig(mappedScreen, currentUser.id);
            }
            if (syncRes.profile) {
              setCurrentUser((prev) => {
                if (!prev || prev.id !== currentUser.id) return prev;
                return {
                  ...prev,
                  display_name: syncRes.profile!.display_name || prev.display_name,
                  avatar_url: syncRes.profile!.avatar_url ?? null,
                  timezone: syncRes.profile!.timezone || prev.timezone,
                };
              });
            }
          }
        } catch (e) {
          console.warn('[AppContext] App resume cloud sync skipped:', e);
        }
      }
    };

    // 1-second pulse for real-time reactive countdowns and second transitions
    const timer = setInterval(handleTimeSync, 1000);

    // Instant sync on window focus, visibility change, and device wake
    window.addEventListener('focus', handleAppResumeSync);
    window.addEventListener('visibilitychange', handleAppResumeSync);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleAppResumeSync);
      window.removeEventListener('visibilitychange', handleAppResumeSync);
    };
  }, [currentUser?.id]);

  // 2. Session verification on boot & reactive auth state listener
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const { user } = await authService.restoreSession();
        if (!isMounted) return;
        if (user) {
          await loginUser(user);
        } else {
          setAuthState('unauthenticated');
        }
      } catch (err) {
        console.warn('[AppContext] Session verification non-fatal error:', err);
        if (isMounted) {
          // Check local storage one more time before defaulting to unauthenticated
          const fallback = authService.getLocalPersistedSession();
          if (fallback && fallback.user) {
            const fallbackUser = authService.toUserProfile(fallback.user);
            await loginUser(fallbackUser);
          } else {
            setAuthState('unauthenticated');
          }
        }
      } finally {
        notificationEngine.requestPermission();
      }
    }

    initSession();

    // Reactive Supabase Auth state change listener
    const { data: authListener } = authService.onAuthStateChange(async (event, session) => {
      console.log(`[AppContext] Supabase Auth event: ${event}`);
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session && session.user) {
          const userProfile = authService.toUserProfile(session.user);
          setCurrentUser((prev) => {
            if (!prev || prev.id !== userProfile.id) {
              loginUser(userProfile);
              return userProfile;
            }
            return {
              ...prev,
              display_name: userProfile.display_name || prev.display_name,
              email: userProfile.email || prev.email,
            };
          });
          setAuthState('authenticated');
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUserAccountState({ isLoggedIn: false });
        setAuthState('unauthenticated');
      }
    });

    return () => {
      isMounted = false;
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // 3. Network Reconnect Listener: Automatically flush offline events and sync
  useEffect(() => {
    const handleReconnect = async () => {
      try {
        if (currentUser?.id && authService.isAuthenticated()) {
          const flushedCount = await reminderService.flushOfflineEvents(currentUser.id);
          if (flushedCount > 0) {
            console.log(`[AppContext] Flushed ${flushedCount} offline events to cloud on reconnect.`);
          }
          await syncService.syncUserAccount(currentUser.id);
        }
      } catch (err) {
        console.warn('[AppContext] Failed to flush offline events on reconnect:', err);
      }
    };

    window.addEventListener('online', handleReconnect);
    return () => {
      window.removeEventListener('online', handleReconnect);
    };
  }, [currentUser?.id]);

  // 4. Listen to Native Background Daemon Status Updates (Desktop Electron Environment)
  useEffect(() => {
    const desktopBridge = getDesktopBridge();
    if (typeof window === 'undefined' || !desktopBridge?.isDesktop) return;

    const cleanupStatus = desktopBridge.onStatusUpdated?.(() => {
      setCurrentDeviceTimestamp(Date.now());
    });

    const cleanupTriggered = desktopBridge.onReminderTriggered?.(
      async (data: { type: 'water' | 'screen' | 'look_outside'; slotId: string; scheduledAt?: string }) => {
        console.log('[AppContext] Native reminder triggered received:', data);
        const cat = data.type === 'screen' ? 'look_outside' : data.type;
        const activeUid = currentUser?.id || (await authService.getCurrentUser())?.id;
        if (activeUid) {
          await reminderService.recordTriggered(activeUid, cat, data.slotId, data.scheduledAt);
        }
      }
    );

    const cleanupCompleted = desktopBridge.onNativeReminderCompleted?.(
      async (data: { type: 'water' | 'screen' | 'look_outside'; slotId: string; completedAt?: string }) => {
        console.log('[AppContext] Native reminder completion received:', data);
        const cat = data.type === 'look_outside' ? 'screen' : data.type;
        await completeRealReminder(cat, data.slotId);
      }
    );

    const cleanupExpired = desktopBridge.onNativeReminderExpired?.(
      async (data: { type: 'water' | 'screen' | 'look_outside'; slotId: string; expiredAt?: string }) => {
        console.log('[AppContext] Native reminder expiration received:', data);
        const cat = data.type === 'look_outside' ? 'screen' : data.type;
        await skipRealReminder(cat, data.slotId);
      }
    );

    const cleanupNativePause = (desktopBridge as any).onNativePauseStateChange?.(
      async (state: { isPaused: boolean; pauseMinutes: number | null }) => {
        console.log('[AppContext] Native pause state change from system tray:', state);
        if (state.isPaused && state.pauseMinutes) {
          await setPauseDuration(state.pauseMinutes);
        } else {
          await setPauseDuration(null);
        }
      }
    );

    return () => {
      if (cleanupStatus) cleanupStatus();
      if (cleanupTriggered) cleanupTriggered();
      if (cleanupCompleted) cleanupCompleted();
      if (cleanupExpired) cleanupExpired();
      if (cleanupNativePause) cleanupNativePause();
    };
  }, [currentUser]);

  // 5. Direct Event Subscription: Authoritative Reminder Service Events (Standalone Overlay, Web, Mobile, Background Sync)
  useEffect(() => {
    const unsub = reminderService.onReminderEvent(async () => {
      const activeUserId = currentUser?.id || (await authService.getCurrentUser())?.id;
      if (activeUserId) {
        try {
          const todayEvents = await reminderService.getTodayEvents(activeUserId);
          const newWaterLogs: WaterReminderLog[] = [];
          const newScreenLogs: ScreenBreakLog[] = [];

          for (const ev of todayEvents) {
            if (ev.status === 'completed') {
              const evDate = new Date(ev.scheduled_at || ev.created_at || ev.completed_at || Date.now());
              const timeStr = `${String(evDate.getHours()).padStart(2, '0')}:${String(evDate.getMinutes()).padStart(2, '0')}`;
              if (ev.type === 'water') {
                if (!newWaterLogs.some((l) => l.id === ev.id || l.time === timeStr)) {
                  newWaterLogs.push({
                    id: ev.id,
                    time: timeStr,
                    scheduledTimestamp: evDate.getTime(),
                    status: 'completed',
                    completedAt: new Date(ev.completed_at || evDate).toISOString(),
                  });
                }
              } else if (ev.type === 'look_outside' || (ev.type as any) === 'screen') {
                if (!newScreenLogs.some((l) => l.id === ev.id || l.time === timeStr)) {
                  newScreenLogs.push({
                    id: ev.id,
                    time: timeStr,
                    scheduledTimestamp: evDate.getTime(),
                    durationMinutes: screenBreakConfig.breakDurationMinutes || 5,
                    status: 'completed',
                    completedAt: new Date(ev.completed_at || evDate).toISOString(),
                  });
                }
              }
            }
          }
          setWaterLogs(newWaterLogs);
          setScreenLogs(newScreenLogs);
        } catch (_) {}
      }
    });

    return () => {
      unsub();
    };
  }, [currentUser?.id, screenBreakConfig.breakDurationMinutes]);

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

  // 5. Supabase Realtime Multi-Device Synchronization Listener
  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;

    // Connect Realtime Channel
    realtimeSyncService.subscribe(userId);

    // 1. Water Config remote change from another device (Laptop / Mobile / Web)
    const unsubWater = realtimeSyncService.onWaterConfigChange(async (payload) => {
      if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
        console.log('[AppContext] Remote Water Config update received via Realtime:', payload.new);
        try {
          const { config: latestCloudConfig } = await waterConfigService.getWaterConfig(userId);
          const activeWater = latestCloudConfig || payload.new;
          if (activeWater) {
            const mappedWater: WaterConfig = {
              enabled: activeWater.enabled,
              startTime: activeWater.start_time?.slice(0, 5) || '08:00',
              endTime: activeWater.end_time?.slice(0, 5) || '22:00',
              intervalMinutes: activeWater.interval_minutes,
              durationMinutes: Math.round(activeWater.duration_seconds / 60) || 2,
              sound: 'water',
              activeDays: activeWater.active_days || [0, 1, 2, 3, 4, 5, 6],
              quietHoursEnabled: false,
              quietStartTime: '13:00',
              quietEndTime: '14:00',
              reminderStyle: 'popup',
            };
            setWaterConfigState(mappedWater);
            await storageEngine.saveWaterConfig(mappedWater, userId);
            const desktopBridge = getDesktopBridge();
            if (desktopBridge?.updateWaterConfig) {
              await desktopBridge.updateWaterConfig(mappedWater);
            }
          }
        } catch (err) {
          console.warn('[AppContext] Realtime water config reconciliation error:', err);
        }
      }
    });

    // 2. Look Outside Config remote change from another device
    const unsubScreen = realtimeSyncService.onLookOutsideConfigChange(async (payload) => {
      if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
        console.log('[AppContext] Remote Look Outside Config update received via Realtime:', payload.new);
        try {
          const { config: latestCloudConfig } = await lookOutsideConfigService.getLookOutsideConfig(userId);
          const activeLook = latestCloudConfig || payload.new;
          if (activeLook) {
            const mappedScreen: ScreenBreakConfig = {
              enabled: activeLook.enabled,
              startTime: activeLook.start_time?.slice(0, 5) || '09:00',
              endTime: activeLook.end_time?.slice(0, 5) || '22:00',
              screenIntervalMinutes: activeLook.interval_minutes,
              breakDurationMinutes: Math.round(activeLook.duration_seconds / 60) || 5,
              sound: 'bell',
              activeDays: activeLook.active_days || [0, 1, 2, 3, 4, 5, 6],
              reminderStyle: 'fullscreen',
            };
            setScreenBreakConfigState(mappedScreen);
            await storageEngine.saveScreenBreakConfig(mappedScreen, userId);
            const desktopBridge = getDesktopBridge();
            if (desktopBridge?.updateScreenConfig) {
              await desktopBridge.updateScreenConfig(mappedScreen);
            }
          }
        } catch (err) {
          console.warn('[AppContext] Realtime look outside config reconciliation error:', err);
        }
      }
    });

    // 3. User Settings remote change from another device
    const unsubSettings = realtimeSyncService.onSettingsChange(async (payload) => {
      if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
        console.log('[AppContext] Remote Settings update received via Realtime:', payload.new);
        try {
          const { settings: latestSettings } = await settingsService.getSettings(userId);
          const cloud = latestSettings || payload.new;
          if (cloud) {
            if (cloud.theme) setGeneralSettingsState((prev) => ({ ...prev, theme: cloud.theme }));
            if (cloud.time_format) setGeneralSettingsState((prev) => ({ ...prev, timeFormat: cloud.time_format }));
            if (cloud.notifications_enabled !== undefined) setNotificationSettingsState((prev) => ({ ...prev, enabled: cloud.notifications_enabled }));
            if (cloud.sound_enabled !== undefined) setNotificationSettingsState((prev) => ({ ...prev, soundEnabled: cloud.sound_enabled }));
          }
        } catch (err) {
          console.warn('[AppContext] Realtime settings reconciliation error:', err);
        }
      }
    });

    // 4. Remote Reminder Event completed / triggered on another device (e.g. Mobile)
    const unsubEvents = realtimeSyncService.onReminderEventChange(async (payload) => {
      if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
        console.log('[AppContext] Remote reminder event received via Realtime:', payload.new);
        const ev = payload.new;
        
        // Ingest into local store without full refetch
        reminderService.ingestRemoteEvent(userId, ev);

        // Record diagnostics
        if (ev.updated_at) {
          const latency = Math.max(15, Date.now() - new Date(ev.updated_at).getTime());
          performanceDiagnostics.markRealtimeDelivery(latency);
        }

        if (ev.status === 'completed') {
          const evDate = new Date(ev.completed_at || ev.scheduled_at);
          const timeStr = `${String(evDate.getHours()).padStart(2, '0')}:${String(evDate.getMinutes()).padStart(2, '0')}`;
          if (ev.type === 'water') {
            setWaterLogs((prev) => {
              if (prev.some((l) => l.id === ev.id)) return prev;
              return [
                ...prev,
                {
                  id: ev.id,
                  time: timeStr,
                  scheduledTimestamp: new Date(ev.scheduled_at || Date.now()).getTime(),
                  status: 'completed',
                  completedAt: evDate.toISOString(),
                },
              ];
            });
          } else if (ev.type === 'look_outside' || (ev.type as any) === 'screen') {
            setScreenLogs((prev) => {
              if (prev.some((l) => l.id === ev.id)) return prev;
              return [
                ...prev,
                {
                  id: ev.id,
                  time: timeStr,
                  scheduledTimestamp: new Date(ev.scheduled_at || Date.now()).getTime(),
                  durationMinutes: 5,
                  status: 'completed',
                  completedAt: evDate.toISOString(),
                },
              ];
            });
          }
        }
      }
    });

    // 5. Local Service Reminder Event Listener (handles locally completed/expired reminders)
    const unsubLocalEvents = reminderService.onReminderEvent((ev) => {
      if (ev.status === 'completed') {
        const evDate = new Date(ev.completed_at || ev.scheduled_at || Date.now());
        const timeStr = `${String(evDate.getHours()).padStart(2, '0')}:${String(evDate.getMinutes()).padStart(2, '0')}`;
        if (ev.type === 'water') {
          setWaterLogs((prev) => {
            if (prev.some((l) => l.id === ev.id)) return prev;
            return [
              ...prev,
              {
                id: ev.id,
                time: timeStr,
                scheduledTimestamp: new Date(ev.scheduled_at || Date.now()).getTime(),
                status: 'completed',
                completedAt: evDate.toISOString(),
              },
            ];
          });
        } else if (ev.type === 'look_outside' || (ev.type as any) === 'screen') {
          setScreenLogs((prev) => {
            if (prev.some((l) => l.id === ev.id)) return prev;
            return [
              ...prev,
              {
                id: ev.id,
                time: timeStr,
                scheduledTimestamp: new Date(ev.scheduled_at || Date.now()).getTime(),
                durationMinutes: 5,
                status: 'completed',
                completedAt: evDate.toISOString(),
              },
            ];
          });
        }
      }
    });

    // 6. Remote Profile (Avatar, Display Name, Timezone) update from another device (Web, Windows, Android)
    const unsubProfile = realtimeSyncService.onProfileChange(async (payload) => {
      if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
        const incoming = payload.new;
        if (!incoming.id || incoming.id !== userId) {
          console.log(`[AppContext] Ignored foreign profile update: ${incoming.id} !== ${userId}`);
          return;
        }

        console.log('[AppContext] Remote Profile update received via Realtime:', incoming);
        try {
          // Authoritative avatar URL resolution from Realtime payload
          const resolvedAvatar = profileAvatarService.resolveAvatarUrl(incoming.avatar_url);

          // Update React application state immediately
          setCurrentUser((prev) => {
            if (!prev || prev.id !== userId) return prev;
            return {
              ...prev,
              display_name: incoming.display_name || prev.display_name,
              avatar_url: resolvedAvatar,
              timezone: incoming.timezone || prev.timezone,
            };
          });

          setUserAccountState((prev) => ({
            ...prev,
            name: incoming.display_name || prev.name,
          }));

          if (incoming.timezone) {
            setGeneralSettingsState((prev) => ({ ...prev, timezone: incoming.timezone }));
          }

          // Persist authoritative profile to user-scoped local cache
          await storageEngine.saveProfile(
            {
              id: userId,
              display_name: incoming.display_name,
              avatar_url: resolvedAvatar,
              timezone: incoming.timezone,
              updated_at: incoming.updated_at || new Date().toISOString(),
            },
            userId
          );
        } catch (err) {
          console.warn('[AppContext] Realtime profile reconciliation error:', err);
        }
      }
    });

    // 7. Remote Pause state update from another device (Android, Web, Windows)
    const unsubPause = realtimeSyncService.onPauseStateChange(async (payload) => {
      if (payload.new && (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE')) {
        const incoming = payload.new;
        if (incoming.user_id && incoming.user_id !== userId) return;

        console.log(`[PauseFlow][Realtime][Pause] Remote pause update received from device = ${incoming.paused_by_device_id || 'unknown'}, paused_until = ${incoming.paused_until}, updated_at = ${incoming.updated_at}`);
        const mapped = pauseService.mapToPauseState(incoming, Date.now());
        setPauseState(mapped);
        await storageEngine.savePauseState(mapped, userId);

        const desktopBridge = getDesktopBridge();
        if (mapped.isPaused) {
          await backgroundScheduler.pause(mapped.pauseMinutes || 1440);
          if (desktopBridge?.pauseReminders) {
            await desktopBridge.pauseReminders(mapped.pauseMinutes || 1440);
          }
        } else {
          await backgroundScheduler.resume();
          if (desktopBridge?.resumeReminders) {
            await desktopBridge.resumeReminders();
          }
        }
      }
    });

    return () => {
      unsubWater();
      unsubScreen();
      unsubSettings();
      unsubEvents();
      unsubLocalEvents();
      unsubProfile();
      unsubPause();
    };
  }, [currentUser?.id]);

  // Unified Centralized Dynamic Real-Time Engine Calculation
  const scheduleResult = reminderEngine.calculateSchedule(
    waterConfig,
    screenBreakConfig,
    pauseState,
    waterLogs,
    screenLogs,
    new Date(currentDeviceTimestamp)
  );

  // Save Handlers with Cloud Synchronization
  const setWaterConfig = async (cfg: WaterConfig) => {
    setWaterConfigState(cfg);
    await storageEngine.saveWaterConfig(cfg, currentUser?.id);
    const desktopBridge = getDesktopBridge();
    if (desktopBridge?.updateWaterConfig) {
      await desktopBridge.updateWaterConfig(cfg);
    }
    if (currentUser?.id) {
      try {
        const formattedStart = cfg.startTime ? (cfg.startTime.length === 5 ? `${cfg.startTime}:00` : cfg.startTime) : '09:00:00';
        const formattedEnd = cfg.endTime ? (cfg.endTime.length === 5 ? `${cfg.endTime}:00` : cfg.endTime) : '18:00:00';
        const res = await waterConfigService.updateWaterConfig(currentUser.id, {
          enabled: cfg.enabled,
          interval_minutes: Number(cfg.intervalMinutes),
          start_time: formattedStart,
          end_time: formattedEnd,
          duration_seconds: (Number(cfg.durationMinutes) || 2) * 60,
          active_days: cfg.activeDays,
        });
        if (res.error) {
          console.warn('[AppContext] Cloud water config sync returned error:', res.error);
        } else {
          console.log('[AppContext] Water config successfully saved and confirmed in Supabase ✓');
        }
      } catch (err) {
        console.warn('[AppContext] Failed to sync water config to cloud:', err);
      }
    }
  };

  const setScreenBreakConfig = async (cfg: ScreenBreakConfig) => {
    setScreenBreakConfigState(cfg);
    await storageEngine.saveScreenBreakConfig(cfg, currentUser?.id);
    const desktopBridge = getDesktopBridge();
    if (desktopBridge?.updateScreenConfig) {
      await desktopBridge.updateScreenConfig(cfg);
    }
    if (currentUser?.id) {
      try {
        const formattedStart = cfg.startTime ? (cfg.startTime.length === 5 ? `${cfg.startTime}:00` : cfg.startTime) : '09:00:00';
        const formattedEnd = cfg.endTime ? (cfg.endTime.length === 5 ? `${cfg.endTime}:00` : cfg.endTime) : '18:00:00';
        const res = await lookOutsideConfigService.updateLookOutsideConfig(currentUser.id, {
          enabled: cfg.enabled,
          interval_minutes: Number(cfg.screenIntervalMinutes),
          start_time: formattedStart,
          end_time: formattedEnd,
          duration_seconds: (Number(cfg.breakDurationMinutes) || 5) * 60,
          active_days: cfg.activeDays,
        });
        if (res.error) {
          console.warn('[AppContext] Cloud look outside config sync returned error:', res.error);
        } else {
          console.log('[AppContext] Look Outside config successfully saved and confirmed in Supabase ✓');
        }
      } catch (err) {
        console.warn('[AppContext] Failed to sync screen break config to cloud:', err);
      }
    }
  };

  const setGeneralSettings = async (settings: GeneralSettings) => {
    setGeneralSettingsState(settings);
    await storageEngine.saveGeneralSettings(settings, currentUser?.id);
    if (currentUser?.id) {
      try {
        await settingsService.updateSettings(currentUser.id, {
          theme: settings.theme,
          time_format: settings.timeFormat,
        });
        if (settings.timezone) {
          await profileService.updateProfile(currentUser.id, {
            timezone: settings.timezone,
          });
        }
      } catch (err) {
        console.warn('[AppContext] Failed to sync general settings to cloud:', err);
      }
    }
  };

  const setNotificationSettings = async (settings: NotificationSettings) => {
    setNotificationSettingsState(settings);
    await storageEngine.saveNotificationSettings(settings, currentUser?.id);
    if (currentUser?.id) {
      try {
        await settingsService.updateSettings(currentUser.id, {
          notifications_enabled: settings.enabled,
          sound_enabled: settings.soundEnabled,
        });
      } catch (err) {
        console.warn('[AppContext] Failed to sync notification settings to cloud:', err);
      }
    }
  };



  const setPauseDuration = async (minutes: number | 'tomorrow' | null) => {
    const uid = currentUser?.id;
    if (!uid) return;

    if (minutes === null) {
      const entity = await pauseService.resume(uid);
      const newState: PauseState = pauseService.mapToPauseState(entity, Date.now());
      setPauseState(newState);
      await backgroundScheduler.resume();
      const desktopBridge = getDesktopBridge();
      if (desktopBridge?.resumeReminders) {
        await desktopBridge.resumeReminders();
      }
      return;
    }

    const entity = await pauseService.setPause(uid, minutes);
    const newState: PauseState = pauseService.mapToPauseState(entity, Date.now());
    setPauseState(newState);
    await backgroundScheduler.pause(minutes);
    const desktopBridge = getDesktopBridge();
    if (desktopBridge?.pauseReminders) {
      const durationMins = typeof minutes === 'number' ? minutes : 1440;
      await desktopBridge.pauseReminders(durationMins);
    }
  };

  // REAL Reminder Status Update
  const markWaterStatus = async (id: string, status: ReminderStatus, scheduledTimestamp?: number) => {
    const todayStr = getTodayString();

    // Extract HH:mm from the end of the slot ID (e.g. 'water:2026-09-13:10:00' -> '10:00' or 'water-10:00' -> '10:00')
    let slotTime = '';
    const endMatch = id.match(/(\d{1,2}:\d{2})$/);
    if (endMatch) {
      const [h, m] = endMatch[1].split(':');
      slotTime = `${h.padStart(2, '0')}:${m}`;
    } else if (scheduledTimestamp) {
      const d = new Date(scheduledTimestamp);
      slotTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else {
      const d = new Date();
      slotTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    setWaterLogs((prevLogs) => {
      const existingIdx = prevLogs.findIndex((l) => l.id === id || l.time === slotTime);
      let updated: WaterReminderLog[];

      if (existingIdx >= 0) {
        updated = [...prevLogs];
        updated[existingIdx] = {
          ...prevLogs[existingIdx],
          id,
          time: slotTime,
          status,
          completedAt: new Date().toISOString(),
        };
      } else {
        updated = [
          ...prevLogs,
          {
            id,
            time: slotTime,
            scheduledTimestamp: scheduledTimestamp || Date.now(),
            status,
            completedAt: new Date().toISOString(),
          },
        ];
      }

      storageEngine.saveDailyWaterLogs(todayStr, updated, currentUser?.id);
      return updated;
    });

    console.log(`[PauseFlow][UI] progress_update type=water eventId=${id} slotTime=${slotTime} status=${status}`);

    // Record authoritative lifecycle event in reminderService
    try {
      const activeUserId = currentUser?.id || (await authService.getCurrentUser())?.id || '';
      if (activeUserId && status === 'completed') {
        await reminderService.recordCompleted(activeUserId, 'water', id, undefined, new Date().toISOString());
      }
    } catch (err) {
      console.warn('[AppContext] Failed to record water event in reminderService:', err);
    }
  };

  const markScreenStatus = async (id: string, status: ReminderStatus, scheduledTimestamp?: number) => {
    const todayStr = getTodayString();

    let slotTime = '';
    const endMatch = id.match(/(\d{1,2}:\d{2})$/);
    if (endMatch) {
      const [h, m] = endMatch[1].split(':');
      slotTime = `${h.padStart(2, '0')}:${m}`;
    } else if (scheduledTimestamp) {
      const d = new Date(scheduledTimestamp);
      slotTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else {
      const d = new Date();
      slotTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    setScreenLogs((prevLogs) => {
      const existingIdx = prevLogs.findIndex((l) => l.id === id || l.time === slotTime);
      let updated: ScreenBreakLog[];

      if (existingIdx >= 0) {
        updated = [...prevLogs];
        updated[existingIdx] = {
          ...prevLogs[existingIdx],
          id,
          time: slotTime,
          durationMinutes: screenBreakConfig.breakDurationMinutes || 5,
          status,
          completedAt: new Date().toISOString(),
        };
      } else {
        updated = [
          ...prevLogs,
          {
            id,
            time: slotTime,
            scheduledTimestamp: scheduledTimestamp || Date.now(),
            durationMinutes: screenBreakConfig.breakDurationMinutes || 5,
            status,
            completedAt: new Date().toISOString(),
          },
        ];
      }

      storageEngine.saveDailyScreenLogs(todayStr, updated, currentUser?.id);
      return updated;
    });

    console.log(`[PauseFlow][UI] progress_update type=look_outside eventId=${id} slotTime=${slotTime} status=${status}`);

    // Record authoritative lifecycle event in reminderService
    try {
      const activeUserId = currentUser?.id || (await authService.getCurrentUser())?.id || '';
      if (activeUserId && status === 'completed') {
        await reminderService.recordCompleted(activeUserId, 'look_outside', id, undefined, new Date().toISOString());
      }
    } catch (err) {
      console.warn('[AppContext] Failed to record screen break event in reminderService:', err);
    }
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
    const desktopBridge = getDesktopBridge();
    if (typeof window !== 'undefined' && desktopBridge?.startPreview) {
      desktopBridge.startPreview(category === 'both' ? 'water' : category, duration);
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

    // Record triggered event in reminderService
    if (currentUser?.id) {
      if (category === 'water' || category === 'both') {
        reminderService.recordTriggered(currentUser.id, 'water', extraOpts?.waterSlotId || slotId);
      }
      if (category === 'screen' || category === 'both') {
        reminderService.recordTriggered(currentUser.id, 'look_outside', extraOpts?.screenSlotId || slotId);
      }
    }

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
    // Windows Desktop / Web countdown completion is presentation-only:
    // desktop_triggered != completed.
    // The authoritative completion source is Android native notification delivery.
    setActiveWaterModalOpen(false);
    setActiveBreakModalOpen(false);
    setRealActiveReminder(null);

    const desktopBridge = getDesktopBridge();
    if (desktopBridge?.completeReminder) {
      await desktopBridge.completeReminder(category === 'both' ? 'water' : category, slotId);
    }
  };

  const skipRealReminder = async (category: 'water' | 'screen' | 'both', slotId: string) => {
    // Delivery represents completion. Skip break neutrally dismisses the optional timer without marking missed.
    setActiveWaterModalOpen(false);
    setActiveBreakModalOpen(false);
    setRealActiveReminder(null);

    const desktopBridge = getDesktopBridge();
    if (desktopBridge?.skipReminder) {
      await desktopBridge.skipReminder(category === 'both' ? 'water' : category, slotId);
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
    const desktopBridge = getDesktopBridge();
    if (desktopBridge?.resetTodayData) {
      await desktopBridge.resetTodayData();
    }
  };

  // Legacy wrappers mapped safely to Preview
  const openBreakModal = () => startPreview('screen');
  const closeBreakModal = () => finishPreview('screen');
  const openWaterModal = () => startPreview('water');
  const closeWaterModal = () => finishPreview('water');

  const setUserAccount = async (acc: UserAccount) => {
    setUserAccountState(acc);
    await storageEngine.saveUserAccount(acc);
  };

  const completeOnboarding = async () => {
    setOnboardingCompleted(true);
    await storageEngine.setOnboardingStatus(true, currentUser?.id);
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
          notificationEngine.sendWaterNotification({
            sound: notificationSettings.waterSound,
            soundEnabled: notificationSettings.soundEnabled,
          });
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
          notificationEngine.sendScreenBreakNotification({
            sound: notificationSettings.lookOutsideSound,
            soundEnabled: notificationSettings.soundEnabled,
          });
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
    notificationSettings.waterSound,
    notificationSettings.lookOutsideSound,
    notificationSettings.soundEnabled,
  ]);

  // 5. Native Mobile Lifecycle Listener (Resync on app resume / return from Android Settings)
  useEffect(() => {
    let appStateListener: any = null;
    const platform = detectPlatform();
    if (platform === 'android') {
      import('@capacitor/app').then(({ App: CapApp }) => {
        CapApp.addListener('appStateChange', async (state) => {
          if (state.isActive) {
            console.log('[AppContext] App returned to foreground. Performing reconciliation...');
            setCurrentDeviceTimestamp(Date.now());
            const activeUid = currentUser?.id;
            if (activeUid) {
              try {
                await androidScheduler.reconcileDeliveredReminders(activeUid, currentUser?.created_at, generalSettings.timezone);
                await reminderService.flushOfflineEvents(activeUid);
                await syncService.syncUserAccount(activeUid);
                const todayEvents = await reminderService.getTodayEvents(activeUid, generalSettings.timezone);
                const newWaterLogs: WaterReminderLog[] = [];
                const newScreenLogs: ScreenBreakLog[] = [];

                for (const ev of todayEvents) {
                  if (ev.status === 'completed') {
                    const evDate = new Date(ev.completed_at || ev.scheduled_at || ev.created_at || Date.now());
                    const timeStr = `${String(evDate.getHours()).padStart(2, '0')}:${String(evDate.getMinutes()).padStart(2, '0')}`;
                    if (ev.type === 'water') {
                      if (!newWaterLogs.some((l) => l.id === ev.id)) {
                        newWaterLogs.push({
                          id: ev.id,
                          time: timeStr,
                          scheduledTimestamp: evDate.getTime(),
                          status: 'completed',
                          completedAt: new Date(ev.completed_at || evDate).toLocaleTimeString(),
                        });
                      }
                    } else if (ev.type === 'look_outside' || (ev.type as any) === 'screen') {
                      if (!newScreenLogs.some((l) => l.id === ev.id)) {
                        newScreenLogs.push({
                          id: ev.id,
                          time: timeStr,
                          scheduledTimestamp: evDate.getTime(),
                          durationMinutes: screenBreakConfig.breakDurationMinutes || 5,
                          status: 'completed',
                          completedAt: new Date(ev.completed_at || evDate).toLocaleTimeString(),
                        });
                      }
                    }
                  }
                }
                setWaterLogs(newWaterLogs);
                setScreenLogs(newScreenLogs);
              } catch (err) {
                console.warn('[AppContext] App resume reconciliation error:', err);
              }
            }
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
  }, [currentUser?.id, generalSettings.timezone, screenBreakConfig.breakDurationMinutes]);

  // 6. Device Background Scheduling (Android Capacitor & Windows Electron)
  useEffect(() => {
    const platform = detectPlatform();
    if (platform === 'web') return;

    // CRITICAL SECURITY & DATA ISOLATION GUARD:
    // Never schedule reminder alarms for unauthenticated / anonymous state
    if (!currentUser?.id || authState !== 'authenticated') {
      console.log('[PauseFlow][SECURITY] stage=ANONYMOUS_SCHEDULER_BLOCKED reason=unauthenticated_state');
      backgroundScheduler.cancelAllNotifications();
      return;
    }

    const currentUserId = currentUser.id;
    const isPaused = pauseService.isRemindersPaused(pauseState, Date.now());

    if (isPaused || !notificationSettings.enabled) {
      backgroundScheduler.cancelUserSchedule(currentUserId);
      return;
    }

    // Generate rolling multi-day schedule (Today + Tomorrow + Day after tomorrow / 72 hours)
    // Guarantees future alarms already exist in Android AlarmManager overnight
    const scheduledList = reminderEngine.generateRollingSchedule(
      waterConfig,
      screenBreakConfig,
      pauseState,
      currentUserId,
      3, // 3-day rolling window
      new Date()
    );

    backgroundScheduler.syncUserSchedule(currentUserId, scheduledList);
  }, [
    waterConfig,
    screenBreakConfig,
    pauseState,
    notificationSettings.enabled,
    currentUser?.id,
    authState,
  ]);

  // 7. Mobile (Android) & Desktop (Windows) Notification Delivery & Tap Listeners
  useEffect(() => {
    let actionListener: any = null;
    let receivedListener: any = null;
    let nativeDeliveredListener: any = null;
    let desktopListenerCleanup: (() => void) | null = null;
    let foregroundInterval: ReturnType<typeof setInterval> | null = null;

    async function setupListeners() {
      const platform = detectPlatform();

      // Android Native Alarm Delivery & Tap Listeners
      if (platform === 'android') {
        try {
          console.log('[PauseFlow][Bridge] listener_register_start');

          // 1. NATIVE EXACT ALARM DELIVERY = IMMEDIATE COMPLETION
          nativeDeliveredListener = await PauseFlowNative.addListener(
            'reminderDelivered',
            async (data) => {
              console.log(`[PauseFlow][Bridge] listener_received eventId=${data?.eventId} category=${data?.category} userId=${data?.userId}`);

              if (!currentUser?.id || data?.userId !== currentUser.id) {
                console.log(`[PauseFlow][Bridge] Ignored event for non-matching userId: ${data?.userId} (current: ${currentUser?.id})`);
                return;
              }

              const rawCategory = (data?.category || 'water').toLowerCase();
              if (rawCategory === 'daily_summary') {
                console.log(`[PauseFlow][Bridge] Daily summary delivered for user: ${currentUser.id}`);
                return;
              }
              const category = rawCategory === 'screen' || rawCategory === 'look_outside' ? 'look_outside' : 'water';
              const targetUserId = currentUser.id;
              const now = Date.now();
              const scheduledTimestamp = data?.scheduledTimestamp || data?.timestamp || now;
              const scheduledIso = new Date(scheduledTimestamp).toISOString();
              const eventId = data?.eventId || `native-${scheduledTimestamp}`;

              console.log(`[PauseFlow][TRACE] stage=JS_RECEIVED eventId=${eventId} category=${category} userId=${targetUserId}`);

              if (category === 'water') {
                await reminderService.recordDelivered(targetUserId, 'water', eventId, scheduledIso);
                await markWaterStatus(eventId, 'completed', scheduledTimestamp);
              } else {
                await reminderService.recordDelivered(targetUserId, 'look_outside', eventId, scheduledIso);
                await markScreenStatus(eventId, 'completed', scheduledTimestamp);
              }

              console.log(`[PauseFlow][TRACE] stage=UI_PROGRESS_UPDATED eventId=${eventId} category=${category}`);

              // Immediately reconcile any other pending records from SharedPreferences
              await androidScheduler.reconcileDeliveredReminders(targetUserId, currentUser?.created_at, generalSettings.timezone);
            }
          );

          console.log('[PauseFlow][Bridge] listener_register_success');

          // Fallback: LocalNotifications received event (if any scheduled via Capacitor)
          receivedListener = await LocalNotifications.addListener(
            'localNotificationReceived',
            async (notification) => {
              const extra = notification.extra;
              if (!currentUser?.id || extra?.userId !== currentUser.id) {
                return;
              }

              const rawCategory = (extra?.category || 'water').toLowerCase();
              if (rawCategory === 'daily_summary') {
                return;
              }
              const category = rawCategory === 'screen' || rawCategory === 'look_outside' ? 'look_outside' : 'water';
              const targetUserId = currentUser.id;
              const now = Date.now();
              const scheduledTimestamp = extra?.scheduledTimestamp || now;
              const scheduledIso = new Date(scheduledTimestamp).toISOString();
              const slotId = extra?.originalId || extra?.slotId || `notif-${scheduledTimestamp}`;

              if (category === 'water') {
                const wSlotId = extra?.waterSlotId || slotId;
                await reminderService.recordDelivered(targetUserId, 'water', wSlotId, scheduledIso);
                await markWaterStatus(wSlotId, 'completed', scheduledTimestamp);
              } else {
                const sSlotId = extra?.screenSlotId || slotId;
                await reminderService.recordDelivered(targetUserId, 'look_outside', sSlotId, scheduledIso);
                await markScreenStatus(sSlotId, 'completed', scheduledTimestamp);
              }
            }
          );

          // 2. Notification Tap (Opens Optional Countdown Screen without re-marking completion)
          actionListener = await LocalNotifications.addListener(
            'localNotificationActionPerformed',
            (action) => {
              const extra = action.notification.extra;
              if (!currentUser?.id || extra?.userId !== currentUser.id) {
                console.log('[AppContext] Ignored notification from different user account.');
                return;
              }

              if (extra?.category === 'daily_summary' || extra?.type === 'daily_summary') {
                console.log('[AppContext] Daily summary notification tapped. Navigating to statistics.');
                setActiveTab('statistics');
                return;
              }

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
                const remainingSecs = now < endTs ? Math.max(1, Math.floor((endTs - now) / 1000)) : defaultDuration;

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

          // Reconcile past-due delivered reminders on startup if authenticated
          if (currentUser?.id) {
            androidScheduler.reconcileDeliveredReminders(currentUser.id, currentUser?.created_at, generalSettings.timezone);

            // Event-driven foreground periodic check (every 15s) to guarantee reconciliation while app stays open
            foregroundInterval = setInterval(() => {
              if (currentUser?.id) {
                androidScheduler.reconcileDeliveredReminders(currentUser.id, currentUser?.created_at, generalSettings.timezone);
              }
            }, 15000);
          }
        } catch (err) {
          console.warn('[PauseFlow][Bridge] Could not register notification listeners:', err);
        }
      }

      // Windows Electron Notification Tap
      const desktopBridge = getDesktopBridge();
      if (platform === 'windows' && desktopBridge?.onNotificationTap) {
        desktopListenerCleanup = desktopBridge.onNotificationTap((data: any) => {
          if (data?.userId && currentUser?.id && data.userId !== currentUser.id) {
            console.log('[AppContext] Windows notification belongs to another user. Ignoring.');
            return;
          }
          if (data?.category) {
            const duration = data.category === 'water'
              ? (waterConfig.durationMinutes || 2) * 60
              : (screenBreakConfig.breakDurationMinutes || 5) * 60;
            startRealReminder(data.category, data.slotId || `win-${Date.now()}`, duration);
          }
        });
      }
    }

    setupListeners();

    return () => {
      if (foregroundInterval) {
        clearInterval(foregroundInterval);
      }
      if (actionListener?.remove) {
        actionListener.remove();
      }
      if (receivedListener?.remove) {
        receivedListener.remove();
      }
      if (nativeDeliveredListener?.remove) {
        nativeDeliveredListener.remove();
      }
      if (desktopListenerCleanup) {
        desktopListenerCleanup();
      }
    };
  }, [waterConfig.durationMinutes, screenBreakConfig.breakDurationMinutes, currentUser?.id, currentUser?.created_at, generalSettings.timezone]);

  return (
    <AppContext.Provider
      value={{
        authState,
        currentUser,
        loginUser,
        logout,

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

        startPreview,
        finishPreview,
        startRealReminder,
        completeRealReminder,
        skipRealReminder,

        openBreakModal,
        closeBreakModal,
        openWaterModal,
        closeWaterModal,

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
