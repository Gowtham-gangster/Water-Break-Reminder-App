import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { profileService } from '../services/profileService.ts';
import { profileAvatarService } from '../services/profileAvatarService.ts';
import { authService } from '../services/authService.ts';
import {
  User,
  Mail,
  Clock,
  Calendar,
  Camera,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Lock,
  X,
  ChevronDown,
  LogOut,
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
  { value: 'Asia/Calcutta', label: 'Asia/Calcutta (India Standard Time, UTC+5:30)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (Indochina Time, UTC+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (Singapore Time, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Japan Standard Time, UTC+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10 / UTC+11)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (New Zealand Time, UTC+12 / UTC+13)' },
];

export const ProfilePage: React.FC = () => {
  const { currentUser, loginUser, logout } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [timezone, setTimezone] = useState(
    currentUser?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser?.avatar_url || null);

  // Status feedback
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email Change Modal State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Delete Account Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [imageLoadError, setImageLoadError] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.display_name || '');
      setTimezone(currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setAvatarUrl(currentUser.avatar_url || null);
      setImageLoadError(false);
    }
  }, [currentUser]);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // 1. Save Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    clearMessages();
    setSavingProfile(true);

    try {
      const res = await profileService.updateProfile(currentUser.id, {
        display_name: displayName.trim() || 'User',
        timezone: timezone.trim() || 'UTC',
        avatar_url: avatarUrl,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.profile) {
        await loginUser({
          ...currentUser,
          display_name: res.profile.display_name || 'User',
          timezone: res.profile.timezone,
          avatar_url: res.profile.avatar_url,
        });
        setSuccessMessage('Profile updated successfully.');
      }
    } catch {
      setErrorMessage('Failed to update profile. Please check your connection.');
    } finally {
      setSavingProfile(false);
    }
  };

  // 2. Avatar Upload & Resize (Using Unified profileAvatarService)
  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser?.id) return;
    clearMessages();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = profileAvatarService.validateImage(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid image format or size.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingAvatar(true);

    try {
      const result = await profileAvatarService.uploadAvatar(currentUser.id, file);
      if (result.success && result.avatarUrl) {
        setAvatarUrl(result.avatarUrl);
        setImageLoadError(false);
        await loginUser({ ...currentUser, avatar_url: result.avatarUrl });
        setSuccessMessage('Profile photo updated successfully.');
      } else {
        setErrorMessage(result.error || "Couldn't upload profile photo. Please try again.");
      }
    } catch {
      setErrorMessage("Couldn't upload profile photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentUser?.id) return;
    clearMessages();
    setUploadingAvatar(true);
    try {
      const res = await profileAvatarService.deleteAvatar(currentUser.id);
      if (res.success) {
        setAvatarUrl(null);
        setImageLoadError(false);
        await loginUser({ ...currentUser, avatar_url: null });
        setSuccessMessage('Avatar removed.');
      } else {
        setErrorMessage(res.error || 'Failed to remove avatar.');
      }
    } catch {
      setErrorMessage('Failed to remove avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 3. Auto-Detect Device Timezone
  const handleDetectDeviceTimezone = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setTimezone(detected);
    setSuccessMessage(`Detected device timezone: ${detected}`);
  };

  // 4. Secure Email Change
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setEmailError('Please enter a valid new email address.');
      return;
    }
    if (!currentPasswordForEmail) {
      setEmailError('Please enter your current password to confirm.');
      return;
    }

    setEmailChangeLoading(true);
    try {
      const res = await authService.changeEmail(newEmail.trim(), currentPasswordForEmail);
      if (res.error) {
        setEmailError(res.error);
      } else if (res.data?.user) {
        await loginUser(res.data.user);
        setEmailModalOpen(false);
        setNewEmail('');
        setCurrentPasswordForEmail('');
        setSuccessMessage('Your email address has been updated.');
      }
    } catch {
      setEmailError('Failed to change email address.');
    } finally {
      setEmailChangeLoading(false);
    }
  };

  // 5. Delete Account
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

  // Formatted Date
  const memberSince = currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently';

  // Fallback Initials
  const initials = (currentUser?.display_name || currentUser?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-8 animate-fade-in select-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
          Account Profile
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Manage your personal identity, timezone preferences, and account security.
        </p>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section 1: Visual Identity Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Camera Trigger */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-gradient-to-tr from-sky-500 to-indigo-600 p-0.5 shadow-xl flex items-center justify-center text-white">
              {avatarUrl && !imageLoadError ? (
                <img
                  key={avatarUrl}
                  src={avatarUrl}
                  alt={displayName}
                  onError={() => setImageLoadError(true)}
                  className="w-full h-full object-cover rounded-[22px]"
                />
              ) : (
                <div className="w-full h-full bg-[var(--bg-secondary)] rounded-[22px] flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-sky-400 tracking-wider">
                  {initials}
                </div>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-sky-500 text-white shadow-lg hover:bg-sky-400 active:scale-95 transition-all cursor-pointer"
              title="Upload new avatar"
            >
              {uploadingAvatar ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFileSelect}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />
          </div>

          {/* User Info Bio */}
          <div className="flex-1 text-center sm:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                {currentUser?.display_name || 'PauseFlow Member'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Active Cloud Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>{currentUser?.email || 'No email attached'}</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>{timezone}</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Member since {memberSince}</span>
              </div>
            </div>

            {/* Avatar Actions */}
            {avatarUrl && (
              <div className="pt-2">
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="text-xs text-rose-400 hover:underline flex items-center gap-1.5 mx-auto sm:mx-0"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove custom avatar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Edit Profile Details */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Profile Settings</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Customize how your identity appears across devices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
          {/* Display Name */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              className="w-full h-11 px-4 text-sm rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-sky-500/50 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
              required
            />
          </div>

          {/* Timezone Selector */}
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">Preferred Timezone</label>
              <button
                type="button"
                onClick={handleDetectDeviceTimezone}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Globe className="w-3.5 h-3.5" /> Auto-Detect
              </button>
            </div>
            <div className="relative flex items-center">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-11 px-4 pr-10 text-sm rounded-xl bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-sky-500/50 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none appearance-none cursor-pointer transition-all"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option
                    key={tz.value}
                    value={tz.value}
                    className="bg-[var(--bg-surface)] text-[var(--text-primary)] py-1.5"
                  >
                    {tz.label}
                  </option>
                ))}
                {!COMMON_TIMEZONES.find((tz) => tz.value === timezone) && (
                  <option
                    value={timezone}
                    className="bg-[var(--bg-surface)] text-[var(--text-primary)] py-1.5"
                  >
                    {timezone}
                  </option>
                )}
              </select>
              <span className="absolute right-3.5 text-[var(--text-muted)] pointer-events-none flex items-center">
                <ChevronDown className="w-4 h-4" />
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/30 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {savingProfile ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </form>

      {/* Section 3: Security & Credentials */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Account Security</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Manage your registered email and credential settings.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          <div>
            <span className="text-xs font-semibold text-[var(--text-primary)] block">
              Email Address
            </span>
            <span className="text-xs text-[var(--text-secondary)] mt-0.5 block">
              Current: <strong>{currentUser?.email}</strong>
            </span>
          </div>

          <button
            onClick={() => {
              setEmailError(null);
              setEmailModalOpen(true);
            }}
            className="btn btn-outline text-xs py-2 px-4 shrink-0"
          >
            Change Email
          </button>
        </div>
      </div>

      {/* Section 4: Session & Sign Out */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <LogOut className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Account Session</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Sign out of your PauseFlow account on this device.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          <div>
            <span className="text-xs font-semibold text-[var(--text-primary)] block">
              Active Session
            </span>
            <span className="text-xs text-[var(--text-secondary)] mt-0.5 block">
              Currently signed in as <strong>{currentUser?.email}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-5 py-2.5 rounded-xl font-semibold text-xs text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Section 5: Danger Zone */}
      <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-rose-500">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold">Danger Zone</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Irreversible actions related to your PauseFlow cloud account.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-rose-500/10">
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)]">Delete Account</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Permanently purge all sync configurations, reminder logs, and multi-device data.
            </p>
          </div>

          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmText('');
              setDeletePassword('');
              setDeleteModalOpen(true);
            }}
            className="btn btn-danger text-xs py-2 px-4 shrink-0 bg-rose-600 hover:bg-rose-700 text-white"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* ==========================================
          MODAL: CHANGE EMAIL
      ========================================== */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-fade-in">
            <button
              onClick={() => setEmailModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Change Email Address</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Confirm your password to securely transition your account to a new email address.
              </p>
            </div>

            {emailError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div className="form-group">
                <label className="form-label text-xs">New Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  className="form-input text-sm"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label text-xs">Current Account Password</label>
                <input
                  type="password"
                  value={currentPasswordForEmail}
                  onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                  placeholder="••••••••"
                  className="form-input text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="btn btn-outline text-xs py-2.5 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailChangeLoading}
                  className="btn btn-primary text-xs py-2.5 px-5 font-semibold"
                >
                  {emailChangeLoading ? 'Updating Email...' : 'Confirm & Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: DELETE ACCOUNT CONFIRMATION
      ========================================== */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[var(--bg-surface)] border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-fade-in">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-rose-500">Permanently Delete Account</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                This action is irreversible. All of your synced break schedules, logs, and device registrations will be permanently deleted from the cloud.
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
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="btn btn-outline text-xs py-2.5 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'DELETE' || !deletePassword}
                  className="btn btn-danger text-xs py-2.5 px-5 font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting Account...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
