// Platform Notification Service (Windows Desktop Electron, Android Capacitor, Web)
import type { INotificationService, NotificationPayload } from './types';
import { detectPlatform } from './systemLifecycle';
import { androidScheduler } from './androidScheduler';
import { LocalNotifications } from '@capacitor/local-notifications';

// Audio Synthesizer Fallback for Clean Harmonic Alerts
function playSynthesizedTone(freqs: number[], durations: number[]) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durations[idx] || 0.4));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.15);
      osc.stop(ctx.currentTime + idx * 0.15 + (durations[idx] || 0.4));
    });
  } catch (_) {}
}

class WindowsNotificationService implements INotificationService {
  async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    return 'granted'; // Electron handles desktop notifications natively
  }

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async sendImmediate(payload: NotificationPayload): Promise<void> {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/favicon.ico',
        });
      } catch (_) {}
    }
  }

  playWaterChime(): void {
    playSynthesizedTone([523.25, 659.25, 783.99], [0.3, 0.3, 0.5]);
  }

  playScreenBell(): void {
    playSynthesizedTone([440.0, 554.37, 659.25], [0.35, 0.35, 0.6]);
  }
}

class AndroidNotificationService implements INotificationService {
  async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    return await androidScheduler.checkNotificationPermission();
  }

  async requestPermission(): Promise<boolean> {
    return await androidScheduler.requestNotificationPermission();
  }

  async sendImmediate(payload: NotificationPayload): Promise<void> {
    await androidScheduler.initChannels();
    try {
      const channelId = payload.category === 'water' ? 'eyeflow_water_channel' : 'eyeflow_screen_channel';
      await LocalNotifications.schedule({
        notifications: [
          {
            title: payload.title,
            body: payload.body,
            id: Math.floor(Date.now() % 900000) + 10000,
            schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true },
            channelId,
            actionTypeId: payload.category,
            extra: {
              category: payload.category,
              slotId: payload.slotId || `imm-${Date.now()}`,
              durationSeconds: 120,
              scheduledTimestamp: Date.now(),
            },
          },
        ],
      });
    } catch (e) {
      console.error('[AndroidNotificationService] sendImmediate error:', e);
    }
  }

  playWaterChime(): void {
    playSynthesizedTone([523.25, 659.25, 783.99], [0.3, 0.3, 0.5]);
  }

  playScreenBell(): void {
    playSynthesizedTone([440.0, 554.37, 659.25], [0.35, 0.35, 0.6]);
  }
}

class WebNotificationService implements INotificationService {
  async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'prompt';
  }

  async requestPermission(): Promise<boolean> {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  async sendImmediate(payload: NotificationPayload): Promise<void> {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(payload.title, {
          body: payload.body,
        });
      } catch (_) {}
    }
  }

  playWaterChime(): void {
    playSynthesizedTone([523.25, 659.25, 783.99], [0.3, 0.3, 0.5]);
  }

  playScreenBell(): void {
    playSynthesizedTone([440.0, 554.37, 659.25], [0.35, 0.35, 0.6]);
  }
}

export function createNotificationService(): INotificationService {
  const platform = detectPlatform();
  if (platform === 'windows') {
    return new WindowsNotificationService();
  }
  if (platform === 'android') {
    return new AndroidNotificationService();
  }
  return new WebNotificationService();
}

export const notificationService = createNotificationService();
