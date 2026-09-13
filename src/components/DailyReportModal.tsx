import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Calendar, Droplets, Eye } from 'lucide-react';
import { Badge, Button } from './ui';
import type { DailyReportItem } from '../services/reminderService';

export interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports?: DailyReportItem[];
  formatDateLabel: (dateStr: string) => string;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  isOpen,
  onClose,
  reports = [],
  formatDateLabel,
  triggerRef,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Background scroll lock & cleanup
  useEffect(() => {
    if (!isOpen) return;

    // Capture previous overflow states
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const mainEl = document.querySelector('main');
    const prevMainOverflow = mainEl ? mainEl.style.overflow : '';

    // Lock document & main scroll
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (mainEl) {
      mainEl.style.overflow = 'hidden';
    }

    // Shift focus into modal
    const timer = setTimeout(() => {
      if (closeBtnRef.current) {
        closeBtnRef.current.focus();
      } else if (dialogRef.current) {
        dialogRef.current.focus();
      }
    }, 50);

    // Handle Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);

      // Restore exact previous overflow states
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      if (mainEl) {
        mainEl.style.overflow = prevMainOverflow;
      }

      // Restore focus to trigger element if available
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex justify-center items-start pt-0 sm:pt-[5vh] md:pt-[7vh] p-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-report-title"
    >
      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card (Fixed height structure on desktop, full-height safe on mobile) */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-[820px] h-[100dvh] sm:h-auto sm:max-h-[88vh] flex flex-col rounded-none sm:rounded-3xl bg-[var(--bg-surface)] border-0 sm:border sm:border-[var(--border-subtle)] shadow-[var(--shadow-elevated)] overflow-hidden z-10 animate-scale-up outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Modal Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 sm:p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] z-10 pt-[max(1rem,env(safe-area-inset-top,1rem))] sm:pt-6">
          <div className="space-y-0.5">
            <h2 id="daily-report-title" className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Daily Report
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Completed and missed reminders by day.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close Daily Report"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Modal Content — ONLY this list scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar">
          {reports && reports.length > 0 ? (
            reports.map((item: DailyReportItem) => {
              const isDayToday = item.isToday;
              const isActive = item.isActive;

              return (
                <div
                  key={item.date}
                  className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-prominent)] transition-all space-y-3"
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)]/70 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-sm text-[var(--text-primary)]">
                        {formatDateLabel(item.date)}
                      </span>
                      {isDayToday && (
                        <span className="text-[10px] text-sky-400 font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                          Today
                        </span>
                      )}
                    </div>
                    <Badge variant={isActive ? 'water' : 'neutral'}>
                      {isActive ? 'In progress' : 'Finalized'}
                    </Badge>
                  </div>

                  {/* Day Breakdown Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                    {/* Water Intake */}
                    <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5" /> Water Intake
                        </span>
                      </div>
                      {isActive ? (
                        <div className="text-xs pt-1 font-mono font-bold text-[var(--text-primary)]">
                          {item.waterCompleted} completed / {item.waterExpected} expected
                        </div>
                      ) : (
                        <div className="text-xs pt-1 font-mono space-y-0.5">
                          <div className="font-bold text-emerald-400">{item.waterCompleted} completed</div>
                          <div className="font-medium text-rose-400">{item.waterMissed} missed</div>
                        </div>
                      )}
                    </div>

                    {/* Look Outside */}
                    <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> Look Outside
                        </span>
                      </div>
                      {isActive ? (
                        <div className="text-xs pt-1 font-mono font-bold text-[var(--text-primary)]">
                          {item.screenCompleted} completed / {item.screenExpected} expected
                        </div>
                      ) : (
                        <div className="text-xs pt-1 font-mono space-y-0.5">
                          <div className="font-bold text-emerald-400">{item.screenCompleted} completed</div>
                          <div className="font-medium text-rose-400">{item.screenMissed} missed</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No finalized days yet.</p>
            </div>
          )}
        </div>

        {/* Fixed Modal Footer */}
        <div className="shrink-0 px-5 py-3.5 sm:px-6 sm:py-4 border-t border-[var(--border-subtle)] flex items-center justify-end bg-[var(--bg-surface)] z-10 pb-[max(0.875rem,env(safe-area-inset-bottom,0.875rem))] sm:pb-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
