import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Toggle, TimePicker, Input, useToast } from './ui';
import {
  Droplets,
  Bell,
  Save,
  AlertCircle,
  Calendar,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mon', full: 'Monday' },
  { id: 2, label: 'Tue', full: 'Tuesday' },
  { id: 3, label: 'Wed', full: 'Wednesday' },
  { id: 4, label: 'Thu', full: 'Thursday' },
  { id: 5, label: 'Fri', full: 'Friday' },
  { id: 6, label: 'Sat', full: 'Saturday' },
  { id: 0, label: 'Sun', full: 'Sunday' },
];

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
    activeDays: waterConfig.activeDays || [1, 2, 3, 4, 5],
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
      activeDays: waterConfig.activeDays || [1, 2, 3, 4, 5],
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

  const toggleDay = (dayId: number) => {
    setFormData((prev) => {
      const exists = prev.activeDays.includes(dayId);
      const updated = exists
        ? prev.activeDays.filter((d) => d !== dayId)
        : [...prev.activeDays, dayId];
      return { ...prev, activeDays: updated };
    });
  };

  const handleSave = async () => {
    if (formData.startTime >= formData.endTime) {
      setValidationError('End time must be strictly later than start time.');
      showToast('Please check your schedule times.', 'error');
      return;
    }

    if (!formData.intervalMinutes || Number(formData.intervalMinutes) <= 0) {
      setValidationError('Interval must be a positive number of minutes (greater than 0).');
      showToast('Invalid interval value.', 'error');
      return;
    }

    if (!formData.durationMinutes || Number(formData.durationMinutes) <= 0) {
      setValidationError('Reminder duration must be a positive number of minutes (greater than 0).');
      showToast('Invalid reminder duration.', 'error');
      return;
    }

    if (!formData.activeDays || formData.activeDays.length === 0) {
      setValidationError('Please select at least one active day for reminders.');
      showToast('No active days selected.', 'error');
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
      activeDays: formData.activeDays,
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
            Stay hydrated with customizable intervals, active days, and arbitrary time schedules.
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
          Personal Schedule Configuration
        </h2>

        {validationError && (
          <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-subtle)] text-xs font-medium text-[var(--danger-primary)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Active Days Picker */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--water-primary)]" /> Active Days
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, activeDays: [1, 2, 3, 4, 5] }))}
                className="text-[var(--text-secondary)] hover:text-[var(--water-primary)] transition-colors underline decoration-dotted"
              >
                Weekdays
              </button>
              <span className="text-[var(--text-muted)]">•</span>
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, activeDays: [0, 1, 2, 3, 4, 5, 6] }))}
                className="text-[var(--text-secondary)] hover:text-[var(--water-primary)] transition-colors underline decoration-dotted"
              >
                All 7 Days
              </button>
              <span className="text-[var(--text-muted)]">•</span>
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, activeDays: [0, 6] }))}
                className="text-[var(--text-secondary)] hover:text-[var(--water-primary)] transition-colors underline decoration-dotted"
              >
                Weekends
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = formData.activeDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  title={day.full}
                  className={`px-3.5 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-[var(--water-primary)] text-white border-[var(--water-primary)] shadow-sm'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Reminders will only fire and show pending slots on selected active days.
          </p>
        </div>

        {/* Time Window */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <TimePicker
            label="Start time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            helperText="Arbitrary start time (e.g. 08:13, 09:47, 13:26)."
          />

          <TimePicker
            label="End time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            helperText="Arbitrary end time (e.g. 17:53, 22:11)."
          />
        </div>

        {/* Interval & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Input
              type="number"
              min={1}
              max={720}
              label="Interval (minutes)"
              value={formData.intervalMinutes}
              onChange={(e) =>
                setFormData({ ...formData, intervalMinutes: Number(e.target.value) })
              }
              helperText="How often reminders trigger (e.g. 30, 45, 60, 90 mins)."
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, intervalMinutes: mins }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                    formData.intervalMinutes === mins
                      ? 'bg-[var(--water-subtle)] text-[var(--water-primary)] border-[var(--water-primary)] font-semibold'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Input
              type="number"
              min={1}
              max={60}
              label="Reminder duration (minutes)"
              value={formData.durationMinutes}
              onChange={(e) =>
                setFormData({ ...formData, durationMinutes: Number(e.target.value) })
              }
              helperText="Active banner duration for water break."
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[1, 2, 3, 5].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, durationMinutes: mins }))}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                    formData.durationMinutes === mins
                      ? 'bg-[var(--water-subtle)] text-[var(--water-primary)] border-[var(--water-primary)] font-semibold'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>
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
