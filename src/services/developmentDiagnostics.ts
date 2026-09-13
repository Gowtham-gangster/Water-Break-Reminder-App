// src/services/developmentDiagnostics.ts
// EyeFlow V2 — Comprehensive Development-Only Diagnostics & Cross-Device Sync Status Monitor
// (Zero exposure of tokens, secrets, or private keys)

export interface SyncStatusItem {
  status: 'IDLE' | 'CHECKING' | 'READY' | 'SYNCED' | 'SUBSCRIBED' | 'ERROR' | 'OFFLINE';
  lastUpdated: string | null;
  detail?: string;
}

export interface SystemDiagnosticsState {
  auth: SyncStatusItem;
  profileFetch: SyncStatusItem;
  profileRealtime: SyncStatusItem;
  waterConfigFetch: SyncStatusItem;
  waterConfigRealtime: SyncStatusItem;
  lookOutsideConfigFetch: SyncStatusItem;
  lookOutsideRealtime: SyncStatusItem;
  reminderEventFetch: SyncStatusItem;
  reminderEventRealtime: SyncStatusItem;
  lastAuthoritativeSyncTime: string | null;
  lastEventReceived: string | null;
  lastProfileReceived: string | null;
  lastConfigReceived: string | null;
  platform: string;
  timezone: string;
}

class DevelopmentDiagnosticsService {
  private state: SystemDiagnosticsState = {
    auth: { status: 'CHECKING', lastUpdated: null },
    profileFetch: { status: 'IDLE', lastUpdated: null },
    profileRealtime: { status: 'IDLE', lastUpdated: null },
    waterConfigFetch: { status: 'IDLE', lastUpdated: null },
    waterConfigRealtime: { status: 'IDLE', lastUpdated: null },
    lookOutsideConfigFetch: { status: 'IDLE', lastUpdated: null },
    lookOutsideRealtime: { status: 'IDLE', lastUpdated: null },
    reminderEventFetch: { status: 'IDLE', lastUpdated: null },
    reminderEventRealtime: { status: 'IDLE', lastUpdated: null },
    lastAuthoritativeSyncTime: null,
    lastEventReceived: null,
    lastProfileReceived: null,
    lastConfigReceived: null,
    platform: typeof window !== 'undefined' && (window as any).eyeflowNative ? 'windows' : 'web',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  };

  private listeners: Set<(state: SystemDiagnosticsState) => void> = new Set();

  public getState(): SystemDiagnosticsState {
    return { ...this.state };
  }

  public subscribe(listener: (state: SystemDiagnosticsState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const copy = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(copy);
      } catch (_) {}
    });
  }

  public setAuthStatus(status: SyncStatusItem['status'], detail?: string) {
    this.state.auth = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`AUTH: ${status}${detail ? ` (${detail})` : ''}`);
    this.notify();
  }

  public setProfileFetch(status: SyncStatusItem['status'], detail?: string) {
    this.state.profileFetch = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`PROFILE FETCH: ${status}`);
    this.notify();
  }

  public setProfileRealtime(status: SyncStatusItem['status'], detail?: string) {
    this.state.profileRealtime = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`PROFILE REALTIME: ${status}`);
    this.notify();
  }

  public setWaterConfigFetch(status: SyncStatusItem['status'], detail?: string) {
    this.state.waterConfigFetch = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`WATER CONFIG: ${status}`);
    this.notify();
  }

  public setWaterConfigRealtime(status: SyncStatusItem['status'], detail?: string) {
    this.state.waterConfigRealtime = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`WATER CONFIG REALTIME: ${status}`);
    this.notify();
  }

  public setLookOutsideConfigFetch(status: SyncStatusItem['status'], detail?: string) {
    this.state.lookOutsideConfigFetch = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`LOOK OUTSIDE CONFIG: ${status}`);
    this.notify();
  }

  public setLookOutsideRealtime(status: SyncStatusItem['status'], detail?: string) {
    this.state.lookOutsideRealtime = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`LOOK OUTSIDE REALTIME: ${status}`);
    this.notify();
  }

  public setReminderEventFetch(status: SyncStatusItem['status'], detail?: string) {
    this.state.reminderEventFetch = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`EVENTS FETCH: ${status}`);
    this.notify();
  }

  public setReminderEventRealtime(status: SyncStatusItem['status'], detail?: string) {
    this.state.reminderEventRealtime = { status, lastUpdated: new Date().toISOString(), detail };
    this.log(`EVENT REALTIME: ${status}`);
    this.notify();
  }

  public markAuthoritativeSync(timeIso = new Date().toISOString()) {
    this.state.lastAuthoritativeSyncTime = timeIso;
    this.log(`LAST AUTHORITATIVE SYNC: ${timeIso}`);
    this.notify();
  }

  public recordEventReceived(detail?: string) {
    const timeIso = new Date().toISOString();
    this.state.lastEventReceived = timeIso;
    this.log(`LAST EVENT RECEIVED: ${timeIso}${detail ? ` - ${detail}` : ''}`);
    this.notify();
  }

  public recordProfileReceived(detail?: string) {
    const timeIso = new Date().toISOString();
    this.state.lastProfileReceived = timeIso;
    this.log(`LAST PROFILE RECEIVED: ${timeIso}${detail ? ` - ${detail}` : ''}`);
    this.notify();
  }

  public recordConfigReceived(detail?: string) {
    const timeIso = new Date().toISOString();
    this.state.lastConfigReceived = timeIso;
    this.log(`LAST CONFIG RECEIVED: ${timeIso}${detail ? ` - ${detail}` : ''}`);
    this.notify();
  }

  private log(message: string) {
    if (typeof window !== 'undefined') {
      console.log(`[EyeFlow Diagnostics] ${message}`);
    }
  }
}

export const developmentDiagnostics = new DevelopmentDiagnosticsService();
