// src/services/deviceService.ts
// PauseFlow V2 — Supabase Device Registration, Identification & Sync Service

import { supabase } from './supabaseClient.ts';
import type { DeviceRegistrationEntity } from '../types/index.ts';

export class DeviceService {
  private static DEVICE_ID_KEY = 'pauseflow:device_id';
  private static LEGACY_DEVICE_ID_KEY = 'eyeflow:device_id';

  /**
   * Generates or retrieves a persistent RFC4122 v4 unique identifier for this client device
   */
  public getDeviceId(): string {
    if (typeof window === 'undefined') return 'server_device';
    try {
      let id = localStorage.getItem(DeviceService.DEVICE_ID_KEY);
      if (!id) {
        id = localStorage.getItem(DeviceService.LEGACY_DEVICE_ID_KEY);
        if (id) {
          localStorage.setItem(DeviceService.DEVICE_ID_KEY, id);
        }
      }
      if (!id) {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          id = crypto.randomUUID();
        } else {
          id = 'dev-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
        }
        localStorage.setItem(DeviceService.DEVICE_ID_KEY, id);
      }
      return id;
    } catch (_) {
      return 'fallback_device_id';
    }
  }

  /**
   * Auto-detects the client runtime platform
   */
  public getCurrentPlatform(): 'windows' | 'android' | 'web' | 'macos' | 'linux' | 'ios' {
    if (typeof window === 'undefined') return 'web';

    // 1. Electron Desktop Environment
    const desktopBridge = (window as any).pauseflowNative || (window as any).eyeflowNative;
    if (desktopBridge?.isDesktop) {
      const p = desktopBridge?.platform || '';
      if (p === 'win32' || p === 'windows') return 'windows';
      if (p === 'darwin') return 'macos';
      if (p === 'linux') return 'linux';
      return 'windows';
    }

    // 2. Capacitor Android / iOS Environment
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const capPlatform = (window as any).Capacitor?.getPlatform?.();
      if (capPlatform === 'android') return 'android';
      if (capPlatform === 'ios') return 'ios';
    }

    // 3. Browser User Agent Detection
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
    if (/Linux/i.test(ua)) return 'linux';

    return 'web';
  }

  /**
   * Generates a descriptive device name
   */
  public getDeviceName(): string {
    const platform = this.getCurrentPlatform();
    if (platform === 'windows') return 'Windows Laptop';
    if (platform === 'android') return 'Android Phone';
    if (platform === 'ios') return 'iPhone';
    if (platform === 'macos') return 'MacBook / Mac';
    if (platform === 'linux') return 'Linux Desktop';
    return 'Web Browser';
  }

  /**
   * Register or update the current device for the authenticated user
   */
  public async registerDevice(
    userId: string,
    deviceId: string,
    platform: 'windows' | 'android' | 'web' | 'macos' | 'linux' | 'ios',
    deviceName?: string
  ): Promise<{ device: DeviceRegistrationEntity | null; error: string | null }> {
    if (!userId) return { device: null, error: 'User ID is required to register device.' };

    try {
      const { data, error } = await ((supabase
        .from('device_registrations') as any)
        .upsert(
          {
            user_id: userId,
            device_id: deviceId,
            platform,
            device_name: deviceName || `${platform}-device`,
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,device_id' }
        )
        .select() as any);

      if (error) {
        console.warn('[DeviceService] Cloud device registration warning:', error.message);
        return { device: null, error: error.message };
      }
      const deviceEntity = Array.isArray(data) ? data[0] : data;
      return { device: (deviceEntity as DeviceRegistrationEntity) || null, error: null };
    } catch (err: any) {
      console.warn('[DeviceService] Failed to register device exception:', err);
      return { device: null, error: err?.message || 'Failed to register device.' };
    }
  }

  /**
   * Registers the currently running client device for the active user
   */
  public async registerCurrentDevice(userId: string): Promise<{ device: DeviceRegistrationEntity | null; error: string | null }> {
    const deviceId = this.getDeviceId();
    const platform = this.getCurrentPlatform();
    const deviceName = this.getDeviceName();
    return this.registerDevice(userId, deviceId, platform, deviceName);
  }

  /**
   * Fetch all registered devices for the user
   */
  public async getUserDevices(userId: string): Promise<{ devices: DeviceRegistrationEntity[]; error: string | null }> {
    if (!userId) return { devices: [], error: 'User ID is required.' };
    try {
      const { data, error } = await ((supabase
        .from('device_registrations') as any)
        .select('*')
        .eq('user_id', userId)
        .order('last_sync_at', { ascending: false }) as any);

      if (error) return { devices: [], error: error.message };
      return { devices: (data as DeviceRegistrationEntity[]) || [], error: null };
    } catch (err: any) {
      return { devices: [], error: err?.message || 'Failed to fetch devices.' };
    }
  }

  /**
   * Update heartbeat / last sync timestamp
   */
  public async updateSyncTimestamp(userId: string, deviceId: string): Promise<void> {
    if (!userId || !deviceId) return;
    try {
      await ((supabase
        .from('device_registrations') as any)
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('device_id', deviceId) as any);
    } catch (err) {
      console.warn('[DeviceService] Failed to update sync timestamp:', err);
    }
  }
}

export const deviceService = new DeviceService();
