import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, Droplets, Eye, BarChart3, Settings } from 'lucide-react';

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'water' as const, label: 'Water Reminder', icon: Droplets, badgeColor: 'bg-sky-500' },
    { id: 'screenbreak' as const, label: 'Look Outside', icon: Eye, badgeColor: 'bg-indigo-500' },
    { id: 'statistics' as const, label: 'Statistics', icon: BarChart3 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop / Tablet Sub-Header Tab Bar */}
      <nav className="w-full bg-[var(--bg-card)] border-b border-[var(--border-color)] px-4 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-500/5'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-500' : 'text-[var(--text-muted)]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-card)] border-t border-[var(--border-color)] px-2 py-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
