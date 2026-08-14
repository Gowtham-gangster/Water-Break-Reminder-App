import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Toggle, TimePicker, Select, useToast } from './ui';
import {
  Eye,
  Save,
  AlertCircle,
} from 'lucide-react';

export const LookOutsidePage: React.FC = () => {
  const {
    screenBreakConfig,
    setScreenBreakConfig,
    nextScreenSlot,
    screenCompletedCount,
  } = useApp();

  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    enabled: screenBreakConfig.enabled,
    startTime: screenBreakConfig.startTime || '09:00',
    endTime: screenBreakConfig.endTime || '22:00',
    screenIntervalMinutes: screenBreakConfig.screenIntervalMinutes || 30,
    breakDurationMinutes: screenBreakConfig.breakDurationMinutes || 5,
    reminderStyle: screenBreakConfig.reminderStyle || 'fullscreen',
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    setFormData({
      enabled: screenBreakConfig.enabled,
      startTime: screenBreakConfig.startTime || '09:00',
      endTime: screenBreakConfig.endTime || '22:00',
      screenIntervalMinutes: screenBreakConfig.screenIntervalMinutes || 30,
      breakDurationMinutes: screenBreakConfig.breakDurationMinutes || 5,
      reminderStyle: screenBreakConfig.reminderStyle || 'fullscreen',
    });
  }, [screenBreakConfig]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!nextScreenSlot || !screenBreakConfig.enabled) {
        setTimeRemaining(screenBreakConfig.enabled ? 'done for today' : 'breaks paused');
        return;
      }
      const diff = Math.max(0, nextScreenSlot.scheduledTimestamp - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (diff === 0) {
        setTimeRemaining('due now');
      } else if (mins === 0) {
        setTimeRemaining(`in ${secs}s`);
      } else {
        setTimeRemaining(`in ${mins} minute${mins === 1 ? '' : 's'}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextScreenSlot, screenBreakConfig.enabled]);

  const handleSave = async () => {
    if (formData.startTime >= formData.endTime) {
      setValidationError('End time must be later than start time.');
      showToast('Please check your schedule times.', 'error');
      return;
    }

    setValidationError(null);

    await setScreenBreakConfig({
      ...screenBreakConfig,
      enabled: formData.enabled,
      startTime: formData.startTime,
      endTime: formData.endTime,
      screenIntervalMinutes: Number(formData.screenIntervalMinutes),
      breakDurationMinutes: Number(formData.breakDurationMinutes),
      reminderStyle: formData.reminderStyle as 'fullscreen' | 'notification',
    });

    showToast('Look Outside schedule saved ✓', 'success');
  };

  return (
    <div className="space-y-8 select-none">
      {/* 1. Header & Master Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Look Outside
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Give your eyes regular moments away from the screen.
          </p>
        </div>

        <Toggle
          label={formData.enabled ? 'Active' : 'Paused'}
          checked={formData.enabled}
          onChange={(checked) => {
            setFormData((prev) => ({ ...prev, enabled: checked }));
            setScreenBreakConfig({ ...screenBreakConfig, enabled: checked });
            showToast(checked ? 'Screen breaks active' : 'Screen breaks paused', 'info');
          }}
          variant="screen"
        />
      </div>

      {/* 2. Next Break Card (Clean, No Preview Button) */}
      <Card variant="screen" padding="md" className="space-y-3">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--screen-primary)] flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Next Screen Break
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] font-mono">
              {formData.enabled && nextScreenSlot ? nextScreenSlot.time : 'Paused'}
            </span>
            {formData.enabled && nextScreenSlot && (
              <span className="text-xs font-semibold text-[var(--screen-primary)]">
                ({timeRemaining})
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {screenCompletedCount === 0
              ? 'No screen breaks logged yet today.'
              : `${screenCompletedCount} break${screenCompletedCount === 1 ? '' : 's'} completed today.`}
          </p>
        </div>
      </Card>

      {/* 3. Schedule Settings Form (Clean, No Preview Button) */}
      <Card variant="default" padding="lg" className="space-y-6">
        <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
          Break Settings
        </h2>

        {validationError && (
          <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-subtle)] text-xs font-medium text-[var(--danger-primary)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <TimePicker
            label="Start time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            helperText="When screen breaks begin each day."
          />

          <TimePicker
            label="End time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            helperText="When daily breaks end."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Select
            label="Screen interval"
            value={formData.screenIntervalMinutes}
            onChange={(e) =>
              setFormData({ ...formData, screenIntervalMinutes: Number(e.target.value) })
            }
            options={[
              { value: 20, label: '20 minutes (20-20-20 rule)' },
              { value: 25, label: '25 minutes (Pomodoro)' },
              { value: 30, label: '30 minutes (Balanced)' },
              { value: 45, label: '45 minutes' },
              { value: 60, label: '60 minutes' },
            ]}
            helperText="Time spent looking at screen between breaks."
          />

          <Select
            label="Break duration"
            value={formData.breakDurationMinutes}
            onChange={(e) =>
              setFormData({ ...formData, breakDurationMinutes: Number(e.target.value) })
            }
            options={[
              { value: 2, label: '2 minutes' },
              { value: 5, label: '5 minutes (Recommended)' },
              { value: 10, label: '10 minutes' },
            ]}
            helperText="Duration to relax eyes."
          />
        </div>

        <div className="pt-3 border-t border-[var(--border-subtle)]">
          <Button
            variant="screen"
            size="md"
            onClick={handleSave}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
};
