// Centralized Production Notification Service for PauseFlow (Windows Desktop Electron + Android Mobile + Web Mode)
import { LocalNotifications } from '@capacitor/local-notifications';
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
      'pauseflowNative' in window ||
      'eyeflowNative' in window ||
      Boolean((window as any).process?.type)
    );
  }

  public isMobile(): boolean {
    const platform = detectPlatform();
    return platform === 'android';
  }

  public isElectron(): boolean {
    return typeof window !== 'undefined' && ('pauseflowNative' in window || 'eyeflowNative' in window);
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
        id: 'pauseflow_water_channel',
        name: 'Water Reminders',
        description: 'Notifications reminding you to hydrate and take a water break',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'pauseflow_screen_channel',
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
   * Web Audio API synthesized Water Sound Selector
   */
  public playWaterSound(soundName: string = 'water') {
    if (soundName === 'none') return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      if (soundName === 'bubble') {
        // Water Bubble Pop
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
        return;
      }

      if (soundName === 'chime') {
        // Tri-tone Chime (C5, E5, G5)
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          const startTime = now + idx * 0.1;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.25, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(startTime);
          osc.stop(startTime + 1.2);
        });
        return;
      }

      if (soundName === 'soft') {
        // Soft Subtle Ping (520Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.8);
        return;
      }

      // Default 'water' Sound: Two-Tone Stream Drop (E5 -> B5)
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

  public playWaterChime() {
    this.playWaterSound('water');
  }

  /**
   * Web Audio API synthesized Look Outside Sound Selector
   */
  public playLookOutsideSound(soundName: string = 'bell') {
    if (soundName === 'none') return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      if (soundName === 'gong') {
        // Deep Zen Gong (220Hz + 330Hz + 440Hz warm resonance)
        [220, 329.63, 440].forEach((freq, idx) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          const vol = 0.35 / (idx + 1);
          gain.gain.setValueAtTime(vol, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now);
          osc.stop(now + 3.8);
        });
        return;
      }

      if (soundName === 'nature') {
        // Nature Bird Chirp
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(2600, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(1900, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.3);

        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2200, now + 0.25);
        osc2.frequency.exponentialRampToValueAtTime(3100, now + 0.35);
        osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.45);
        gain2.gain.setValueAtTime(0.2, now + 0.25);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + 0.25);
        osc2.stop(now + 0.55);
        return;
      }

      if (soundName === 'soft') {
        // Gentle Dual Tone Chime (587Hz -> 784Hz)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.4);
        return;
      }

      // Default 'bell': Deep Tibetan Bell (440Hz + 880Hz harmonic)
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

  public playScreenBell() {
    this.playLookOutsideSound('bell');
  }

  /**
   * Sends real Water reminder notification
   */
  public async sendWaterNotification(options?: {
    onComplete?: () => void;
    sound?: string;
    soundEnabled?: boolean;
  } | (() => void)): Promise<NotificationResult> {
    const onComplete = typeof options === 'function' ? options : options?.onComplete;
    const sound = typeof options === 'object' && options?.sound ? options.sound : 'water';
    const soundEnabled = typeof options === 'object' && options?.soundEnabled !== undefined ? options.soundEnabled : true;

    const now = Date.now();
    if (now - this.lastWaterNotifyTime < 8000) {
      return { success: false, error: 'Throttled (notification sent recently)' };
    }
    this.lastWaterNotifyTime = now;
    this.lastFiredTimestamp = now;

    if (soundEnabled && sound !== 'none') {
      this.playWaterSound(sound);
    }

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
              smallIcon: 'pauseflow_notification',
              iconColor: '#0284c7',
              schedule: { at: new Date(Date.now() + 100) },
              channelId: 'pauseflow_water_channel',
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

    // Web Browser / Electron Desktop Notification Mode
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
          tag: 'pauseflow-water-reminder',
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
  public async sendScreenBreakNotification(options?: {
    onStartBreak?: () => void;
    sound?: string;
    soundEnabled?: boolean;
  } | (() => void)): Promise<NotificationResult> {
    const onStartBreak = typeof options === 'function' ? options : options?.onStartBreak;
    const sound = typeof options === 'object' && options?.sound ? options.sound : 'bell';
    const soundEnabled = typeof options === 'object' && options?.soundEnabled !== undefined ? options.soundEnabled : true;

    const now = Date.now();
    if (now - this.lastScreenNotifyTime < 8000) {
      return { success: false, error: 'Throttled (notification sent recently)' };
    }
    this.lastScreenNotifyTime = now;
    this.lastFiredTimestamp = now;

    if (soundEnabled && sound !== 'none') {
      this.playLookOutsideSound(sound);
    }

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
              smallIcon: 'pauseflow_notification',
              iconColor: '#0284c7',
              schedule: { at: new Date(Date.now() + 100) },
              channelId: 'pauseflow_screen_channel',
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

    // Web Browser / Electron Desktop Notification Mode
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
          tag: 'pauseflow-screen-reminder',
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
          tag: 'pauseflow-screen-break',
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
