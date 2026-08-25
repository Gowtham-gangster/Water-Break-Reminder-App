// System Lifecycle & Platform Detection for EyeFlow (Windows Desktop Electron, Android Capacitor, Web)
import type { PlatformType, PlatformCapabilities, ISystemLifecycleService } from './types';

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'web';

  // Windows Desktop (Electron)
  if ((window as any).eyeflowNative?.isDesktop) {
    return 'windows';
  }

  // Android Capacitor / WebView / Native wrapper
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  if (/android/i.test(userAgent) || (window as any).Capacitor?.getPlatform() === 'android') {
    return 'android';
  }

  return 'web';
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const platform = detectPlatform();
  const isDesktop = platform === 'windows';
  const isMobile = platform === 'android';

  return {
    platform,
    isDesktop,
    isMobile,
    hasNativeScheduler: isDesktop || isMobile,
    hasLocalNotifications: isDesktop || isMobile || 'Notification' in window,
    hasSystemTray: isDesktop,
    supportsBackgroundExecution: isDesktop || isMobile,
  };
}

class SystemLifecycleService implements ISystemLifecycleService {
  private lastDateStr: string = new Date().toISOString().split('T')[0];

  public getPlatform(): PlatformType {
    return detectPlatform();
  }

  public getCapabilities(): PlatformCapabilities {
    return getPlatformCapabilities();
  }

  public onForeground(callback: () => void): () => void {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        callback();
      }
    };
    window.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', callback);
    return () => {
      window.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', callback);
    };
  }

  public onBackground(callback: () => void): () => void {
    const handleHidden = () => {
      if (document.visibilityState === 'hidden') {
        callback();
      }
    };
    window.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('blur', callback);
    return () => {
      window.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('blur', callback);
    };
  }

  public onPowerResume(callback: () => void): () => void {
    window.addEventListener('pageshow', callback);
    window.addEventListener('online', callback);
    return () => {
      window.removeEventListener('pageshow', callback);
      window.removeEventListener('online', callback);
    };
  }

  public onMidnightRollover(callback: () => void): () => void {
    const interval = setInterval(() => {
      const current = new Date().toISOString().split('T')[0];
      if (this.lastDateStr !== current) {
        this.lastDateStr = current;
        callback();
      }
    }, 30000);

    return () => clearInterval(interval);
  }
}

export const systemLifecycle = new SystemLifecycleService();
