import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Dashboard } from '../Dashboard';
import { WaterPage } from '../WaterPage';
import { LookOutsidePage } from '../LookOutsidePage';
import { StatisticsPage } from '../StatisticsPage';
import { SettingsPage } from '../SettingsPage';
import { ProfilePage } from '../ProfilePage';
import { Onboarding } from '../Onboarding';
import { PauseModal } from '../PauseModal';
import { BreakModal } from '../BreakModal';
import { WaterBreakModal } from '../WaterBreakModal';
import { CombinedBreakModal } from '../CombinedBreakModal';

import { AuthContainer } from '../auth/AuthContainer';

export const AppShell: React.FC = () => {
  const { activeTab, onboardingCompleted, authState, loginUser } = useApp();

  // Session verification in progress
  if (authState === 'checking') {
    return <AuthContainer initialScreen="session_loading" onAuthenticated={loginUser} />;
  }

  // Not authenticated -> show authentication flow
  if (authState === 'unauthenticated') {
    return <AuthContainer initialScreen="welcome" onAuthenticated={loginUser} />;
  }

  // If first-time user, render ONLY Onboarding wizard
  if (!onboardingCompleted) {
    return <Onboarding />;
  }

  const mainRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--bg-page)] flex flex-col md:flex-row text-[var(--text-primary)] relative">
      {/* Desktop Slim Sidebar (208px) */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Top Header */}
      <Header />

      {/* Main Content Area — Automatically insets on mobile so all content scrolls fully above fixed bottom navigation */}
      <main ref={mainRef} className="flex-1 flex justify-center px-4 sm:px-8 pt-4 sm:pt-6 md:py-10 max-w-full overflow-y-auto mobile-bottom-inset">
        <div className="w-full max-w-4xl animate-fade-in">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'water' && <WaterPage />}
          {activeTab === 'screenbreak' && <LookOutsidePage />}
          {activeTab === 'statistics' && <StatisticsPage />}
          {activeTab === 'settings' && <SettingsPage />}
          {activeTab === 'profile' && <ProfilePage />}
        </div>
      </main>

      {/* Mobile Fixed Bottom Nav */}
      <MobileNav />

      {/* Global Modals */}
      <PauseModal />
      <BreakModal />
      <WaterBreakModal />
      <CombinedBreakModal />
    </div>
  );
};
