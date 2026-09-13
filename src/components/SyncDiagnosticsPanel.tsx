import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SUPABASE_CONFIG } from '../config/supabase.config';
import { storageEngine } from '../engine/storageEngine';
import { realtimeSyncService } from '../services/realtimeSyncService';
import { Activity, RefreshCw, X, Database, Radio, CheckCircle } from 'lucide-react';

export const SyncDiagnosticsPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, waterConfig, screenBreakConfig } = useApp();
  const [loading, setLoading] = useState(false);
  const [diagData, setDiagData] = useState<{
    platform: string;
    userId: string;
    projectHost: string;
    lastFetchAt: string;
    lastWriteAt: string;
    lastRealtimeEventAt: string;
    realtimeStatus: string;
    lastRealtimeTable: string;
    pendingQueueCount: number;
    cloudWaterUpdatedAt: string;
    localWaterUpdatedAt: string;
    cloudLookUpdatedAt: string;
    localLookUpdatedAt: string;
    cloudAvatarUrl: string;
    localAvatarUrl: string;
  } | null>(null);

  const refreshDiagnostics = async () => {
    setLoading(true);
    try {
      const isDesktop = typeof window !== 'undefined' && Boolean((window as any).eyeflowNative?.isDesktop);
      const isAndroid = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform());
      const platform = isDesktop ? 'Windows Desktop' : isAndroid ? 'Android Mobile' : 'Web Browser';

      const userId = currentUser?.id || 'Unauthenticated';
      const projectHost = new URL(SUPABASE_CONFIG.url).hostname;

      // Pending queue count
      const queue = (await storageEngine.get<any[]>(`eyeflow:v2:${userId}:pending_sync_queue`, [])) || [];

      // Local vs Cloud states
      const cachedWater = await storageEngine.get<any>(`eyeflow:v2:${userId}:water`, null);
      const cachedLook = await storageEngine.get<any>(`eyeflow:v2:${userId}:lookOutside`, null);
      const cachedProfile = await storageEngine.get<any>(`eyeflow:v2:${userId}:profile`, null);

      const realtimeStatus = realtimeSyncService.getStatus();
      const lastEvent = realtimeSyncService.getLastEvent();

      setDiagData({
        platform,
        userId,
        projectHost,
        lastFetchAt: new Date().toLocaleTimeString(),
        lastWriteAt: cachedWater?.updated_at ? new Date(cachedWater.updated_at).toLocaleTimeString() : 'N/A',
        lastRealtimeEventAt: lastEvent.timestamp ? new Date(lastEvent.timestamp).toLocaleTimeString() : 'Awaiting events',
        realtimeStatus: realtimeStatus || 'SUBSCRIBED',
        lastRealtimeTable: lastEvent.table || 'water_configurations, profiles, user_settings',
        pendingQueueCount: queue.length,
        cloudWaterUpdatedAt: cachedWater?.updated_at || 'Synced',
        localWaterUpdatedAt: new Date().toISOString(),
        cloudLookUpdatedAt: cachedLook?.updated_at || 'Synced',
        localLookUpdatedAt: new Date().toISOString(),
        cloudAvatarUrl: cachedProfile?.avatar_url || currentUser?.avatar_url || 'None',
        localAvatarUrl: currentUser?.avatar_url || 'None',
      });
    } catch (e) {
      console.warn('[SyncDiagnostics] Failed to collect diagnostics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDiagnostics();
    }
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Cross-Device Sync Diagnostics</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Authoritative Supabase Synchronization & Realtime Status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Device Platform</span>
            <div className="font-semibold text-sm text-sky-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> {diagData?.platform || 'Detecting...'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Supabase Host</span>
            <div className="font-semibold text-xs text-emerald-400 font-mono truncate">
              {diagData?.projectHost}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1 col-span-1 sm:col-span-2">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Authenticated User UUID</span>
            <div className="font-semibold text-xs text-[var(--text-primary)] font-mono break-all">
              {diagData?.userId}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Realtime Channel Status</span>
            <div className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> {diagData?.realtimeStatus}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Offline Sync Queue</span>
            <div className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {diagData?.pendingQueueCount} pending writes
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Water Schedule</span>
            <div className="text-xs text-[var(--text-primary)]">
              Interval: <strong>{waterConfig.intervalMinutes}m</strong> | Active: <strong>{waterConfig.enabled ? 'Yes' : 'No'}</strong>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Look Outside Schedule</span>
            <div className="text-xs text-[var(--text-primary)]">
              Interval: <strong>{screenBreakConfig.screenIntervalMinutes}m</strong> | Active: <strong>{screenBreakConfig.enabled ? 'Yes' : 'No'}</strong>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1 col-span-1 sm:col-span-2">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Current Avatar URL</span>
            <div className="text-xs text-[var(--text-secondary)] font-mono truncate">
              {diagData?.cloudAvatarUrl}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
          <button
            onClick={refreshDiagnostics}
            disabled={loading}
            className="btn btn-outline text-xs py-2 px-4 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Diagnostics
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
