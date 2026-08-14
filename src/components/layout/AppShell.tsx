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
import { Onboarding } from '../Onboarding';
import { PauseModal } from '../PauseModal';
import { BreakModal } from '../BreakModal';
import { WaterBreakModal } from '../WaterBreakModal';

export const AppShell: React.FC = () => {
  const { activeTab, onboardingCompleted } = useApp();

  // If first-time user, render ONLY Onboarding wizard
  if (!onboardingCompleted) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col md:flex-row text-[var(--text-primary)]">
      {/* Desktop Slim Sidebar (208px) */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Top Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 flex justify-center px-4 sm:px-8 py-6 sm:py-10 max-w-full overflow-y-auto">
        <div className="w-full max-w-4xl animate-fade-in">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'water' && <WaterPage />}
          {activeTab === 'screenbreak' && <LookOutsidePage />}
          {activeTab === 'statistics' && <StatisticsPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* Mobile Fixed Bottom Nav */}
      <MobileNav />

      {/* Global Modals */}
      <PauseModal />
      <BreakModal />
      <WaterBreakModal />
    </div>
  );
};
