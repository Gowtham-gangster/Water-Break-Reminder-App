import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Card,
  Badge,
  Toggle,
  Input,
  Select,
  TimePicker,
  ProgressBar,
  Modal,
  Tabs,
  SectionHeader,
  useToast,
} from '../ui';
import {
  Droplets,
  Eye,
  Sun,
  Moon,
  Bell,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DesignSystemShowcase: React.FC = () => {
  const { generalSettings, setGeneralSettings } = useApp();
  const { showToast } = useToast();

  const [activeSegment, setActiveSegment] = useState<'buttons' | 'cards' | 'forms' | 'feedback'>(
    'buttons'
  );
  const [toggleStateWater, setToggleStateWater] = useState(true);
  const [toggleStateScreen, setToggleStateScreen] = useState(false);
  const [inputText, setInputText] = useState('Drink water reminder');
  const [selectedInterval, setSelectedInterval] = useState<string | number>(60);
  const [selectedTime, setSelectedTime] = useState('08:00');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progressVal, setProgressVal] = useState(65);

  const toggleTheme = () => {
    const nextTheme = generalSettings.theme === 'dark' ? 'light' : 'dark';
    setGeneralSettings({ ...generalSettings, theme: nextTheme });
  };

  return (
    <div className="space-y-10 max-w-5xl mx-auto py-6 px-4 sm:px-6">
      {/* Top Banner / Theme Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[var(--radius-xl)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              EyeFlow Design System
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Standardized tokens, accessible controls, and multi-level surface architecture.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            leftIcon={
              generalSettings.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )
            }
          >
            {generalSettings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => showToast('Design System loaded cleanly! ✨', 'success')}
            leftIcon={<Bell className="w-4 h-4" />}
          >
            Test Toast
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        variant="segmented"
        fullWidth
        activeTab={activeSegment}
        onChange={setActiveSegment}
        tabs={[
          { id: 'buttons', label: 'Buttons & Icons', icon: <Sliders className="w-4 h-4" /> },
          { id: 'cards', label: 'Surfaces & Cards', icon: <Droplets className="w-4 h-4 text-sky-500" /> },
          { id: 'forms', label: 'Inputs & Form Controls', icon: <Eye className="w-4 h-4 text-indigo-500" /> },
          { id: 'feedback', label: 'Feedback & Progress', icon: <Heart className="w-4 h-4 text-rose-500" /> },
        ]}
      />

      {/* Section 1: Buttons */}
      {activeSegment === 'buttons' && (
        <div className="space-y-6">
          <SectionHeader
            title="Button Variants & Sizes"
            subtitle="44px+ accessible touch targets with clear focus and loading feedback."
          />

          <Card variant="default" className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Variants
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" leftIcon={<Droplets className="w-4 h-4" />}>
                  Primary (Water)
                </Button>
                <Button variant="screen" leftIcon={<Eye className="w-4 h-4" />}>
                  Screen (Look Outside)
                </Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                States & Sizes
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="primary">
                  Small (36px)
                </Button>
                <Button size="md" variant="primary">
                  Medium (44px)
                </Button>
                <Button size="lg" variant="primary">
                  Large (50px)
                </Button>
                <Button variant="primary" isLoading>
                  Loading
                </Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Icon Buttons
              </span>
              <div className="flex items-center gap-3">
                <IconButton
                  variant="primary"
                  icon={<Droplets className="w-4 h-4" />}
                  aria-label="Water"
                />
                <IconButton
                  variant="screen"
                  icon={<Eye className="w-4 h-4" />}
                  aria-label="Look Outside"
                />
                <IconButton
                  variant="secondary"
                  icon={<Bell className="w-4 h-4" />}
                  aria-label="Notifications"
                />
                <IconButton
                  variant="outline"
                  icon={<Sun className="w-4 h-4" />}
                  aria-label="Theme"
                />
                <IconButton
                  variant="danger"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  aria-label="Warning"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Section 2: Surfaces & Cards */}
      {activeSegment === 'cards' && (
        <div className="space-y-6">
          <SectionHeader
            title="Multi-Level Surfaces & Cards"
            subtitle="Layered depth hierarchy avoiding flat monochrome backgrounds."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card variant="default">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  Default Surface
                </span>
                <Badge variant="neutral">Level 1</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Base card container for standard content widgets.
              </p>
            </Card>

            <Card variant="elevated">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  Elevated Surface
                </span>
                <Badge variant="success">Level 2</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Higher z-index elevation with ambient diffuse shadows.
              </p>
            </Card>

            <Card variant="water">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-[var(--water-primary)]" />
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    Water Accent Card
                  </span>
                </div>
                <Badge variant="water">Hydration</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Soft cyan border and ambient gradient tint.
              </p>
            </Card>

            <Card variant="screen">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[var(--screen-primary)]" />
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    Look Outside Card
                  </span>
                </div>
                <Badge variant="screen">Screen Break</Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Soft lavender border and subtle ambient glow.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Section 3: Forms & Inputs */}
      {activeSegment === 'forms' && (
        <div className="space-y-6">
          <SectionHeader
            title="Forms & Control System"
            subtitle="Accessible inputs, custom toggles, time selectors, and dropdowns."
          />

          <Card variant="default" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input
                label="Reminder Title"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                helperText="Give your reminder a recognizable label."
                leftIcon={<Droplets className="w-4 h-4" />}
              />

              <Select
                label="Interval Frequency"
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(e.target.value)}
                options={[
                  { value: 20, label: 'Every 20 minutes' },
                  { value: 30, label: 'Every 30 minutes' },
                  { value: 45, label: 'Every 45 minutes' },
                  { value: 60, label: 'Every 60 minutes' },
                ]}
                helperText="Frequency between reminder triggers."
              />

              <TimePicker
                label="Start Time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                helperText="When reminders start each day."
              />

              <div className="space-y-4 pt-2">
                <Toggle
                  label="Water Reminders"
                  description="Enable periodic drinking alerts."
                  checked={toggleStateWater}
                  onChange={setToggleStateWater}
                  variant="water"
                />

                <Toggle
                  label="Screen Break Reminders"
                  description="Enable 20-20-20 eye rest alerts."
                  checked={toggleStateScreen}
                  onChange={setToggleStateScreen}
                  variant="screen"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Section 4: Feedback & Progress */}
      {activeSegment === 'feedback' && (
        <div className="space-y-6">
          <SectionHeader
            title="Feedback & Status Indicators"
            subtitle="Progress indicators, toasts, badges, and modals."
          />

          <Card variant="default" className="space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Progress Bars ({progressVal}%)
              </span>
              <ProgressBar
                value={progressVal}
                variant="water"
                label="Daily Water Intake (6 / 8 glasses)"
                showLabel
              />
              <ProgressBar
                value={80}
                variant="screen"
                label="Screen Breaks (8 / 10 breaks)"
                showLabel
              />
              <ProgressBar value={95} variant="success" label="Habit Consistency" showLabel />

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgressVal(Math.max(0, progressVal - 10))}
                >
                  -10%
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setProgressVal(Math.min(100, progressVal + 10))}
                >
                  +10%
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Toasts & Modals
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => showToast('Water goal achieved! 💧', 'success')}
                >
                  Success Toast
                </Button>
                <Button
                  variant="screen"
                  size="sm"
                  onClick={() => showToast('Time for a 5-minute break 👀', 'info')}
                >
                  Info Toast
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => showToast('Notifications are disabled', 'warning')}
                >
                  Warning Toast
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  leftIcon={<CheckCircle2 className="w-4 h-4 text-sky-500" />}
                >
                  Open Test Modal
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Test Modal Component */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Design System Modal"
        description="Accessible modal dialog with focus management and backdrop blur."
      >
        <div className="space-y-4 text-xs text-[var(--text-secondary)]">
          <p>
            This modal responds to click-outside and pressing the <strong>Escape</strong> key.
            It provides clean typography and buttons.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                showToast('Modal action confirmed!', 'success');
              }}
            >
              Confirm Action
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
