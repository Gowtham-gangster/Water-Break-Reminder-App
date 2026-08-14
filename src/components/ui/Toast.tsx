import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map((toast) => {
          const typeStyles: Record<ToastType, string> = {
            success: 'bg-[var(--bg-surface-elevated)] border-emerald-500/30 text-[var(--text-primary)]',
            warning: 'bg-[var(--bg-surface-elevated)] border-amber-500/30 text-[var(--text-primary)]',
            error: 'bg-[var(--bg-surface-elevated)] border-rose-500/30 text-[var(--text-primary)]',
            info: 'bg-[var(--bg-surface-elevated)] border-sky-500/30 text-[var(--text-primary)]',
          };

          const icons: Record<ToastType, React.ReactNode> = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
            warning: <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
            info: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
          };

          return (
            <div
              key={toast.id}
              className={clsx(
                'pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-lg)] border shadow-[var(--shadow-elevated)] transition-all animate-slide-up text-xs font-medium',
                typeStyles[toast.type]
              )}
            >
              <div className="flex items-center gap-2.5">
                {icons[toast.type]}
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
