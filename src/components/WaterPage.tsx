import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Toggle, TimePicker, Select, useToast } from './ui';
import {
  Droplets,
  Bell,
  Save,
  AlertCircle,
} from 'lucide-react';

export const WaterPage: React.FC = () => {
  const {
    waterConfig,
    setWaterConfig,
    nextWaterSlot,
    waterCompletedCount,
    startPreview,
  } = useApp();

  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    enabled: waterConfig.enabled,
    startTime: waterConfig.startTime || '08:00',
    endTime: waterConfig.endTime || '22:00',
    intervalMinutes: waterConfig.intervalMinutes || 60,
    durationMinutes: waterConfig.durationMinutes || 2,
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    setFormData({
      enabled: waterConfig.enabled,
      startTime: waterConfig.startTime || '08:00',
      endTime: waterConfig.endTime || '22:00',
      intervalMinutes: waterConfig.intervalMinutes || 60,
      durationMinutes: waterConfig.durationMinutes || 2,
    });
  }, [waterConfig]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!nextWaterSlot || !waterConfig.enabled) {
        setTimeRemaining(waterConfig.enabled ? 'done for today' : 'reminders paused');
        return;
      }
      const diff = Math.max(0, nextWaterSlot.scheduledTimestamp - Date.now());
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
  }, [nextWaterSlot, waterConfig.enabled]);

  const handleSave = async () => {
    if (formData.startTime >= formData.endTime) {
      setValidationError('End time must be later than start time.');
      showToast('Please check your schedule times.', 'error');
      return;
    }

    setValidationError(null);

    await setWaterConfig({
      ...waterConfig,
      enabled: formData.enabled,
      startTime: formData.startTime,
      endTime: formData.endTime,
      intervalMinutes: Number(formData.intervalMinutes),
      durationMinutes: Number(formData.durationMinutes),
    });

    showToast('Water reminder schedule saved ✓', 'success');
  };

  return (
    <div className="space-y-8 select-none">
      {/* 1. Header & Master Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Water Reminder
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Stay hydrated without interrupting your workflow.
          </p>
        </div>

        <Toggle
          label={formData.enabled ? 'Active' : 'Paused'}
          checked={formData.enabled}
          onChange={(checked) => {
            setFormData((prev) => ({ ...prev, enabled: checked }));
            setWaterConfig({ ...waterConfig, enabled: checked });
            showToast(checked ? 'Water reminders active' : 'Water reminders paused', 'info');
          }}
          variant="water"
        />
      </div>

      {/* 2. Next Water Reminder Card */}
      <Card variant="water" padding="md" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--water-primary)] flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5" /> Next Water Reminder
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] font-mono">
                {formData.enabled && nextWaterSlot ? nextWaterSlot.time : 'Paused'}
              </span>
              {formData.enabled && nextWaterSlot && (
                <span className="text-xs font-semibold text-[var(--water-primary)]">
                  ({timeRemaining})
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {waterCompletedCount === 0
                ? 'No water reminders logged yet today.'
                : `${waterCompletedCount} reminder${waterCompletedCount === 1 ? '' : 's'} completed today.`}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => startPreview('water')}
            leftIcon={<Bell className="w-3.5 h-3.5 text-[var(--water-primary)]" />}
          >
            Send test reminder
          </Button>
        </div>
      </Card>

      {/* 3. Schedule Form */}
      <Card variant="default" padding="lg" className="space-y-6">
        <h2 className="font-semibold text-base text-[var(--text-primary)] pb-3 border-b border-[var(--border-subtle)]">
          Your Schedule
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
            helperText="When reminders begin each day."
          />

          <TimePicker
            label="End time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            helperText="When reminders end each day."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Select
            label="Repeat every"
            value={formData.intervalMinutes}
            onChange={(e) => setFormData({ ...formData, intervalMinutes: Number(e.target.value) })}
            options={[
              { value: 30, label: '30 minutes' },
              { value: 45, label: '45 minutes' },
              { value: 60, label: '60 minutes (Recommended)' },
              { value: 90, label: '90 minutes' },
              { value: 120, label: '120 minutes' },
            ]}
            helperText="Frequency of water reminders."
          />

          <Select
            label="Reminder duration"
            value={formData.durationMinutes}
            onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
            options={[
              { value: 1, label: '1 minute' },
              { value: 2, label: '2 minutes' },
              { value: 3, label: '3 minutes' },
            ]}
            helperText="Duration for the water break."
          />
        </div>

        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center gap-3">
          <Button
            variant="water"
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
