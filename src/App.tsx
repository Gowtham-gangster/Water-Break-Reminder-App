import React from 'react';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/ui/Toast';
import { AppShell } from './components/layout/AppShell';
import { StandaloneReminder } from './components/StandaloneReminder';

export const App: React.FC = () => {
  // Check if this window was opened as a dedicated native reminder window
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isReminderWindow =
    searchParams?.get('mode') === 'reminder' ||
    (typeof window !== 'undefined' && window.location.hash.startsWith('#reminder'));

  if (isReminderWindow) {
    return <StandaloneReminder />;
  }

  return (
    <AppProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppProvider>
  );
};

export default App;
