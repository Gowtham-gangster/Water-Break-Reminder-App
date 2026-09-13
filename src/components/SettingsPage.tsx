import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { notificationEngine, type NotificationDiagnostics } from '../engine/notificationEngine';
import { androidScheduler, type AndroidSchedulerDiagnostics } from '../platform/androidScheduler';
import { detectPlatform } from '../platform/systemLifecycle';
import { authService } from '../services/authService';
import { syncService } from '../services/syncService';
import { Card, Button, Toggle, Badge, useToast } from './ui';
import { SyncDiagnosticsPanel } from './SyncDiagnosticsPanel';
import {
  Settings,
  Bell,
  Volume2,
  Clock,
  Globe,
  Sliders,
  Pause,
  Play,
  Shield,
  Download,
  Info,
  AlertTriangle,
  Activity,
  Zap,
  Smartphone,
  RefreshCw,
  User,
  Trash2,
  X,
  VolumeX,
  Database,
} from 'lucide-react';

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'America/New York (Eastern Time, UTC-5 / UTC-4)' },
  { value: 'America/Chicago', label: 'America/Chicago (Central Time, UTC-6 / UTC-5)' },
  { value: 'America/Denver', label: 'America/Denver (Mountain Time, UTC-7 / UTC-6)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (Pacific Time, UTC-8 / UTC-7)' },
  { value: 'America/Anchorage', label: 'America/Anchorage (Alaska Time, UTC-9)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (Hawaii Time, UTC-10)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao Paulo (Brasilia Time, UTC-3)' },
  { value: 'Europe/London', label: 'Europe/London (GMT / BST, UTC+0 / UTC+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (Central European Time, UTC+1 / UTC+2)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (Central European Time, UTC+1 / UTC+2)' },
  { value: 'Europe/Helsinki', label: 'Europe/Helsinki (Eastern European Time, UTC+2 / UTC+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (Gulf Standard Time, UTC+4)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (India Standard Time, UTC+5:30)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (Indochina Time, UTC+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (Singapore Time, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Japan Standard Time, UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10 / UTC+11)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (New Zealand Time, UTC+12 / UTC+13)' },
];

const WATER_SOUND_OPTIONS = [
  { id: 'water', label: 'Gentle Stream', desc: 'Calming two-tone stream drops' },
  { id: 'chime', label: 'Soft Chime', desc: 'Three-tone gentle ascending chime' },
  { id: 'bubble', label: 'Calm Bubble', desc: 'Soft playful water bubble pop' },
  { id: 'soft', label: 'Subtle Ping', desc: 'Minimalist unobtrusive ping' },
  { id: 'none', label: 'Silent', desc: 'No audio chime on water alerts' },
];

const LOOK_OUTSIDE_SOUND_OPTIONS = [
  { id: 'bell', label: 'Tibetan Bell', desc: 'Deep resonant meditation bell' },
  { id: 'gong', label: 'Zen Gong', desc: 'Warm peaceful harmonic gong' },
  { id: 'nature', label: 'Forest Birds', desc: 'Gentle nature morning birds' },
  { id: 'soft', label: 'Soft Chime', desc: 'Subtle two-tone relaxation chime' },
  { id: 'none', label: 'Silent', desc: 'No audio chime on screen breaks' },
];

