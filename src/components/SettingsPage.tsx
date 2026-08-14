import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { notificationEngine, type NotificationDiagnostics } from '../engine/notificationEngine';
import { Card, Button, Toggle, TimePicker, Badge, useToast } from './ui';
import {
  Settings,
  Bell,
  Droplets,
  Eye,
  Palette,
  Shield,
  Download,
  Info,
  Sparkles,
  AlertTriangle,
  Play,
  Monitor,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    generalSettings,
    setGeneralSettings,
    notificationSettings,
    setNotificationSettings,
    waterConfig,
    setWaterConfig,
    screenBreakConfig,
    setScreenBreakConfig,
    startPreview,
    trigger10SecRealTest,
    resetTodayData,
    nextWaterSlot,
    nextScreenSlot,
    currentDeviceTimestamp,
  } = useApp();

  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<
    'experience' | 'notifications' | 'general' | 'water' | 'screen' | 'appearance' | 'privacy' | 'about'
  >('experience');

  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);

  const refreshDiagnostics = async () => {
    const diag = await notificationEngine.getDiagnostics();
    setDiagnostics(diag);
  };

  useEffect(() => {
    refreshDiagnostics();
  }, [activeSubTab]);

  const handleRequestPermission = async () => {
    const perm = await notificationEngine.requestPermission();
    await refreshDiagnostics();
    if (perm === 'granted') {
      showToast('Notification permission enabled ✓', 'success');
    } else {
      showToast('Notification permission was not granted.', 'warning');
    }
  };

  const exportDataJSON = () => {
    const data = {
      waterConfig,
      screenBreakConfig,
      generalSettings,
      notificationSettings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eyeflow_backup_${Date.now()}.json`;
    a.click();
    showToast('Settings exported successfully!', 'success');
  };

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Manage your reminders, preferences, and notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Navigation Sub-Tabs */}
        <div className="md:col-span-4 space-y-1">
          {[
            { id: 'experience' as const, label: 'Reminder Experience', icon: Monitor },
            { id: 'notifications' as const, label: 'Notifications', icon: Bell },
            { id: 'general' as const, label: 'General', icon: Settings },
            { id: 'water' as const, label: 'Water', icon: Droplets },
            { id: 'screen' as const, label: 'Look Outside', icon: Eye },
            { id: 'appearance' as const, label: 'Theme', icon: Palette },
            { id: 'privacy' as const, label: 'Privacy & Backup', icon: Shield },
            { id: 'about' as const, label: 'About', icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="md:col-span-8">
          {/* 1. REMINDER EXPERIENCE SUBTAB */}
          {activeSubTab === 'experience' && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <h2 className="font-semibold text-base text-[var(--text-primary)]">
                  Reminder Experience
                </h2>
                <Badge variant="screen">Automated</Badge>
              </div>

              {/* Platform Status Cards */}
              <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Platform Display:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {diagnostics?.isDesktop ? 'Windows Desktop (Native Daemon)' : 'Web / Desktop'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">System Notifications:</span>
                  <span
                    className={`font-semibold ${
                      diagnostics?.permissionState === 'granted'
                        ? 'text-[var(--success-primary)]'
                        : 'text-[var(--warning-primary)]'
                    }`}
                  >
                    {diagnostics?.permissionState === 'granted'
                      ? '✓ Notifications enabled'
                      : '⚠ Notifications ungranted'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">Full-Screen Overlay:</span>
                  <span className="font-semibold text-[var(--success-primary)]">
                    ✓ Available (Non-locking, Alt+Tab supported)
                  </span>
                </div>
              </div>

              {/* Reminder Presentation Styles */}
              <div className="space-y-4 pt-1">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block">
                    Look Outside Reminder Style
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setScreenBreakConfig({ ...screenBreakConfig, reminderStyle: 'fullscreen' })
                      }
                      className={`p-3 rounded-[var(--radius-md)] border text-left text-xs font-semibold transition-all cursor-pointer ${
                        screenBreakConfig.reminderStyle !== 'notification'
                          ? 'bg-[var(--screen-subtle)] border-[var(--screen-primary)] text-[var(--screen-primary)] shadow-sm'
                          : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span className="block font-bold">Full-Screen Overlay</span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        Automated overlay with countdown
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setScreenBreakConfig({ ...screenBreakConfig, reminderStyle: 'notification' })
                      }
                      className={`p-3 rounded-[var(--radius-md)] border text-left text-xs font-semibold transition-all cursor-pointer ${
                        screenBreakConfig.reminderStyle === 'notification'
                          ? 'bg-[var(--screen-subtle)] border-[var(--screen-primary)] text-[var(--screen-primary)] shadow-sm'
                          : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span className="block font-bold">Notification Only</span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        Desktop banner only
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] block">
                    Water Reminder Style
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setWaterConfig({ ...waterConfig, reminderStyle: 'popup' })
                      }
                      className={`p-3 rounded-[var(--radius-md)] border text-left text-xs font-semibold transition-all cursor-pointer ${
                        waterConfig.reminderStyle === 'popup'
                          ? 'bg-[var(--water-subtle)] border-[var(--water-primary)] text-[var(--water-primary)] shadow-sm'
                          : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span className="block font-bold">Automated Popup</span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        Disappears automatically
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setWaterConfig({ ...waterConfig, reminderStyle: 'notification' })
                      }
                      className={`p-3 rounded-[var(--radius-md)] border text-left text-xs font-semibold transition-all cursor-pointer ${
                        waterConfig.reminderStyle !== 'popup'
                          ? 'bg-[var(--water-subtle)] border-[var(--water-primary)] text-[var(--water-primary)] shadow-sm'
                          : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span className="block font-bold">Notification Only</span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        Desktop banner alert
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Developer & Test Triggers */}
              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Live Scheduler Diagnostics & Real Device Clock
                </span>

                {/* Real-time Dynamic Diagnostics Box */}
                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2 font-mono text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between">
                    <span>Device Local Time:</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {new Date(currentDeviceTimestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Device Timezone:</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Water Next Occurrence:</span>
                    <span className="font-bold text-[var(--water-primary)]">
                      {nextWaterSlot ? nextWaterSlot.time : 'None / Finished for today'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Screen Break Next Occurrence:</span>
                    <span className="font-bold text-[var(--screen-primary)]">
                      {nextScreenSlot ? nextScreenSlot.time : 'None / Finished for today'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <Button
                    variant="screen"
                    size="sm"
                    onClick={() => {
                      startPreview('screen', 10);
                      showToast('Started 10s Look Outside preview (zero history effect)', 'info');
                    }}
                    leftIcon={<Play className="w-3.5 h-3.5" />}
                  >
                    Preview Break (10s)
                  </Button>

                  <Button
                    variant="water"
                    size="sm"
                    onClick={() => {
                      startPreview('water', 10);
                      showToast('Started 10s Water preview (zero history effect)', 'info');
                    }}
                    leftIcon={<Play className="w-3.5 h-3.5" />}
                  >
                    Preview Water (10s)
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      trigger10SecRealTest('screen');
                      showToast('REAL break scheduled in 10s (will update real history)', 'info');
                    }}
                    leftIcon={<Play className="w-3.5 h-3.5 text-[var(--screen-primary)]" />}
                  >
                    Fire REAL Break in 10s
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await resetTodayData();
                      showToast("Today's test reminder data reset cleanly ✓", 'success');
                    }}
                    leftIcon={<Sparkles className="w-3.5 h-3.5 text-[var(--warning-primary)]" />}
                  >
                    Reset today's test data
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 2. NOTIFICATIONS SUBTAB */}
          {activeSubTab === 'notifications' && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <h2 className="font-semibold text-base text-[var(--text-primary)]">
                  Notification Settings
                </h2>
                <Badge
                  variant={diagnostics?.permissionState === 'granted' ? 'success' : 'danger'}
                  dot
                >
                  {diagnostics?.permissionState === 'granted' ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              {diagnostics?.permissionState !== 'granted' && (
                <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--danger-subtle)] text-xs text-[var(--danger-primary)] space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Notifications are blocked or ungranted.</span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    EyeFlow cannot show desktop alerts until permission is enabled in browser or
                    Windows system settings.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <Toggle
                  label="Enable Notifications"
                  description="Receive alert banners when it's time for water or a screen break."
                  checked={notificationSettings.enabled}
                  onChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, enabled: checked })
                  }
                  variant="water"
                />

                <Toggle
                  label="Audio Chimes"
                  description="Play soft water chimes and meditation bells on reminders."
                  checked={notificationSettings.soundEnabled}
                  onChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, soundEnabled: checked })
                  }
                  variant="water"
                />
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRequestPermission}
                  leftIcon={<Bell className="w-3.5 h-3.5" />}
                >
                  Request permission
                </Button>
              </div>
            </Card>
          )}

          {/* 3. GENERAL SUBTAB */}
          {activeSubTab === 'general' && (
            <Card variant="default" padding="lg" className="space-y-5">
              <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
                General Settings
              </h2>

              <div className="space-y-4">
                <Toggle
                  label="Start on system startup"
                  description="Automatically start reminders when Windows boots up."
                  checked={generalSettings.startOnStartup}
                  onChange={(checked) =>
                    setGeneralSettings({ ...generalSettings, startOnStartup: checked })
                  }
                />

                <Toggle
                  label="Minimize to system tray"
                  description="Closing window minimizes EyeFlow to the notification tray."
                  checked={generalSettings.minimizeToTray}
                  onChange={(checked) =>
                    setGeneralSettings({ ...generalSettings, minimizeToTray: checked })
                  }
                />
              </div>
            </Card>
          )}

          {/* 4. WATER SUBTAB */}
          {activeSubTab === 'water' && (
            <Card variant="default" padding="lg" className="space-y-5">
              <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
                Water Schedule
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <TimePicker
                  label="Start time"
                  value={waterConfig.startTime}
                  onChange={(e) => setWaterConfig({ ...waterConfig, startTime: e.target.value })}
                />
                <TimePicker
                  label="End time"
                  value={waterConfig.endTime}
                  onChange={(e) => setWaterConfig({ ...waterConfig, endTime: e.target.value })}
                />
              </div>
            </Card>
          )}

          {/* 5. SCREEN BREAK SUBTAB */}
          {activeSubTab === 'screen' && (
            <Card variant="default" padding="lg" className="space-y-5">
              <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
                Look Outside Schedule
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <TimePicker
                  label="Start time"
                  value={screenBreakConfig.startTime}
                  onChange={(e) =>
                    setScreenBreakConfig({ ...screenBreakConfig, startTime: e.target.value })
                  }
                />
                <TimePicker
                  label="End time"
                  value={screenBreakConfig.endTime}
                  onChange={(e) =>
                    setScreenBreakConfig({ ...screenBreakConfig, endTime: e.target.value })
                  }
                />
              </div>
            </Card>
          )}

          {/* 6. THEME SUBTAB */}
          {activeSubTab === 'appearance' && (
            <Card variant="default" padding="lg" className="space-y-5">
              <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
                Appearance
              </h2>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light' as const, label: 'Light' },
                  { id: 'dark' as const, label: 'Dark' },
                  { id: 'system' as const, label: 'System' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setGeneralSettings({ ...generalSettings, theme: mode.id })}
                    className={`p-3.5 rounded-[var(--radius-md)] border font-semibold text-xs transition-all cursor-pointer ${
                      generalSettings.theme === mode.id
                        ? 'bg-[var(--bg-subtle)] border-[var(--text-primary)] text-[var(--text-primary)] shadow-sm'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* 7. PRIVACY SUBTAB */}
          {activeSubTab === 'privacy' && (
            <Card variant="default" padding="lg" className="space-y-5">
              <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
                Privacy & Data
              </h2>

              <div className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] block">
                    Local Data Backup
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Download settings & logs JSON backup
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportDataJSON}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Export Data
                </Button>
              </div>
            </Card>
          )}

          {/* 8. ABOUT SUBTAB */}
          {activeSubTab === 'about' && (
            <Card variant="default" padding="lg" className="space-y-3 text-center py-6">
              <div className="w-12 h-12 rounded-xl bg-[var(--text-primary)] text-[var(--bg-page)] flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">EyeFlow</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Drink. Look Away. Feel Better.
                </p>
                <p className="text-xs text-[var(--text-secondary)] pt-1 max-w-xs mx-auto">
                  A calm, simple companion for staying hydrated and relaxing your eyes.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
