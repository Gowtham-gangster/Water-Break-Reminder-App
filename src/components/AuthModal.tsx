import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, X, Mail, Lock, CheckCircle, LogOut } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { activeAuthModalOpen, setActiveAuthModalOpen, userAccount, setUserAccount } = useApp();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!activeAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please provide a valid email and password.');
      return;
    }

    // Simulate clean auth token creation & state update
    const accountData = {
      id: `usr_${Date.now()}`,
      name: name || email.split('@')[0],
      email,
      token: `eyeflow_jwt_${Date.now()}`,
      isLoggedIn: true,
      lastSyncedAt: new Date().toLocaleTimeString(),
    };

    await setUserAccount(accountData);
    setActiveAuthModalOpen(false);
  };

  const handleLogout = async () => {
    await setUserAccount({ isLoggedIn: false });
    setActiveAuthModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-2xl space-y-5">
        <button
          onClick={() => setActiveAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[var(--text-primary)]">
              {userAccount.isLoggedIn ? 'Account Settings' : isSignUp ? 'Create Account' : 'Account Sign In'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {userAccount.isLoggedIn ? 'Multi-device sync active' : 'Sync schedules across Laptop & Mobile'}
            </p>
          </div>
        </div>

        {userAccount.isLoggedIn ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Account Sync Enabled
                </span>
              </div>
              <p className="text-[var(--text-secondary)]">
                Logged in as: <strong>{userAccount.email}</strong>
              </p>
              <p className="text-[var(--text-muted)]">
                Last synchronized: {userAccount.lastSyncedAt || 'Just now'}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-outline text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 w-full py-2.5"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
                {errorMsg}
              </div>
            )}

            {isSignUp && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="form-input"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="form-input pl-9"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input pl-9"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary text-xs w-full py-3 shadow-md">
              {isSignUp ? 'Create Account & Start Sync' : 'Sign In'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg('');
                }}
                className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