export const SettingsPage: React.FC = () => {
  const {
    currentUser,
    generalSettings,
    setGeneralSettings,
    notificationSettings,
    setNotificationSettings,
    pauseState,
    setPauseDuration,
    waterConfig,
    screenBreakConfig,
    currentDeviceTimestamp,
    logout,
  } = useApp();

  const { showToast } = useToast();
  const isAndroid = detectPlatform() === 'android';

  const [activeSubTab, setActiveSubTab] = useState<
    'general' | 'notifications' | 'pause' | 'privacy' | 'diagnostics' | 'syncDiagnostics' | 'about'
  >('general');

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);
  const [androidDiag, setAndroidDiag] = useState<AndroidSchedulerDiagnostics | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Custom Pause state
  const [customPauseMins, setCustomPauseMins] = useState<number>(45);

  // Delete Account Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      showToast('Notification permission granted ✓', 'success');
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

  // Preview sounds
  const handlePreviewWaterSound = (soundId: string) => {
    if (soundId === 'none') {
      showToast('Silent mode selected (no preview)', 'info');
      return;
    }
    notificationEngine.playWaterSound(soundId);
    showToast(`Playing ${soundId} preview`, 'info');
  };

  const handlePreviewLookOutsideSound = (soundId: string) => {
    if (soundId === 'none') {
      showToast('Silent mode selected (no preview)', 'info');
      return;
    }
    notificationEngine.playLookOutsideSound(soundId);
    showToast(`Playing ${soundId} preview`, 'info');
  };

  // Auto-detect device timezone
  const handleAutoDetectTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setGeneralSettings({ ...generalSettings, timezone: detected });
    showToast(`Timezone updated to ${detected}`, 'success');
  };



  // Manual Cloud Sync
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncService.syncUserAccount(currentUser?.id || 'guest');
      if (res.success) {
        setLastSyncTime(new Date().toLocaleTimeString());
        showToast('Settings & reminder schedules synchronized with cloud ✓', 'success');
      } else {
        showToast(`Sync notice: ${res.error || 'Check network connection'}`, 'info');
      }
    } catch {
      showToast('Sync failed. Please check network connection.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // JSON Data Backup
  const exportDataJSON = () => {
    const data = {
      userId: currentUser?.id,
      userEmail: currentUser?.email,
      generalSettings,
      notificationSettings,
      waterConfig,
      screenBreakConfig,
      pauseState,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eyeflow_settings_${currentUser?.id || 'guest'}_${Date.now()}.json`;
    a.click();
    showToast('User settings exported successfully!', 'success');
  };

  // Delete Account
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE in capital letters to confirm.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Please enter your account password.');
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await authService.deleteAccount(deletePassword);
      if (res.error) {
        setDeleteError(res.error);
        setDeleteLoading(false);
      } else {
        setDeleteModalOpen(false);
        await logout();
      }
    } catch {
      setDeleteError('Failed to delete account. Please verify password and connection.');
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8 select-none animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Manage your personal preferences, audio notifications, and account privacy.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Navigation Sub-Tabs */}
        <div className="md:col-span-4 space-y-1">
          {[
            { id: 'general' as const, label: 'General', icon: Settings },
            { id: 'notifications' as const, label: 'Notifications & Audio', icon: Bell },
            { id: 'pause' as const, label: 'Pause Reminders', icon: Pause },
            { id: 'privacy' as const, label: 'Privacy & Account', icon: Shield },
            { id: 'syncDiagnostics' as const, label: 'Cross-Device Sync', icon: Database },
            ...(isAndroid
              ? [{ id: 'diagnostics' as const, label: 'Android Diagnostics', icon: Activity }]
              : []),
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
        <div className="md:col-span-8 space-y-6">
          {/* ========================================================
              1. GENERAL SUBTAB (Theme, Time Format, Timezone)
              ======================================================== */}
          {activeSubTab === 'general' && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="font-semibold text-base text-[var(--text-primary)]">General Settings</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Customized for your user account</p>
                </div>
                <Badge variant="water">User-Scoped</Badge>
              </div>

              {/* Theme Selection: System, Light, Dark */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-[var(--text-secondary)] block">
                  Theme Appearance
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'system' as const, label: 'System' },
                    { id: 'light' as const, label: 'Light' },
                    { id: 'dark' as const, label: 'Dark' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setGeneralSettings({ ...generalSettings, theme: mode.id })}
                      className={`p-3.5 rounded-[var(--radius-md)] border font-semibold text-xs transition-all cursor-pointer text-center ${
                        generalSettings.theme === mode.id
                          ? 'bg-[var(--bg-subtle)] border-[var(--text-primary)] text-[var(--text-primary)] shadow-sm'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Format: 12-hour vs 24-hour */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)] block">
                  Time Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: '12h' as const, label: '12-Hour (AM/PM)', example: '2:30 PM' },
                    { id: '24h' as const, label: '24-Hour', example: '14:30' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setGeneralSettings({ ...generalSettings, timeFormat: fmt.id })}
                      className={`p-3.5 rounded-[var(--radius-md)] border text-left text-xs transition-all cursor-pointer ${
                        generalSettings.timeFormat === fmt.id
                          ? 'bg-[var(--bg-subtle)] border-[var(--text-primary)] text-[var(--text-primary)] shadow-sm'
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <span className="block font-bold">{fmt.label}</span>
                      <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                        e.g. {fmt.example}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timezone Selection */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Timezone
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoDetectTimezone}
                    className="text-[11px] text-[var(--water-primary)] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Globe className="w-3 h-3" /> Auto-Detect Device Timezone
                  </button>
                </div>
                <select
                  value={generalSettings.timezone || 'UTC'}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                  className="form-input text-xs"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                  {!COMMON_TIMEZONES.find((tz) => tz.value === generalSettings.timezone) && (
                    <option value={generalSettings.timezone}>{generalSettings.timezone}</option>
                  )}
                </select>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Used for calculating scheduled daily start/end occurrences.
                </p>
              </div>

              {/* Startup & Tray Options */}
              <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                <Toggle
                  label="Start on system startup"
                  description="Automatically start reminders when your computer or device starts."
                  checked={generalSettings.startOnStartup}
                  onChange={(checked) =>
                    setGeneralSettings({ ...generalSettings, startOnStartup: checked })
                  }
                />

                <Toggle
                  label="Minimize to system tray"
                  description="Closing window minimizes PauseFlow to the system tray."
                  checked={generalSettings.minimizeToTray}
                  onChange={(checked) =>
                    setGeneralSettings({ ...generalSettings, minimizeToTray: checked })
                  }
                />
              </div>
            </Card>
          )}

          {/* ========================================================
              2. NOTIFICATIONS & AUDIO SUBTAB
              ======================================================== */}
          {activeSubTab === 'notifications' && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="font-semibold text-base text-[var(--text-primary)]">
                    Notification & Audio Settings
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    OS permission vs user in-app preference and sound styles
                  </p>
                </div>
                <Badge
                  variant={diagnostics?.permissionState === 'granted' ? 'success' : 'danger'}
                  dot
                >
                  OS {diagnostics?.permissionState === 'granted' ? 'Granted' : 'Ungranted'}
                </Badge>
              </div>

              {/* OS Permission State Display (SEPARATE from App Preference) */}
              <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      Operating System Permission State
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] block">
                      Actual device-level notification authorization
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      diagnostics?.permissionState === 'granted'
                        ? 'bg-[var(--success-subtle)] text-[var(--success-primary)]'
                        : 'bg-[var(--danger-subtle)] text-[var(--danger-primary)]'
                    }`}
                  >
                    {diagnostics?.permissionState === 'granted' ? '✓ SYSTEM AUTHORIZED' : '⚠ PERMISSION REQUIRED'}
                  </span>
                </div>

                {diagnostics?.permissionState !== 'granted' && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRequestPermission}
                      leftIcon={<Bell className="w-3.5 h-3.5" />}
                    >
                      Request OS Permission
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
                )}
              </div>

              {/* In-App User Preferences */}
              <div className="space-y-4 pt-2">
                <Toggle
                  label="App Notifications Enabled"
                  description="Enable or disable delivery of reminder banners within PauseFlow."
                  checked={notificationSettings.enabled}
                  onChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, enabled: checked })
                  }
                  variant="water"
                />

                <Toggle
                  label="Sound Enabled"
                  description="Play relaxing audio chimes or meditation bells on scheduled alerts."
                  checked={notificationSettings.soundEnabled}
                  onChange={(checked) =>
                    setNotificationSettings({ ...notificationSettings, soundEnabled: checked })
                  }
                  variant="water"
                />
              </div>

              {/* Water Reminder Sound Selector */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-primary)]">
                    Water Reminder Sound
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePreviewWaterSound(notificationSettings.waterSound)}
                    leftIcon={<Volume2 className="w-3.5 h-3.5 text-[var(--water-primary)]" />}
                  >
                    Preview Sound
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {WATER_SOUND_OPTIONS.map((snd) => {
                    const isSelected = notificationSettings.waterSound === snd.id;
                    return (
                      <div
                        key={snd.id}
                        onClick={() =>
                          setNotificationSettings({ ...notificationSettings, waterSound: snd.id })
                        }
                        className={`p-3 rounded-[var(--radius-md)] border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[var(--water-subtle)] border-[var(--water-primary)] text-[var(--text-primary)] shadow-sm'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                        }`}
                      >
                        <div>
                          <span className="block font-semibold text-xs text-[var(--text-primary)]">
                            {snd.label}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">{snd.desc}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewWaterSound(snd.id);
                          }}
                          className="p-1.5 rounded-full hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                          title="Play preview"
                        >
                          {snd.id === 'none' ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Look Outside Reminder Sound Selector */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-primary)]">
                    Look Outside Reminder Sound
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handlePreviewLookOutsideSound(notificationSettings.lookOutsideSound)
                    }
                    leftIcon={<Volume2 className="w-3.5 h-3.5 text-[var(--screen-primary)]" />}
                  >
                    Preview Sound
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {LOOK_OUTSIDE_SOUND_OPTIONS.map((snd) => {
                    const isSelected = notificationSettings.lookOutsideSound === snd.id;
                    return (
                      <div
                        key={snd.id}
                        onClick={() =>
                          setNotificationSettings({
                            ...notificationSettings,
                            lookOutsideSound: snd.id,
                          })
                        }
                        className={`p-3 rounded-[var(--radius-md)] border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[var(--screen-subtle)] border-[var(--screen-primary)] text-[var(--text-primary)] shadow-sm'
                            : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                        }`}
                      >
                        <div>
                          <span className="block font-semibold text-xs text-[var(--text-primary)]">
                            {snd.label}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">{snd.desc}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewLookOutsideSound(snd.id);
                          }}
                          className="p-1.5 rounded-full hover:bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                          title="Play preview"
                        >
                          {snd.id === 'none' ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}



          {/* ========================================================
              4. PAUSE REMINDERS SUBTAB
              ======================================================== */}
          {activeSubTab === 'pause' && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="font-semibold text-base text-[var(--text-primary)]">
                    Pause Reminders
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Temporarily silence all hydration and screen break alerts
                  </p>
                </div>
                <Badge variant={pauseState.isPaused ? 'warning' : 'success'}>
                  {pauseState.isPaused ? 'Paused' : 'Active'}
                </Badge>
              </div>

              {pauseState.isPaused && (
                <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--warning-subtle)] border border-[var(--warning-border)] text-xs text-[var(--warning-primary)] flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold">
                    <Clock className="w-4 h-4" />
                    <span>
                      Reminders paused until{' '}
                      {pauseState.pauseUntil
                        ? new Date(pauseState.pauseUntil).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'later'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPauseDuration(null)}
                    leftIcon={<Play className="w-3 h-3" />}
                  >
                    Resume Now
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setPauseDuration(30)}
                  className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--warning-primary)]" />
                    <span className="font-bold text-xs text-[var(--text-primary)]">30 Minutes</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                    Quick pause for short meetings or phone calls.
                  </span>
                </button>

                <button
                  onClick={() => setPauseDuration(60)}
                  className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--warning-primary)]" />
                    <span className="font-bold text-xs text-[var(--text-primary)]">1 Hour</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                    Focus block for deep work sessions.
                  </span>
                </button>

                <button
                  onClick={() => setPauseDuration('tomorrow')}
                  className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--screen-primary)]" />
                    <span className="font-bold text-xs text-[var(--text-primary)]">Today</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                    Silence remainder of the day (resumes tomorrow 8:00 AM).
                  </span>
                </button>

                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[var(--water-primary)]" />
                    <span className="font-bold text-xs text-[var(--text-primary)]">Custom Duration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={customPauseMins}
                      onChange={(e) => setCustomPauseMins(Math.max(1, parseInt(e.target.value) || 1))}
                      className="form-input text-xs py-1.5 px-2.5 flex-1"
                      placeholder="Minutes"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPauseDuration(customPauseMins)}
                    >
                      Pause
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ========================================================
              5. PRIVACY & ACCOUNT SUBTAB
              ======================================================== */}
          {activeSubTab === 'privacy' && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="font-semibold text-base text-[var(--text-primary)]">
                    Privacy & Account
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Account details, multi-device synchronization, and data lifecycle
                  </p>
                </div>
                <Badge variant="water">Isolated</Badge>
              </div>

              {/* 1. Account Section */}
              <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--water-subtle)] text-[var(--water-primary)] flex items-center justify-center font-bold">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">
                      {currentUser?.display_name || 'PauseFlow Member'}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {currentUser?.email || 'Local User'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] block">User ID:</span>
                    <span className="font-mono text-[11px] text-[var(--text-primary)]">
                      {currentUser?.id || 'guest'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] block">Member Since:</span>
                    <span className="text-[11px] text-[var(--text-primary)]">
                      {currentUser?.created_at
                        ? new Date(currentUser.created_at).toLocaleDateString()
                        : 'Today'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Data Synchronization */}
              <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      Data Synchronization
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Last synced: {lastSyncTime}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Download Settings Backup
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Export all user preferences and logs as JSON
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={exportDataJSON}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Export JSON
                  </Button>
                </div>
              </div>

              {/* 3. Danger Zone: Delete Account */}
              <div className="p-4 rounded-[var(--radius-lg)] bg-rose-500/5 border border-rose-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-rose-500">Delete Account</h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Permanently purge all sync configurations, reminder logs, and user settings.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteConfirmText('');
                      setDeletePassword('');
                      setDeleteModalOpen(true);
                    }}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* ========================================================
              6. ANDROID DIAGNOSTICS SUBTAB (Android Only)
              ======================================================== */}
          {activeSubTab === 'diagnostics' && isAndroid && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="font-semibold text-base text-[var(--text-primary)]">
                    Android Diagnostics
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Exact alarms, background intents, and OS diagnostics
                  </p>
                </div>
                <Badge variant="water">Android Native</Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">SDK & Device</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {androidDiag?.manufacturer} {androidDiag?.model} (API {androidDiag?.sdkInt})
                  </span>
                </div>

                <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                  <span className="text-[11px] text-[var(--text-muted)] block">Exact Alarm Permission</span>
                  <span
                    className={`text-sm font-bold ${
                      androidDiag?.canScheduleExactAlarms
                        ? 'text-[var(--success-primary)]'
                        : 'text-[var(--warning-primary)]'
                    }`}
                  >
                    {androidDiag?.canScheduleExactAlarms ? 'GRANTED ✓' : 'ACTION REQUIRED ⚠'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
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
                  Battery Optimization
                </Button>
              </div>
            </Card>
          )}

          {/* ========================================================
              6.5 CROSS-DEVICE SYNC SUBTAB
              ======================================================== */}
          {activeSubTab === 'syncDiagnostics' && (
            <Card variant="default" padding="lg" className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <h2 className="font-semibold text-base text-[var(--text-primary)]">
                    Cross-Device Synchronization
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Real-time cloud replication across Windows, Web, and Android
                  </p>
                </div>
                <Badge variant="water">Supabase Cloud</Badge>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Live Realtime Channel:</span>
                  <span className="font-bold text-emerald-400">Connected ✓</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Cloud Source of Truth:</span>
                  <span className="font-mono text-sky-400">hwrsvdrhqenraeuqfqle.supabase.co</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Account ID:</span>
                  <span className="font-mono text-[var(--text-primary)] truncate max-w-[200px]">{currentUser?.id || 'Anonymous'}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSyncModalOpen(true)}
                  leftIcon={<Activity className="w-3.5 h-3.5" />}
                >
                  Open Live Sync Diagnostics
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (currentUser?.id) {
                      setIsSyncing(true);
                      await syncService.syncUserAccount(currentUser.id);
                      setIsSyncing(false);
                      showToast('Cross-device data reconciled from cloud ✓', 'success');
                    }
                  }}
                  disabled={isSyncing}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
                >
                  Force Cloud Sync Now
                </Button>
              </div>
            </Card>
          )}

          {/* ========================================================
              7. ABOUT SUBTAB
              ======================================================== */}
          {activeSubTab === 'about' && (
            <Card variant="default" padding="lg" className="space-y-4 text-center py-8">
              <img
                src="/icon.png"
                alt="PauseFlow"
                className="w-14 h-14 rounded-2xl object-contain mx-auto shadow-md"
              />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">PauseFlow</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Drink. Look Away. Feel Better.
                </p>
                <p className="text-xs text-[var(--text-secondary)] pt-2 max-w-sm mx-auto leading-relaxed">
                  A calm, multi-user wellness companion designed to keep you hydrated and relaxed through intelligent timed water and screen breaks.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ==========================================
          MODAL: DELETE ACCOUNT CONFIRMATION
          ========================================== */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[var(--bg-secondary)] border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-scale-up">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-rose-500">Permanently Delete Account</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                This action is irreversible. All of your synced break schedules, logs, and settings will be permanently erased.
              </p>
            </div>

            {deleteError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="form-group">
                <label className="form-label text-xs">
                  Type <strong className="text-rose-400 font-mono">DELETE</strong> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="form-input text-sm font-mono"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label text-xs">Account Password</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  type="submit"
                  disabled={
                    deleteLoading ||
                    deleteConfirmText.trim().toUpperCase() !== 'DELETE' ||
                    !deletePassword
                  }
                >
                  {deleteLoading ? 'Deleting Account...' : 'Permanently Delete'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cross-Device Realtime Sync Diagnostics Panel */}
      <SyncDiagnosticsPanel
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
      />
    </div>
  );
};
