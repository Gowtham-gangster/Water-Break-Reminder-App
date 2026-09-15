import React, { useState, useMemo } from 'react';
import {
  Eye,
  Droplets,
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  Mail,
  User,
  KeyRound,
  RefreshCw,
  EyeOff,
  ChevronLeft,
} from 'lucide-react';
import { authService, type UserProfile } from '../../services/authService';
import { BrandLogo } from '../ui';

export type AuthScreen =
  | 'welcome'
  | 'login'
  | 'signup'
  | 'forgot_password'
  | 'reset_password'
  | 'check_email'
  | 'session_loading';

// Session-storage key for safely carrying the signup email to the login screen.
// Only email is stored — never the password.
const PENDING_CONFIRM_EMAIL_KEY = 'pauseflow:pending_confirm_email';

const savePendingConfirmEmail = (e: string) => {
  try { sessionStorage.setItem(PENDING_CONFIRM_EMAIL_KEY, e); } catch (_) {}
};

const readAndClearPendingConfirmEmail = (): string => {
  try {
    const val = sessionStorage.getItem(PENDING_CONFIRM_EMAIL_KEY) || '';
    sessionStorage.removeItem(PENDING_CONFIRM_EMAIL_KEY);
    return val;
  } catch (_) { return ''; }
};

interface AuthContainerProps {
  initialScreen?: AuthScreen;
  onAuthenticated: (user: UserProfile) => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  initialScreen = 'welcome',
  onAuthenticated,
}) => {
  const [screen, setScreen] = useState<AuthScreen>(initialScreen);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetToken, setResetToken] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Synchronous submission lock to prevent concurrent double-click requests
  const isSubmittingRef = React.useRef(false);

  // Cooldown countdown timer for rate-limiting
  React.useEffect(() => {
    let timer: any;
    if (isRateLimited && rateLimitCountdown > 0) {
      timer = setInterval(() => {
        setRateLimitCountdown((prev) => {
          if (prev <= 1) {
            setIsRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRateLimited, rateLimitCountdown]);

  // Cooldown timer for email resend requests
  React.useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'None', color: 'bg-slate-700' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score === 2 || score === 3) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 4) return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
    return { score: 4, label: 'Excellent', color: 'bg-sky-400' };
  }, [password]);

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Pre-fill email from sessionStorage when the login screen mounts after signup confirmation
  React.useEffect(() => {
    if (screen === 'login') {
      const savedEmail = readAndClearPendingConfirmEmail();
      if (savedEmail) {
        setEmail(savedEmail);
        setSuccessMsg('Your account is confirmed — enter your password to log in.');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // 1. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (isSubmittingRef.current || loading) return;

    if (!email.trim()) {
      setErrorMsg('Email address is required');
      return;
    }
    if (!validateEmail(email.trim())) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!password) {
      setErrorMsg('Password is required');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const res = await authService.signIn(email.trim(), password);
      if (res.error) {
        if (res.isRateLimited) {
          setIsRateLimited(true);
          setRateLimitCountdown(60);
        }
        setErrorMsg(res.error);
        return;
      }

      if (res.user) {
        onAuthenticated(res.user);
      }
    } catch (err: any) {
      console.error('[PauseFlow Login Exception]', err);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setErrorMsg(
        isOffline
          ? 'Unable to connect right now. Please check your Internet connection and try again.'
          : (err?.message || 'Unable to sign in. Please verify your credentials.')
      );
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // 2. Handle Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (isSubmittingRef.current || loading || isRateLimited) return;

    if (!email.trim()) {
      setErrorMsg('Email address is required');
      return;
    }
    if (!validateEmail(email.trim())) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!password) {
      setErrorMsg('Password is required');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const res = await authService.signUp(
        email.trim(),
        password,
        displayName.trim() || undefined
      );

      if (res.error) {
        if (res.isRateLimited) {
          setIsRateLimited(true);
          setRateLimitCountdown(60);
        }
        setErrorMsg(res.error);
        return;
      }

      if (res.requiresEmailConfirmation) {
        // Save only the email (never the password) for pre-filling the login screen later
        savePendingConfirmEmail(email.trim().toLowerCase());
        setScreen('check_email');
      } else if (res.user) {
        onAuthenticated(res.user);
      }
    } catch (err: any) {
      console.error('[PauseFlow Sign Up Exception]', err);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setErrorMsg(
        isOffline
          ? 'Unable to connect right now. Please check your Internet connection and try again.'
          : (err?.message || 'Something went wrong while creating your account. Please try again.')
      );
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // 3. Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim() || !validateEmail(email.trim())) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.resetPasswordForEmail(email.trim());
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      setSuccessMsg('Password reset link has been sent to your email address.');
      setScreen('login');
    } catch (err: any) {
      console.error('[PauseFlow Forgot Password Exception]', err);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setErrorMsg(
        isOffline
          ? 'Unable to connect right now. Please check your Internet connection and try again.'
          : 'Unable to dispatch reset link right now. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!password) {
      setErrorMsg('New password is required');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('New password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.updatePassword(password);
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      setSuccessMsg('Password has been successfully updated! You can now log in.');
      setPassword('');
      setConfirmPassword('');
      setScreen('login');
    } catch (err: any) {
      console.error('[PauseFlow Reset Password Exception]', err);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setErrorMsg(
        isOffline
          ? 'Unable to connect right now. Please check your Internet connection and try again.'
          : 'Unable to update password right now. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Email Verification Code
  const handleResendVerification = async () => {
    if (resendCooldown > 0 || loading) return;
    clearMessages();
    setLoading(true);
    try {
      const res = await authService.sendVerification(email.trim());
      if (res.error) {
        if (res.isRateLimited) {
          setIsRateLimited(true);
          setRateLimitCountdown(60);
        }
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('A new confirmation email has been dispatched to your email address.');
        setResendCooldown(60);
      }
    } catch (err: any) {
      console.error('[PauseFlow Resend Verification Exception]', err);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setErrorMsg(
        isOffline
          ? 'Unable to connect right now. Please check your Internet connection and try again.'
          : 'Could not resend confirmation email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // VIEW: Session Loading State
  // ==========================================
  React.useEffect(() => {
    if (initialScreen) {
      setScreen(initialScreen);
    }
  }, [initialScreen]);

  if (screen === 'session_loading') {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-6 select-none">
        <div className="flex flex-col items-center text-center space-y-6 max-w-sm">
          <div className="relative">
            <BrandLogo size="xl" showText={false} imageClassName="animate-pulse" />
            <div className="absolute -inset-2 bg-sky-500/20 blur-xl rounded-full pointer-events-none" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              PauseFlow
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Starting your eye wellness routine...
            </p>
          </div>

          <div className="w-40 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-sky-500 to-teal-400 animate-[shimmer_1.2s_infinite_linear] rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: Landing Page (Section 3 & Master Redesign)
  // ==========================================
  if (screen === 'welcome') {
    return (
      <div className="min-h-screen bg-[#0B0F14] text-slate-100 flex flex-col justify-between items-center px-4 py-8 sm:py-12 relative overflow-hidden select-none">
        {/* Subtle Ambient Wellness Lighting Glows */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[540px] h-[300px] bg-sky-500/[0.07] blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-10 right-1/4 w-[380px] h-[220px] bg-indigo-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

        {/* 1. Compact PauseFlow Brand Header */}
        <header className="flex items-center justify-center z-10 animate-fade-in">
          <BrandLogo size="lg" />
        </header>

        {/* 2. Main Hero Content Container */}
        <main className="w-full max-w-[540px] mx-auto my-auto text-center space-y-6 sm:space-y-7 z-10 py-4 animate-fade-in">
          {/* Typography Hierarchy */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-[42px] font-extrabold tracking-tight leading-[1.18] text-white">
              Healthier screen habits, <br />
              <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-sky-300 bg-clip-text text-transparent">
                one break at a time.
              </span>
            </h1>
            <p className="text-sm sm:text-[15px] text-slate-400 max-w-[460px] mx-auto leading-relaxed">
              PauseFlow helps you protect your vision and stay hydrated with gentle, automated background reminders.
            </p>
          </div>

          {/* 3. Compact Benefit Panel */}
          <div className="bg-[#121822]/90 border border-slate-800/80 rounded-[20px] p-3.5 sm:p-4 text-left shadow-xl shadow-black/40 space-y-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-200">20–20–20 Eye Breaks</h4>
                <p className="text-[11px] text-slate-400 truncate">Gentle screen breaks to prevent strain.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-200">Hydration Rhythm</h4>
                <p className="text-[11px] text-slate-400 truncate">Personalized water care and timing.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-200">Background Operation</h4>
                <p className="text-[11px] text-slate-400 truncate">Works quietly with native tray and notification support.</p>
              </div>
            </div>
          </div>

          {/* 4. Action Buttons (Primary Sign Up, Secondary Login) */}
          <div className="space-y-3 w-full pt-1">
            {/* PRIMARY CTA: Create your account */}
            <button
              onClick={() => {
                clearMessages();
                setScreen('signup');
              }}
              className="w-full h-[52px] sm:h-[56px] rounded-xl bg-gradient-to-r from-sky-500 via-sky-400 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-slate-950 font-bold text-[15px] sm:text-[16px] flex items-center justify-center gap-2.5 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 group"
            >
              <span>Create your account</span>
              <ArrowRight className="w-4 h-4 text-slate-950 transition-transform group-hover:translate-x-1" />
            </button>

            {/* SECONDARY CTA: Log in */}
            <button
              onClick={() => {
                clearMessages();
                setScreen('login');
              }}
              className="w-full h-[52px] sm:h-[56px] rounded-xl bg-[#17202d]/80 hover:bg-[#1f2b3c] border border-slate-700/70 hover:border-slate-600 text-slate-200 hover:text-white font-semibold text-[15px] sm:text-[16px] flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-400 active:scale-[0.99]"
            >
              Log in
            </button>
          </div>
        </main>

        {/* 5. Supporting Footer Line */}
        <footer className="text-xs text-slate-500 tracking-wide font-medium text-center z-10 pt-2">
          Private &bull; Simple &bull; Automatic
        </footer>
      </div>
    );
  }

  // ==========================================
  // SHARED FORM WRAPPER (Login, Sign Up, Forgot, Reset, Verification)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#0B0F14] text-slate-100 flex flex-col justify-between items-center px-4 py-8 sm:py-12 relative overflow-hidden select-none">
      {/* Subtle Ambient Wellness Lighting Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[540px] h-[300px] bg-sky-500/[0.07] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[380px] h-[220px] bg-indigo-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

      {/* Header with Navigation and Branding */}
      <header className="w-full max-w-[460px] mx-auto flex items-center justify-between z-10 animate-fade-in mb-4">
        <button
          type="button"
          onClick={() => {
            clearMessages();
            if (screen === 'reset_password' || screen === 'forgot_password' || screen === 'check_email') {
              setScreen('login');
            } else {
              setScreen('welcome');
            }
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer py-1.5 px-2.5 -ml-2 rounded-xl hover:bg-slate-800/60"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to home</span>
        </button>

        <BrandLogo size="md" />
      </header>

      {/* Main Authentication Card */}
      <div className="w-full max-w-[460px] mx-auto my-auto relative z-10 bg-[#121822]/95 border border-slate-800/80 rounded-[24px] p-6 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-md space-y-5 animate-fade-in">
        {/* Global Feedback Messages */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start justify-between gap-2.5 animate-shake">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
            {errorMsg.includes('already registered') && screen === 'signup' && (
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setScreen('login');
                }}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Log in
              </button>
            )}
            {isRateLimited && (
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setScreen('login');
                }}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Go to Log in
              </button>
            )}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* ==========================================
            VIEW: LOGIN
        ========================================== */}
        {screen === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <h2 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight">
                Welcome back
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Continue your wellness journey.
              </p>
            </div>

            <div className="space-y-3.5 pt-1">
              {/* Email Field */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-300">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-[50px] sm:h-[52px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setScreen('forgot_password');
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 hover:underline font-medium transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[50px] sm:h-[52px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="w-8 h-8 absolute right-2 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Primary CTA: Log in */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] sm:h-[54px] rounded-xl bg-gradient-to-r from-sky-500 via-sky-400 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-slate-950 font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed group mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Log in</span>
                  <ArrowRight className="w-4 h-4 text-slate-950 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            {/* Switch to Sign Up */}
            <div className="text-center pt-3 border-t border-slate-800/80">
              <p className="text-xs text-slate-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setScreen('signup');
                  }}
                  className="text-sky-400 font-semibold hover:text-sky-300 hover:underline ml-1 cursor-pointer transition-colors"
                >
                  Create account
                </button>
              </p>
            </div>
          </form>
        )}

        {/* ==========================================
            VIEW: SIGN UP
        ========================================== */}
        {screen === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <h2 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight">
                Create your account
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Start building healthier screen habits.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {/* Display Name Field */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Full name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Smith"
                    className="w-full h-[48px] sm:h-[50px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-[48px] sm:h-[50px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="w-full h-[48px] sm:h-[50px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="w-8 h-8 absolute right-2 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Inline Dynamic Password Guidance */}
                {password.length > 0 && (
                  <div className="pt-1.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Strength:</span>
                      <span className="font-semibold text-slate-200">{passwordStrength.label}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 h-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`rounded-full h-full transition-all ${
                            level <= passwordStrength.score ? passwordStrength.color : 'bg-slate-700/40'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className={password.length >= 6 ? 'text-emerald-400 font-medium' : ''}>
                        {password.length >= 6 ? '✓' : '○'} 6+ chars
                      </span>
                      <span className={/[0-9]/.test(password) ? 'text-emerald-400 font-medium' : ''}>
                        {/[0-9]/.test(password) ? '✓' : '○'} Number
                      </span>
                      <span className={/[A-Z]/.test(password) ? 'text-emerald-400 font-medium' : ''}>
                        {/[A-Z]/.test(password) ? '✓' : '○'} Uppercase
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Confirm password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full h-[48px] sm:h-[50px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="w-8 h-8 absolute right-2 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Real-time Confirm Password Feedback */}
                {confirmPassword && (
                  <div className="pt-0.5">
                    {password === confirmPassword ? (
                      <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        ✓ Passwords match
                      </p>
                    ) : (
                      <p className="text-[11px] text-rose-400 font-medium">
                        Passwords do not match
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Primary CTA: Create your account */}
            <button
              type="submit"
              disabled={loading || isRateLimited}
              className={`w-full h-[52px] sm:h-[54px] rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 mt-2 ${
                isRateLimited
                  ? 'bg-slate-800 text-slate-400 border border-slate-700/80 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-500 via-sky-400 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-slate-950 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer group'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Creating account...</span>
                </>
              ) : isRateLimited ? (
                <span>Please wait ({rateLimitCountdown}s)</span>
              ) : (
                <>
                  <span>Create your account</span>
                  <ArrowRight className="w-4 h-4 text-slate-950 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            {/* Switch to Login */}
            <div className="text-center pt-3 border-t border-slate-800/80">
              <p className="text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setScreen('login');
                  }}
                  className="text-sky-400 font-semibold hover:text-sky-300 hover:underline ml-1 cursor-pointer transition-colors"
                >
                  Log in
                </button>
              </p>
            </div>
          </form>
        )}

        {/* ==========================================
            VIEW: FORGOT PASSWORD
        ========================================== */}
        {screen === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <h2 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight">
                Forgot password
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Enter your account email to receive a password reset link.
              </p>
            </div>

            <div className="space-y-3.5 pt-1">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold text-slate-300">Registered email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-[50px] sm:h-[52px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] sm:h-[54px] rounded-xl bg-gradient-to-r from-sky-500 via-sky-400 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-slate-950 font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed group mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                'Send reset link'
              )}
            </button>

            <div className="flex flex-col gap-2 text-center pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setScreen('reset_password');
                }}
                className="text-xs text-sky-400 font-semibold hover:text-sky-300 hover:underline cursor-pointer"
              >
                Already have a reset token? Enter it here
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setScreen('login');
                }}
                className="text-xs text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                Back to Log in
              </button>
            </div>
          </form>
        )}

        {/* ==========================================
            VIEW: RESET PASSWORD
        ========================================== */}
        {screen === 'reset_password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <h2 className="text-2xl sm:text-[28px] font-extrabold text-white tracking-tight">
                Reset password
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Enter your reset token and define a new secure password.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Reset token</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter reset token"
                    className="w-full h-[48px] sm:h-[50px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">New password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full h-[48px] sm:h-[50px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="w-8 h-8 absolute right-2 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-300">Confirm new password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full h-[48px] sm:h-[50px] rounded-xl bg-[#17202d]/90 border border-slate-700/60 focus:border-sky-400 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-150 focus:ring-2 focus:ring-sky-400/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="w-8 h-8 absolute right-2 top-1/2 -translate-y-1/2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] sm:h-[54px] rounded-xl bg-gradient-to-r from-sky-500 via-sky-400 to-teal-400 hover:from-sky-400 hover:to-teal-300 text-slate-950 font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed group mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Resetting password...</span>
                </>
              ) : (
                'Reset password & sign in'
              )}
            </button>

            <div className="text-center pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setScreen('login');
                }}
                className="text-xs text-sky-400 font-semibold hover:text-sky-300 hover:underline cursor-pointer"
              >
                Back to Log in
              </button>
            </div>
          </form>
        )}

        {/* ==========================================
            VIEW: CHECK EMAIL (Post-Signup Confirmation Notice)
        ========================================== */}
        {screen === 'check_email' && (
          <div className="space-y-5">
            {/* Icon + Heading */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/10">
                <Mail className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl sm:text-[26px] font-extrabold text-white tracking-tight">
                  Check your email 📧
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  We've sent a confirmation link to{' '}
                  <strong className="text-sky-300 break-all">{email || 'your email address'}</strong>.
                  <br />
                  Please confirm your email to continue.
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-2.5">
              {[
                { num: '1', text: 'Open your email inbox' },
                { num: '2', text: 'Find the email from PauseFlow' },
                { num: '3', text: 'Click "Confirm My Email"' },
                { num: '4', text: 'Return here and log in' },
              ].map(({ num, text }) => (
                <div key={num} className="flex items-center gap-3 text-xs text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {num}
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* Spam note */}
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Didn't receive it? Check your spam folder.{' '}
              <br className="sm:hidden" />
              The email may take a minute to arrive.
            </p>

            {/* Resend Button */}
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading || resendCooldown > 0}
              className="w-full h-[48px] rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 hover:border-slate-600 text-slate-300 hover:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : resendCooldown > 0 ? (
                <span>Resend confirmation email ({resendCooldown}s)</span>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Resend confirmation email</span>
                </>
              )}
            </button>

            {/* Back to login */}
            <div className="text-center pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setScreen('login');
                }}
                className="text-xs text-sky-400 font-semibold hover:text-sky-300 hover:underline cursor-pointer transition-colors"
              >
                Back to Log in
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Supporting Footer */}
      <footer className="text-xs text-slate-500 tracking-wide font-medium text-center z-10 pt-2">
        Private &bull; Simple &bull; Automatic
      </footer>
    </div>
  );
};

