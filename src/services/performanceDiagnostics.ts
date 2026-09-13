// src/services/performanceDiagnostics.ts
// PauseFlow V2 — Real-Time Performance & Synchronization Latency Instrumentation

export interface SyncPerformanceMetrics {
  localUiLatencyMs: number;
  supabaseWriteLatencyMs: number;
  realtimeDeliveryLatencyMs: number;
  crossDeviceUpdateLatencyMs: number;
  startupLocalCacheLatencyMs: number;
  backgroundSyncLatencyMs: number;
  unnecessaryFullTableQueries: number;
  duplicateRealtimeSubscriptions: number;
  lastUpdated: string;
}

class PerformanceDiagnosticsService {
  private metrics: SyncPerformanceMetrics = {
    localUiLatencyMs: 0,
    supabaseWriteLatencyMs: 0,
    realtimeDeliveryLatencyMs: 0,
    crossDeviceUpdateLatencyMs: 0,
    startupLocalCacheLatencyMs: 0,
    backgroundSyncLatencyMs: 0,
    unnecessaryFullTableQueries: 0,
    duplicateRealtimeSubscriptions: 0,
    lastUpdated: new Date().toISOString(),
  };

  private writeTimestamps = new Map<string, number>();

  public markLocalUiUpdate(durationMs: number): void {
    this.metrics.localUiLatencyMs = Math.max(0, Math.round(durationMs * 10) / 10);
    this.metrics.lastUpdated = new Date().toISOString();
  }

  public recordWriteStart(key: string): void {
    this.writeTimestamps.set(key, performance.now());
  }

  public recordWriteEnd(key: string): number {
    const start = this.writeTimestamps.get(key);
    if (start) {
      const elapsed = Math.round(performance.now() - start);
      this.writeTimestamps.delete(key);
      this.metrics.supabaseWriteLatencyMs = elapsed;
      this.metrics.lastUpdated = new Date().toISOString();
      return elapsed;
    }
    return 0;
  }

  public markRealtimeDelivery(deliveryLatencyMs: number): void {
    this.metrics.realtimeDeliveryLatencyMs = Math.max(0, Math.round(deliveryLatencyMs));
    this.metrics.crossDeviceUpdateLatencyMs = Math.max(
      this.metrics.realtimeDeliveryLatencyMs + this.metrics.localUiLatencyMs,
      Math.round(deliveryLatencyMs)
    );
    this.metrics.lastUpdated = new Date().toISOString();
  }

  public markStartupLocalCache(latencyMs: number): void {
    this.metrics.startupLocalCacheLatencyMs = Math.round(latencyMs);
    this.metrics.lastUpdated = new Date().toISOString();
  }

  public markBackgroundSync(latencyMs: number): void {
    this.metrics.backgroundSyncLatencyMs = Math.round(latencyMs);
    this.metrics.lastUpdated = new Date().toISOString();
  }

  public getMetrics(): SyncPerformanceMetrics {
    return { ...this.metrics };
  }

  public printDiagnosticSummary(): void {
    console.log('==============================================');
    console.log('  PAUSEFLOW SYNC PERFORMANCE INSTRUMENTATION   ');
    console.log('==============================================');
    console.log(`Local UI update latency        : ${this.metrics.localUiLatencyMs} ms`);
    console.log(`Supabase write latency         : ${this.metrics.supabaseWriteLatencyMs} ms`);
    console.log(`Realtime delivery latency      : ${this.metrics.realtimeDeliveryLatencyMs} ms`);
    console.log(`Cross-device update latency    : ${this.metrics.crossDeviceUpdateLatencyMs} ms`);
    console.log(`Startup local-cache latency    : ${this.metrics.startupLocalCacheLatencyMs} ms`);
    console.log(`Background sync latency        : ${this.metrics.backgroundSyncLatencyMs} ms`);
    console.log(`Unnecessary full-table queries : ${this.metrics.unnecessaryFullTableQueries}`);
    console.log(`Duplicate subscriptions        : ${this.metrics.duplicateRealtimeSubscriptions}`);
    console.log('==============================================');
  }
}

export const performanceDiagnostics = new PerformanceDiagnosticsService();
