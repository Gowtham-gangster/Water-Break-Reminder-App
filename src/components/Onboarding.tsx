import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { APP_CONFIG } from '../config/app.config';
import { Button, Card, Select, TimePicker } from './ui';
import { Droplets, Eye, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { notificationEngine } from '../engine/notificationEngine';

export const Onboarding: React.FC = () => {
  const {
    waterConfig,
    setWaterConfig,
    screenBreakConfig,
    setScreenBreakConfig,
    completeOnboarding,
  } = useApp();

  const [step, setStep] = useState(1);

  // Local configuration state for Step 2 and Step 3
  const [localWater, setLocalWater] = useState({
    startTime: waterConfig.startTime || '08:00',
    endTime: waterConfig.endTime || '22:00',
    intervalMinutes: waterConfig.intervalMinutes || 60,
  });

  const [localScreen, setLocalScreen] = useState({
    startTime: screenBreakConfig.startTime || '09:00',
    endTime: screenBreakConfig.endTime || '22:00',
    screenIntervalMinutes: screenBreakConfig.screenIntervalMinutes || 30,
    breakDurationMinutes: screenBreakConfig.breakDurationMinutes || 5,
  });

  const handleFinish = async () => {
    // Save configurations
    await setWaterConfig({
      ...waterConfig,
      startTime: localWater.startTime,
      endTime: localWater.endTime,
      intervalMinutes: localWater.intervalMinutes,
      enabled: true,
    });

    await setScreenBreakConfig({
      ...screenBreakConfig,
      startTime: localScreen.startTime,
      endTime: localScreen.endTime,
      screenIntervalMinutes: localScreen.screenIntervalMinutes,
      breakDurationMinutes: localScreen.breakDurationMinutes,
      enabled: true,
    });

    // Request notification permission during final step
    await notificationEngine.requestPermission();

    // Mark onboarding completed
    await completeOnboarding();
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
              Step {step} of 3
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

        {/* STEP 1: Welcome & Value Proposition */}
        {step === 1 && (
          <div className="space-y-6 text-center py-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                {APP_CONFIG.name}
              </h1>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--water-primary)]">
                {APP_CONFIG.tagline}
              </p>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xs mx-auto pt-2">
                Simple reminders to help you build healthier screen habits throughout your workday.
              </p>
            </div>

            <div className="pt-4">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStep(2)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Get Started
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Water Reminder Setup */}
        {step === 2 && (
          <div className="space-y-6 py-2">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--water-subtle)] text-[var(--water-primary)] mx-auto flex items-center justify-center border border-[var(--water-border)]">
                <Droplets className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Water
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Set your water reminder.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <TimePicker
                  label="Start time"
                  value={localWater.startTime}
                  onChange={(e) => setLocalWater({ ...localWater, startTime: e.target.value })}
                />
                <TimePicker
                  label="End time"
                  value={localWater.endTime}
                  onChange={(e) => setLocalWater({ ...localWater, endTime: e.target.value })}
                />
              </div>

              <Select
                label="Interval"
                value={localWater.intervalMinutes}
                onChange={(e) =>
                  setLocalWater({ ...localWater, intervalMinutes: Number(e.target.value) })
                }
                options={[
                  { value: 30, label: 'Every 30 minutes' },
                  { value: 45, label: 'Every 45 minutes' },
                  { value: 60, label: 'Every 60 minutes (Recommended)' },
                  { value: 90, label: 'Every 90 minutes' },
                  { value: 120, label: 'Every 2 hours' },
                ]}
              />
            </div>

            <div className="flex items-center gap-3 pt-4">
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

        {/* STEP 3: Look Outside Setup & Finish */}
        {step === 3 && (
          <div className="space-y-6 py-2">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--screen-subtle)] text-[var(--screen-primary)] mx-auto flex items-center justify-center border border-[var(--screen-border)]">
                <Eye className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Look Outside
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Set your screen break.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <TimePicker
                  label="Start time"
                  value={localScreen.startTime}
                  onChange={(e) => setLocalScreen({ ...localScreen, startTime: e.target.value })}
                />
                <TimePicker
                  label="End time"
                  value={localScreen.endTime}
                  onChange={(e) => setLocalScreen({ ...localScreen, endTime: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Screen interval"
                  value={localScreen.screenIntervalMinutes}
                  onChange={(e) =>
                    setLocalScreen({
                      ...localScreen,
                      screenIntervalMinutes: Number(e.target.value),
                    })
                  }
                  options={[
                    { value: 20, label: '20 minutes (20-20-20)' },
                    { value: 25, label: '25 minutes (Pomodoro)' },
                    { value: 30, label: '30 minutes' },
                    { value: 45, label: '45 minutes' },
                    { value: 60, label: '60 minutes' },
                  ]}
                />

                <Select
                  label="Break duration"
                  value={localScreen.breakDurationMinutes}
                  onChange={(e) =>
                    setLocalScreen({
                      ...localScreen,
                      breakDurationMinutes: Number(e.target.value),
                    })
                  }
                  options={[
                    { value: 2, label: '2 minutes' },
                    { value: 5, label: '5 minutes (Standard)' },
                    { value: 10, label: '10 minutes' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button variant="outline" size="md" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                variant="screen"
                size="md"
                fullWidth
                onClick={handleFinish}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Finish Setup
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
