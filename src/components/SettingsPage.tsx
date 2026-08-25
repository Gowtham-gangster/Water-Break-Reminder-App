import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { notificationEngine, type NotificationDiagnostics } from '../engine/notificationEngine';
import { androidScheduler, type AndroidSchedulerDiagnostics } from '../platform/androidScheduler';
import { detectPlatform } from '../platform/systemLifecycle';
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
  Monitor,
  Activity,
  Zap,
  Smartphone,
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
    nextWaterSlot,
    nextScreenSlot,
    currentDeviceTimestamp,
  } = useApp();

  const { showToast } = useToast();

  const isAndroid = detectPlatform() === 'android';

  const [activeSubTab, setActiveSubTab] = useState<
    'experience' | 'notifications' | 'diagnostics' | 'general' | 'water' | 'screen' | 'appearance' | 'privacy' | 'about'
  >('experience');

  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);
  const [androidDiag, setAndroidDiag] = useState<AndroidSchedulerDiagnostics | null>(null);
  const [isTestingAlarm, setIsTestingAlarm] = useState(false);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);

  const refreshDiagnostics = async () => {
    const diag = await notificationEngine.getDiagnostics();
    setDiagnostics(diag);

    if (detectPlatform() === 'android') {
      const aDiag = await androidScheduler.getDiagnostics();
      setAndroidDiag(aDiag);
    }
  };

  useEffect(() => {
    refreshDiagnostics();
  }, [activeSubTab, currentDeviceTimestamp]);

  const handleRequestPermission = async () => {
    const perm = await notificationEngine.requestPermission();
    await refreshDiagnostics();
    if (perm === 'granted') {
      showToast('Notification permission enabled ✓', 'success');
    } else {
      showToast('Notification permission was not granted.', 'warning');
    }
  };

  const handleOpenExactAlarmSettings = async () => {
    await androidScheduler.openExactAlarmSettings();
    showToast('Opening Android Alarms & Reminders settings...', 'info');
  };

  const handleOpenBatterySettings = async () => {
    await androidScheduler.openBatteryOptimizationSettings();
    showToast('Opening Android Battery Optimization settings...', 'info');
  };

  const handleTest30SecReminder = async (type: 'water' | 'screen' = 'water') => {
    setIsTestingAlarm(true);
    setTestResultMsg(null);
    const res = await androidScheduler.scheduleTestReminder(30, type);
    setIsTestingAlarm(false);
    if (res.success) {
      setTestResultMsg(
        `✓ Notification reminder scheduled for ${new Date(res.timestamp).toLocaleTimeString()} (ID: ${res.id}). Close EyeFlow or lock your phone to test background delivery!`
      );
      showToast('Notification scheduled for 30s!', 'success');
      await refreshDiagnostics();
    } else {
      setTestResultMsg(`✗ Failed to schedule: ${res.error}`);
      showToast(`Test failed: ${res.error}`, 'error');
    }
  };

  const handleTest2MinExactReminder = async () => {
    setIsTestingAlarm(true);
    setTestResultMsg(null);
    const canExact = await androidScheduler.checkExactAlarmPermission();
    if (!canExact) {
      setIsTestingAlarm(false);
      setTestResultMsg('⚠ Precise reminder permission is not enabled. Tap "Enable Precise Reminders" below.');
      showToast('Precise reminder permission required!', 'warning');
      return;
    }
    const res = await androidScheduler.scheduleTestReminder(120, 'water');
    setIsTestingAlarm(false);
    if (res.success) {
      setTestResultMsg(
        `✓ Exact reminder scheduled for ${new Date(res.timestamp).toLocaleTimeString()} (ID: ${res.id}). You can swipe away EyeFlow now!`
      );
      showToast('2-minute exact reminder scheduled!', 'success');
      await refreshDiagnostics();
    } else {
      setTestResultMsg(`✗ Failed to schedule: ${res.error}`);
      showToast(`Test failed: ${res.error}`, 'error');
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
            ...(isAndroid
              ? [{ id: 'diagnostics' as const, label: 'Android Diagnostics & Test', icon: Activity }]
              : []),
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
                onClick={() => setActiveSubTab(tab.id as any)}
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
                  <span className="text-[var(--text-secondary)]">Platform Architecture:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {diagnostics?.isDesktop
                      ? 'Windows Desktop (Native Daemon)'
                      : isAndroid
                      ? 'Android Native (FullScreen Intent + AlarmManager)'
                      : 'Web Application'}
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

                {isAndroid && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Precise Timing (Exact Alarm):</span>
                    <span
                      className={`font-semibold ${
                        androidDiag?.canScheduleExactAlarms
                          ? 'text-[var(--success-primary)]'
                          : 'text-[var(--warning-primary)]'
                      }`}
                    >
                      {androidDiag?.canScheduleExactAlarms ? '✓ Granted' : '⚠ Action required'}
                    </span>
                  </div>
                )}
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
                        Alert banner only
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
                        Alert banner alert
                      </span>
                    </button>
                  </div>
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
                    {isAndroid
                      ? 'EyeFlow requires Android notification permission (POST_NOTIFICATIONS) to alert you about water and screen breaks when the app is in the background or device is locked.'
                      : 'EyeFlow cannot show reminder alerts until notification permission is enabled.'}
                  </p>
                </div>
              )}

              {/* Exact Alarm Notice for Android 12+ */}
              {isAndroid && !androidDiag?.canScheduleExactAlarms && (
                <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--warning-subtle)] text-xs text-[var(--warning-primary)] space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Precise Alarms Permission Required</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Android 12+ restricts background timer precision by default. Allow "Alarms & Reminders" permission to ensure break schedules trigger on time.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleOpenExactAlarmSettings}
                    leftIcon={<Zap className="w-3.5 h-3.5" />}
                  >
                    Enable Precise Reminders
                  </Button>
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

              <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap gap-2.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRequestPermission}
                  leftIcon={<Bell className="w-3.5 h-3.5" />}
                >
                  Request Notification Permission
                </Button>

                {isAndroid && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenExactAlarmSettings}
                    leftIcon={<Zap className="w-3.5 h-3.5" />}
                  >
                    Alarms & Reminders Settings
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* 3. ANDROID DIAGNOSTICS & TESTING SUBTAB */}
          {activeSubTab === 'diagnostics' && isAndroid && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div className="space-y-0.5">
                  <h2 className="font-semibold text-base text-[var(--text-primary)]">
                    Android Diagnostics & Testing
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Native Full-Screen Intent, AlarmManager status, and real background test.
                  </p>
                </div>
                <Badge variant="water">Android Native</Badge>
              </div>

              {/* Status Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Current Device Time</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {new Date(currentDeviceTimestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Device & SDK</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {androidDiag?.manufacturer} {androidDiag?.model} (API {androidDiag?.sdkInt})
                  </span>
                </div>

                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Notification Permission</span>
                  <span
                    className={`text-sm font-bold ${
                      androidDiag?.notificationPermission === 'granted'
                        ? 'text-[var(--success-primary)]'
                        : 'text-[var(--warning-primary)]'
                    }`}
                  >
                    {androidDiag?.notificationPermission?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>

                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Precise Reminders (Exact Alarm)</span>
                  <span
                    className={`text-sm font-bold ${
                      androidDiag?.canScheduleExactAlarms
                        ? 'text-[var(--success-primary)]'
                        : 'text-[var(--warning-primary)]'
                    }`}
                  >
                    {androidDiag?.canScheduleExactAlarms ? 'GRANTED' : 'DENIED / ACTION REQUIRED'}
                  </span>
                </div>

                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Next Water Occurrence</span>
                  <span className="text-sm font-bold text-[var(--water-primary)]">
                    {nextWaterSlot?.time ? `${nextWaterSlot.time} (${nextWaterSlot.status})` : 'None / Inactive'}
                  </span>
                </div>

                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Next Screen Occurrence</span>
                  <span className="text-sm font-bold text-[var(--screen-primary)]">
                    {nextScreenSlot?.time ? `${nextScreenSlot.time} (${nextScreenSlot.status})` : 'None / Inactive'}
                  </span>
                </div>

                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Battery Optimization</span>
                  <span
                    className={`text-sm font-bold ${
                      androidDiag?.isIgnoringBatteryOptimizations
                        ? 'text-[var(--success-primary)]'
                        : 'text-[var(--warning-primary)]'
                    }`}
                  >
                    {androidDiag?.isIgnoringBatteryOptimizations ? 'OPTIMAL' : 'STANDARD'}
                  </span>
                </div>
              </div>

              {/* Pending Native Alarms */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                  <span>Pending Notifications ({androidDiag?.pendingCount ?? 0})</span>
                  <button
                    onClick={refreshDiagnostics}
                    className="text-[11px] text-[var(--water-primary)] hover:underline cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>

                {androidDiag?.pendingList && androidDiag.pendingList.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {androidDiag.pendingList.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-subtle)] text-xs"
                      >
                        <span className="font-medium text-[var(--text-primary)]">{item.title}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">{item.at}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] p-3 rounded bg-[var(--bg-subtle)]">
                    No pending notifications in queue.
                  </p>
                )}
              </div>

              {/* Last Scheduling Result / Error */}
              <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1 text-xs">
                <span className="font-semibold text-[var(--text-secondary)] block">Last Scheduling Result:</span>
                <p className="text-[var(--text-primary)]">{androidDiag?.lastSchedulingResult || 'None'}</p>
                {androidDiag?.lastSchedulingError && (
                  <p className="text-[var(--danger-primary)] font-semibold mt-1">
                    Error: {androidDiag.lastSchedulingError}
                  </p>
                )}
              </div>

              {/* Background Test Actions */}
              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    ⚡ Background Reminder Verification
                  </span>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Test background delivery by scheduling a notification for 30 seconds or 2 minutes ahead, then switch apps or lock your phone.
                  </p>
                </div>

                {testResultMsg && (
                  <div className="p-3 rounded-[var(--radius-md)] bg-[var(--water-subtle)] border border-[var(--water-border)] text-xs text-[var(--water-primary)] font-medium leading-relaxed animate-fade-in">
                    {testResultMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isTestingAlarm}
                    onClick={() => handleTest30SecReminder('water')}
                    leftIcon={<Zap className="w-3.5 h-3.5" />}
                  >
                    Water in 30s
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isTestingAlarm}
                    onClick={() => handleTest30SecReminder('screen')}
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                  >
                    Screen in 30s
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isTestingAlarm}
                    onClick={handleTest2MinExactReminder}
                    leftIcon={<Zap className="w-3.5 h-3.5" />}
                  >
                    Precise in 2m
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenExactAlarmSettings}
                    leftIcon={<Zap className="w-3.5 h-3.5" />}
                  >
                    Enable Precise Reminders
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenBatterySettings}
                    leftIcon={<Smartphone className="w-3.5 h-3.5" />}
                  >
                    Battery Optimization Settings
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* 4. GENERAL SUBTAB */}
          {activeSubTab === 'general' && (
            <Card variant="default" padding="lg" className="space-y-5">
              <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
                General Settings
              </h2>

              <div className="space-y-4">
                <Toggle
                  label="Start on system startup"
                  description="Automatically start reminders when system boots up."
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

          {/* 5. WATER SUBTAB */}
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

          {/* 6. SCREEN BREAK SUBTAB */}
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

          {/* 7. THEME SUBTAB */}
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

          {/* 8. PRIVACY SUBTAB */}
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

          {/* 9. ABOUT SUBTAB */}
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
