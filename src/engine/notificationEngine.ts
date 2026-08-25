// Centralized Production Notification Service for EyeFlow (Windows Desktop + Android Mobile + Web Mode)
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  isPermissionGranted as isTauriPermissionGranted,
  requestPermission as requestTauriPermission,
  sendNotification as sendTauriNotification,
} from '@tauri-apps/plugin-notification';
import { detectPlatform } from '../platform/systemLifecycle';

export interface NotificationDiagnostics {
  permissionState: NotificationPermission;
  isDesktop: boolean;
  isMobile: boolean;
  isWebBrowser: boolean;
  lastAttemptStatus: 'success' | 'blocked' | 'error' | 'none';
  lastError: string | null;
  lastFiredTimestamp: number | null;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
}

export class NotificationService {
  private lastWaterNotifyTime = 0;
  private lastScreenNotifyTime = 0;
  private audioCtx: AudioContext | null = null;
  private channelsCreated = false;

  public lastAttemptStatus: 'success' | 'blocked' | 'error' | 'none' = 'none';
  public lastError: string | null = null;
  public lastFiredTimestamp: number | null = null;

  public isDesktop(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'eyeflowNative' in window ||
      '__TAURI_INTERNALS__' in window ||
      Boolean((window as any).process?.type)
    );
  }

  public isMobile(): boolean {
    const platform = detectPlatform();
    return platform === 'android';
  }

  public isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  public isElectron(): boolean {
    return typeof window !== 'undefined' && 'eyeflowNative' in window;
  }

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  private async initAndroidChannels() {
    if (this.channelsCreated || !this.isMobile()) return;
    try {
      await LocalNotifications.createChannel({
        id: 'eyeflow_water_channel',
        name: 'Water Reminders',
        description: 'Notifications reminding you to hydrate and take a water break',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'eyeflow_screen_channel',
        name: 'Look Outside Screen Breaks',
        description: 'Notifications reminding you to give your eyes a short break from the screen',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      this.channelsCreated = true;
    } catch (_) {}
  }

  /**
   * Returns current real permission state ('granted' | 'denied' | 'default')
   */
  public async getPermissionStatus(): Promise<NotificationPermission> {
    if (this.isElectron()) {
      return 'granted';
    }

    if (this.isMobile()) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'granted') return 'granted';
        if (perm.display === 'denied') return 'denied';
        return 'default';
      } catch {
        return 'default';
      }
    }

    if (this.isTauri()) {
      try {
        const granted = await isTauriPermissionGranted();
        return granted ? 'granted' : 'denied';
      } catch {
        return 'default';
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }

    return 'denied';
  }

  /**
   * Prompts the user to grant notification permission in current environment
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (this.isElectron()) {
      return 'granted';
    }

    if (this.isMobile()) {
      await this.initAndroidChannels();
      try {
        const perm = await LocalNotifications.requestPermissions();
        return perm.display === 'granted' ? 'granted' : 'denied';
      } catch (e: any) {
        this.lastError = e?.message || 'Android notification permission request failed';
        return 'denied';
      }
    }

    if (this.isTauri()) {
      try {
        const permission = await requestTauriPermission();
        return permission === 'granted' ? 'granted' : 'denied';
      } catch (e: any) {
        this.lastError = e?.message || 'Native permission request failed';
        return 'denied';
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        return 'granted';
      }
      try {
        return await Notification.requestPermission();
      } catch (e: any) {
        this.lastError = e?.message || 'Browser permission request failed';
        return 'denied';
      }
    }

    return 'denied';
  }

  /**
   * Web Audio API synthesized Water Chime
   */
  public playWaterChime() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Note 1: E5 (659Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Note 2: B5 (987Hz) slightly delayed
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.15);
      gain2.gain.setValueAtTime(0.25, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 1.5);
    } catch (e: any) {
      console.error('Audio chime error:', e);
    }
  }

  /**
   * Web Audio API synthesized Screen Break Bell
   */
  public playScreenBell() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Deep bell / gong (440Hz + harmonic 880Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 3.0);

      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now);
      gain2.gain.setValueAtTime(0.15, now);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now);
      osc2.stop(now + 2.5);
    } catch (e: any) {
      console.error('Audio bell error:', e);
    }
  }

  /**
   * Sends real Water reminder notification
   */
  public async sendWaterNotification(onComplete?: () => void): Promise<NotificationResult> {
    const now = Date.now();
    if (now - this.lastWaterNotifyTime < 8000) {
      return { success: false, error: 'Throttled (notification sent recently)' };
    }
    this.lastWaterNotifyTime = now;
    this.lastFiredTimestamp = now;

    this.playWaterChime();

    const title = '💧 Time for water';
    const body = 'Take a 2-minute water break.';

    if (this.isMobile()) {
      await this.initAndroidChannels();
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() % 1000000),
              title,
              body,
              schedule: { at: new Date(Date.now() + 100) },
              channelId: 'eyeflow_water_channel',
              actionTypeId: 'water',
              extra: {
                category: 'water',
                slotId: `imm-water-${Date.now()}`,
              },
            },
          ],
        });
        this.lastAttemptStatus = 'success';
        this.lastError = null;
        if (onComplete) onComplete();
        return { success: true };
      } catch (err: any) {
        this.lastAttemptStatus = 'error';
        this.lastError = err?.message || 'Android notification failed';
        return { success: false, error: this.lastError! };
      }
    }

    if (this.isTauri()) {
      try {
        const perm = await this.getPermissionStatus();
        if (perm !== 'granted') {
          this.lastAttemptStatus = 'blocked';
          this.lastError = 'Native notification permission is denied';
          return { success: false, error: 'Permission denied in Windows Desktop' };
        }

        sendTauriNotification({ title, body });
        this.lastAttemptStatus = 'success';
        this.lastError = null;
        if (onComplete) onComplete();
        return { success: true };
      } catch (err: any) {
        this.lastAttemptStatus = 'error';
        this.lastError = err?.message || 'Notification execution failed';
        return { success: false, error: this.lastError! };
      }
    }

    // Web Browser Mode
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        this.lastAttemptStatus = 'blocked';
        this.lastError =
          Notification.permission === 'denied'
            ? 'Browser notifications are blocked in your browser settings'
            : 'Browser notification permission has not been granted yet';
        return { success: false, error: this.lastError };
      }

      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'eyeflow-water-reminder',
        });
        notif.onclick = () => {
          window.focus();
          if (onComplete) onComplete();
          notif.close();
        };
        this.lastAttemptStatus = 'success';
        this.lastError = null;
        return { success: true };
      } catch (err: any) {
        this.lastAttemptStatus = 'error';
        this.lastError = err?.message || 'Browser notification creation failed';
        return { success: false, error: this.lastError! };
      }
    }

    this.lastAttemptStatus = 'blocked';
    this.lastError = 'Notification API is unavailable in this environment';
    return { success: false, error: 'Notification API unavailable' };
  }

  /**
   * Sends real Screen Break reminder notification
   */
  public async sendScreenBreakNotification(onStartBreak?: () => void): Promise<NotificationResult> {
    const now = Date.now();
    if (now - this.lastScreenNotifyTime < 8000) {
      return { success: false, error: 'Throttled (notification sent recently)' };
    }
    this.lastScreenNotifyTime = now;
    this.lastFiredTimestamp = now;

    this.playScreenBell();

    const title = '👁 Look outside';
    const body = 'Give your eyes a short break from the screen.';

    if (this.isMobile()) {
      await this.initAndroidChannels();
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() % 1000000),
              title,
              body,
              schedule: { at: new Date(Date.now() + 100) },
              channelId: 'eyeflow_screen_channel',
              actionTypeId: 'screen',
              extra: {
                category: 'screen',
                slotId: `imm-screen-${Date.now()}`,
              },
            },
          ],
        });
        this.lastAttemptStatus = 'success';
        this.lastError = null;
        if (onStartBreak) onStartBreak();
        return { success: true };
      } catch (err: any) {
        this.lastAttemptStatus = 'error';
        this.lastError = err?.message || 'Android notification failed';
        return { success: false, error: this.lastError! };
      }
    }

    if (this.isTauri()) {
      try {
        const perm = await this.getPermissionStatus();
        if (perm !== 'granted') {
          this.lastAttemptStatus = 'blocked';
          this.lastError = 'Native notification permission is denied';
          return { success: false, error: 'Permission denied in Windows Desktop' };
        }

        sendTauriNotification({ title, body });
        this.lastAttemptStatus = 'success';
        this.lastError = null;
        if (onStartBreak) onStartBreak();
        return { success: true };
      } catch (err: any) {
        this.lastAttemptStatus = 'error';
        this.lastError = err?.message || 'Notification execution failed';
        return { success: false, error: this.lastError! };
      }
    }

    // Web Browser Mode
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        this.lastAttemptStatus = 'blocked';
        this.lastError =
          Notification.permission === 'denied'
            ? 'Browser notifications are blocked in your browser settings'
            : 'Browser notification permission has not been granted yet';
        return { success: false, error: this.lastError };
      }

      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'eyeflow-screen-break',
        });
        notif.onclick = () => {
          window.focus();
          if (onStartBreak) onStartBreak();
          notif.close();
        };
        this.lastAttemptStatus = 'success';
        this.lastError = null;
        return { success: true };
      } catch (err: any) {
        this.lastAttemptStatus = 'error';
        this.lastError = err?.message || 'Browser notification creation failed';
        return { success: false, error: this.lastError! };
      }
    }

    this.lastAttemptStatus = 'blocked';
    this.lastError = 'Notification API is unavailable in this environment';
    return { success: false, error: 'Notification API unavailable' };
  }

  /**
   * Sends a test notification of specified type
   */
  public async sendTestNotification(type: 'water' | 'screen'): Promise<NotificationResult> {
    if (type === 'water') {
      return this.sendWaterNotification();
    }
    return this.sendScreenBreakNotification();
  }

  /**
   * Diagnostic state inspector
   */
  public async getDiagnostics(): Promise<NotificationDiagnostics> {
    const permissionState = await this.getPermissionStatus();
    return {
      permissionState,
      isDesktop: this.isDesktop(),
      isMobile: this.isMobile(),
      isWebBrowser: !this.isDesktop() && !this.isMobile(),
      lastAttemptStatus: this.lastAttemptStatus,
      lastError: this.lastError,
      lastFiredTimestamp: this.lastFiredTimestamp,
    };
  }
}

export const notificationEngine = new NotificationService();
