import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button, Select, TimePicker } from './ui';
import { Droplets, Eye, ArrowRight, CheckCircle2, Sparkles, Check, Bell } from 'lucide-react';
import { notificationEngine } from '../engine/notificationEngine';
import { formatUserTime } from '../utils/timeFormat';

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' },
  { day: 0, label: 'Sun', full: 'Sunday' },
];

export const Onboarding: React.FC = () => {
  const {
    waterConfig,
    setWaterConfig,
    screenBreakConfig,
    setScreenBreakConfig,
    completeOnboarding,
    generalSettings,
  } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // STEP 1: Water Configuration State
  const [waterEnabled, setWaterEnabled] = useState(waterConfig.enabled ?? true);
  const [waterInterval, setWaterInterval] = useState(waterConfig.intervalMinutes || 30);
  const [waterStartTime, setWaterStartTime] = useState(waterConfig.startTime || '09:00');
  const [waterEndTime, setWaterEndTime] = useState(waterConfig.endTime || '21:00');
  const [waterDuration, setWaterDuration] = useState(waterConfig.durationMinutes || 1); // 1 = 60s
  const [waterDays, setWaterDays] = useState<number[]>(waterConfig.activeDays || [1, 2, 3, 4, 5]);

  // STEP 2: Look Outside Configuration State
  const [screenEnabled, setScreenEnabled] = useState(screenBreakConfig.enabled ?? true);
  const [screenInterval, setScreenInterval] = useState(screenBreakConfig.screenIntervalMinutes || 20);
  const [screenStartTime, setScreenStartTime] = useState(screenBreakConfig.startTime || '09:00');
  const [screenEndTime, setScreenEndTime] = useState(screenBreakConfig.endTime || '21:00');
  const [screenDuration, setScreenDuration] = useState(screenBreakConfig.breakDurationMinutes || 5);
  const [screenDays, setScreenDays] = useState<number[]>(screenBreakConfig.activeDays || [1, 2, 3, 4, 5]);

  const [saving, setSaving] = useState(false);

  const toggleWaterDay = (day: number) => {
    if (waterDays.includes(day)) {
      if (waterDays.length > 1) {
        setWaterDays(waterDays.filter((d) => d !== day));
      }
    } else {
      setWaterDays([...waterDays, day]);
    }
  };

  const toggleScreenDay = (day: number) => {
    if (screenDays.includes(day)) {
      if (screenDays.length > 1) {
        setScreenDays(screenDays.filter((d) => d !== day));
      }
    } else {
      setScreenDays([...screenDays, day]);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await notificationEngine.requestPermission();
      await setWaterConfig({
        ...waterConfig,
        enabled: waterEnabled,
        intervalMinutes: waterInterval,
        startTime: waterStartTime,
        endTime: waterEndTime,
        durationMinutes: waterDuration,
        activeDays: waterDays,
      });
      await setScreenBreakConfig({
        ...screenBreakConfig,
        enabled: screenEnabled,
        screenIntervalMinutes: screenInterval,
        startTime: screenStartTime,
        endTime: screenEndTime,
        breakDurationMinutes: screenDuration,
        activeDays: screenDays,
      });
      await completeOnboarding();
    } catch (_) {
      await completeOnboarding();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-page)] animate-fade-in select-none">
      <Card
        variant="elevated"
        padding="lg"
        className="w-full max-w-lg overflow-hidden border-[var(--border-subtle)] shadow-[var(--shadow-elevated)] space-y-6 animate-scale-up"
      >
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {step === 1 && 'Step 1 of 3 — Water'}
              {step === 2 && 'Step 2 of 3 — Look Outside'}
              {step === 3 && 'Step 3 of 3 — Complete'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? 'w-6 bg-[var(--water-primary)]'
                    : s < step
                    ? 'w-2 bg-[var(--success-primary)]'
                    : 'w-2 bg-[var(--border-strong)]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ==========================================
            STEP 1: WATER REMINDERS
        ========================================== */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--water-subtle)] text-[var(--water-primary)] mx-auto flex items-center justify-center border border-[var(--water-border)] shadow-sm">
                <Droplets className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Stay Hydrated
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Customize your daily hydration rhythm.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Water Reminders</h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">Receive scheduled hydration alerts</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaterEnabled(!waterEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    waterEnabled ? 'bg-[var(--water-primary)]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      waterEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* How often */}
              <Select
                label="How often?"
                value={waterInterval}
                disabled={!waterEnabled}
                onChange={(e) => setWaterInterval(Number(e.target.value))}
                options={[
                  { value: 30, label: 'Every 30 minutes' },
                  { value: 45, label: 'Every 45 minutes' },
                  { value: 60, label: 'Every 60 minutes (Recommended)' },
                  { value: 90, label: 'Every 90 minutes' },
                  { value: 120, label: 'Every 2 hours' },
                ]}
              />

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <TimePicker
                  label="Start"
                  timeFormat={generalSettings.timeFormat}
                  value={waterStartTime}
                  onChange={(e) => setWaterStartTime(e.target.value)}
                />
                <TimePicker
                  label="End"
                  timeFormat={generalSettings.timeFormat}
                  value={waterEndTime}
                  onChange={(e) => setWaterEndTime(e.target.value)}
                />
              </div>

              {/* Reminder Duration */}
              <Select
                label="Reminder duration"
                value={waterDuration}
                disabled={!waterEnabled}
                onChange={(e) => setWaterDuration(Number(e.target.value))}
                options={[
                  { value: 1, label: '60 seconds' },
                  { value: 2, label: '2 minutes' },
                  { value: 3, label: '3 minutes' },
                  { value: 5, label: '5 minutes' },
                ]}
              />

              {/* Active Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Active days</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map(({ day, label }) => {
                    const isSelected = waterDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWaterDay(day)}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                          isSelected
                            ? 'bg-[var(--water-primary)] text-white border-transparent shadow-sm'
                            : 'bg-[var(--bg-tertiary)]/60 text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStep(2)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ==========================================
            STEP 2: LOOK OUTSIDE REMINDERS
        ========================================== */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--screen-subtle)] text-[var(--screen-primary)] mx-auto flex items-center justify-center border border-[var(--screen-border)] shadow-sm">
                <Eye className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Give Your Eyes A Break
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Relieve screen fatigue with 20-20-20 breaks.
              </p>
            </div>

            <div className="space-y-4 pt-1">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Look Outside Breaks</h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">Receive 20-20-20 vision rest reminders</p>
                </div>
                <button
                  type="button"
                  onClick={() => setScreenEnabled(!screenEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    screenEnabled ? 'bg-[var(--screen-primary)]' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      screenEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* How often */}
              <Select
                label="How often?"
                value={screenInterval}
                disabled={!screenEnabled}
                onChange={(e) => setScreenInterval(Number(e.target.value))}
                options={[
                  { value: 20, label: 'Every 20 minutes (20-20-20 Rule)' },
                  { value: 25, label: 'Every 25 minutes (Pomodoro)' },
                  { value: 30, label: 'Every 30 minutes' },
                  { value: 45, label: 'Every 45 minutes' },
                  { value: 60, label: 'Every 60 minutes' },
                ]}
              />

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <TimePicker
                  label="Start"
                  timeFormat={generalSettings.timeFormat}
                  value={screenStartTime}
                  onChange={(e) => setScreenStartTime(e.target.value)}
                />
                <TimePicker
                  label="End"
                  timeFormat={generalSettings.timeFormat}
                  value={screenEndTime}
                  onChange={(e) => setScreenEndTime(e.target.value)}
                />
              </div>

              {/* Break Duration */}
              <Select
                label="Break duration"
                value={screenDuration}
                onChange={(e) => setScreenDuration(Number(e.target.value))}
                options={[
                  { value: 1, label: '20 seconds (Standard Eye Rest)' },
                  { value: 2, label: '2 minutes' },
                  { value: 5, label: '5 minutes' },
                  { value: 10, label: '10 minutes' },
                ]}
              />

              {/* Active Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Active days</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map(({ day, label }) => {
                    const isSelected = screenDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleScreenDay(day)}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                          isSelected
                            ? 'bg-[var(--screen-primary)] text-white border-transparent shadow-sm'
                            : 'bg-[var(--bg-tertiary)]/60 text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" size="md" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setStep(3)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ==========================================
            STEP 3: COMPLETE
        ========================================== */}
        {step === 3 && (
          <div className="space-y-6 text-center py-4 animate-fade-in">
            <div className="relative mx-auto w-20 h-20">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-400 p-[2px] shadow-xl">
                <div className="w-full h-full bg-[var(--bg-secondary)] rounded-3xl flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
              </div>
              <div className="absolute -inset-2 bg-emerald-500/20 blur-xl rounded-full pointer-events-none" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                You're all set!
              </h2>
              <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
                PauseFlow will now remind you automatically in the background according to your schedule.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)] text-left space-y-2 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Water reminders every <strong>{waterInterval} mins</strong> ({formatUserTime(waterStartTime, generalSettings.timeFormat, generalSettings.timezone)} - {formatUserTime(waterEndTime, generalSettings.timeFormat, generalSettings.timezone)})</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Look Outside breaks every <strong>{screenInterval} mins</strong> ({formatUserTime(screenStartTime, generalSettings.timeFormat, generalSettings.timezone)} - {formatUserTime(screenEndTime, generalSettings.timeFormat, generalSettings.timezone)})</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Native background reminders and tray support active</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={saving}
                onClick={handleFinish}
                rightIcon={<Sparkles className="w-4 h-4" />}
              >
                {saving ? 'Initializing...' : 'Go to Dashboard'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
