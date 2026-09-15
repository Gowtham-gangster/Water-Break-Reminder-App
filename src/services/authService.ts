// src/services/authService.ts
// PauseFlow V2 — Official Supabase Authentication Service & Session Persistence Engine

import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabaseClient.ts';
import { storageEngine } from '../engine/storageEngine.ts';

export const AUTH_STORAGE_KEY = 'pauseflow:v2:auth:session';
export const LEGACY_AUTH_STORAGE_KEY = 'eyeflow:v2:auth:session';

/** Production deployment URL for email confirmation redirects */
export const PRODUCTION_URL = 'https://pauseflow-break-reminder-app.vercel.app';

/**
 * Returns the email confirmation redirect URL.
 * - In local browser development (Vite dev server on localhost, not Capacitor native), allows local dev origin.
 * - In production builds, deployed Vercel web app, and Android/Capacitor native builds, always pins to the live production Vercel URL.
 */
export function getConfirmationRedirectUrl(): string {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isCapacitor = (window as any).Capacitor?.isNativePlatform?.() || window.location.protocol === 'capacitor:';
    if (isLocalhost && !isCapacitor && import.meta.env.DEV) {
      return window.location.origin;
    }
  }
  return PRODUCTION_URL;
}


export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  timezone?: string;
  created_at?: string;
}

export interface AuthResponse<T = any> {
  data: T | null;
  user: UserProfile | null;
  session: Session | null;
  error: string | null;
  requiresEmailConfirmation?: boolean;
  isRateLimited?: boolean;
  isEmailRateLimited?: boolean;
}

export class AuthService {
  private inFlightSignUpPromise: Promise<AuthResponse<{ user: User | null; session: Session | null }>> | null = null;
  private inFlightSignInPromise: Promise<AuthResponse<{ user: User; session: Session }>> | null = null;
  private isRefreshingToken = false;

  /**
   * Checks if an error is specifically an email delivery provider rate limit
   */
  public isEmailRateLimitError(err: any): boolean {
    if (!err) return false;
    const msg = typeof err === 'string' ? err : err.message || '';
    const code = err?.code || '';
    const lower = msg.toLowerCase();

    return (
      code === 'over_email_send_rate_limit' ||
      code === 'email_rate_limit_exceeded' ||
      lower.includes('over_email_send_rate_limit') ||
      lower.includes('email_rate_limit_exceeded') ||
      lower.includes('email rate limit') ||
      lower.includes('over email send rate limit')
    );
  }

  /**
   * Checks if an error is any authentication or request rate limit error
   */
  public isRateLimitError(err: any): boolean {
    if (!err) return false;
    const msg = typeof err === 'string' ? err : err.message || '';
    const code = err?.code || '';
    const status = err?.status || 0;
    const lower = msg.toLowerCase();

    return (
      status === 429 ||
      code === 'over_request_rate_limit' ||
      code === 'too_many_requests' ||
      this.isEmailRateLimitError(err) ||
      lower.includes('rate limit') ||
      lower.includes('too many') ||
      lower.includes('too many requests')
    );
  }

  /**
   * Formats Supabase Auth error messages into safe, user-friendly strings
   */
  public formatAuthError(err: any): string {
    if (!err) return 'An unexpected authentication error occurred.';

    console.error('[PauseFlow Auth Error Diagnostics]', {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      name: err?.name,
      details: err?.details,
      hint: err?.hint,
    });

    const msg = typeof err === 'string' ? err : err.message || '';
    const code = err?.code || '';
    const lower = msg.toLowerCase();

    if (this.isEmailRateLimitError(err)) {
      return "Email service temporarily unavailable. We couldn't send the confirmation email right now. Please try again later. If you already created an account, check your inbox or log in.";
    }

    if (this.isRateLimitError(err)) {
      return 'Too many attempts. Please wait a moment before trying again.';
    }

    if (
      code === 'user_already_exists' ||
      lower.includes('user already registered') ||
      lower.includes('email address already in use') ||
      lower.includes('already exists')
    ) {
      return 'This email is already registered. Try logging in instead.';
    }

    if (
      code === 'email_address_invalid' ||
      (lower.includes('email address') && lower.includes('invalid')) ||
      lower.includes('invalid email')
    ) {
      return 'Please enter a valid, deliverable email address.';
    }

    if (
      lower.includes('invalid login credentials') ||
      lower.includes('invalid_grant') ||
      code === 'invalid_credentials'
    ) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }

    if (lower.includes('email not confirmed')) {
      return 'Please verify your email address before logging in. Check your inbox for the confirmation link.';
    }

    if (
      code === 'weak_password' ||
      lower.includes('password should be at least') ||
      lower.includes('password is too weak')
    ) {
      return 'Your password does not meet security requirements. Please use at least 6 characters.';
    }

    if (
      lower.includes('failed to fetch') ||
      lower.includes('network error') ||
      lower.includes('networkerror') ||
      lower.includes('err_connection_refused') ||
      lower.includes('err_name_not_resolved')
    ) {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        return 'Unable to connect right now. Please check your Internet connection and try again.';
      }
      return 'Authentication service is temporarily unavailable. Please try again shortly.';
    }

    if (lower.includes('timeout') || lower.includes('took too long') || code === 'timeout') {
      return 'The request took too long to complete. Please try again.';
    }

    return msg || 'Authentication request could not be completed. Please try again.';
  }

  /**
   * Helper to convert Supabase User to PauseFlow UserProfile
   */
  public toUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email || '',
      display_name:
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'PauseFlow User',
      avatar_url: user.user_metadata?.avatar_url || null,
      timezone: user.user_metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      created_at: user.created_at,
    };
  }

  /**
   * Reads raw persisted session directly from local storage synchronously
   * Checks new pauseflow key first, then falls back to legacy eyeflow key and migrates.
   */
  public getLocalPersistedSession(): Session | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        let raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) {
          raw = window.localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
          if (raw) {
            window.localStorage.setItem(AUTH_STORAGE_KEY, raw);
          }
        }
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.user || parsed.access_token)) {
            return parsed as Session;
          }
        }
      }
    } catch (e) {
      console.warn('[PauseFlow Auth] Could not read local persisted session:', e);
    }
    return null;
  }

  /**
   * Register a new user with Supabase Auth with single-flight deduplication and diagnostic tracking
   */
  public async signUp(
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthResponse<{ user: User | null; session: Session | null }>> {
    if (this.inFlightSignUpPromise) {
      console.warn('[PauseFlow Auth] Duplicate signup call intercepted; returning active request promise.');
      return this.inFlightSignUpPromise;
    }

    const signupRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`[PauseFlow][AUTH] stage=SIGNUP_START requestId=${signupRequestId} emailDomain=${email.includes('@') ? email.split('@')[1] : 'unknown'}`);

    this.inFlightSignUpPromise = (async () => {
      try {
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = displayName?.trim() || cleanEmail.split('@')[0];
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: getConfirmationRedirectUrl(),
            data: {
              display_name: cleanName,
              name: cleanName,
              full_name: cleanName,
              timezone,
            },
          },
        });

        if (error) {
          const isRateLimit = this.isRateLimitError(error);
          const isEmailRateLimit = this.isEmailRateLimitError(error);
          console.error(`[PauseFlow][AUTH] stage=SIGNUP_RESPONSE requestId=${signupRequestId} success=false status=${(error as any)?.status || 400} code=${(error as any)?.code || 'unknown'} message=${error.message}`);
          return {
            data: null,
            user: null,
            session: null,
            error: this.formatAuthError(error),
            isRateLimited: isRateLimit,
            isEmailRateLimited: isEmailRateLimit,
          };
        }

        const userProfile = data.user ? this.toUserProfile(data.user) : null;
        const requiresEmailConfirmation = !data.session && Boolean(data.user);

        console.log(`[PauseFlow][AUTH] stage=SIGNUP_RESPONSE requestId=${signupRequestId} success=true requiresConfirmation=${requiresEmailConfirmation} userId=${data.user?.id || 'none'}`);

        return {
          data: { user: data.user, session: data.session },
          user: userProfile,
          session: data.session,
          error: null,
          requiresEmailConfirmation,
          isRateLimited: false,
          isEmailRateLimited: false,
        };
      } catch (err: any) {
        const isRateLimit = this.isRateLimitError(err);
        const isEmailRateLimit = this.isEmailRateLimitError(err);
        console.error(`[PauseFlow][AUTH] stage=SIGNUP_ERROR requestId=${signupRequestId} message=${err?.message || err}`);
        return {
          data: null,
          user: null,
          session: null,
          error: this.formatAuthError(err),
          isRateLimited: isRateLimit,
          isEmailRateLimited: isEmailRateLimit,
        };
      } finally {
        this.inFlightSignUpPromise = null;
      }
    })();

    return this.inFlightSignUpPromise;
  }

  /**
   * Sign in existing user with email and password with single-flight deduplication
   */
  public async signIn(
    email: string,
    password: string
  ): Promise<AuthResponse<{ user: User; session: Session }>> {
    if (this.inFlightSignInPromise) {
      console.warn('[PauseFlow Auth] Duplicate signin call intercepted; returning active request promise.');
      return this.inFlightSignInPromise;
    }

    this.inFlightSignInPromise = (async () => {
      try {
        const cleanEmail = email.trim().toLowerCase();

        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error || !data.user || !data.session) {
          return {
            data: null,
            user: null,
            session: null,
            error: this.formatAuthError(error),
            isRateLimited: this.isRateLimitError(error),
          };
        }

        const userProfile = this.toUserProfile(data.user);

        return {
          data: { user: data.user, session: data.session },
          user: userProfile,
          session: data.session,
          error: null,
          isRateLimited: false,
        };
      } catch (err: any) {
        return {
          data: null,
          user: null,
          session: null,
          error: this.formatAuthError(err),
          isRateLimited: this.isRateLimitError(err),
        };
      } finally {
        this.inFlightSignInPromise = null;
      }
    })();

    return this.inFlightSignInPromise;
  }

  /**
   * Restore current active session from Supabase's built-in persistence or local fallback
   */
  public async getSession(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        return data.session;
      }
    } catch (_) {}
    return this.getLocalPersistedSession();
  }

  /**
   * Get current authenticated user with local profile hydration
   */
  public async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const session = await this.getSession();
      if (!session || !session.user) return null;

      const user = this.toUserProfile(session.user);
      try {
        const cachedProfile =
          (await storageEngine.loadProfile(user.id)) ||
          (await storageEngine.get<any>(`pauseflow:v2:${user.id}:profile`, null));
        if (cachedProfile) {
          if (cachedProfile.avatar_url) user.avatar_url = cachedProfile.avatar_url;
          if (cachedProfile.display_name) user.display_name = cachedProfile.display_name;
          if (cachedProfile.timezone) user.timezone = cachedProfile.timezone;
        }
      } catch (_) {}
      return user;
    } catch {
      return null;
    }
  }

  /**
   * Restores session and validates user state on app startup with complete offline resilience.
   * Follows the official PauseFlow multi-tier startup lifecycle:
   * 1. Check local persisted session immediately
   * 2. If session found -> user is authenticated immediately
   * 3. If online -> refresh session in background without blocking UI
   * 4. If offline -> authenticate from local cache
   */
  public async restoreSession(): Promise<{ user: UserProfile | null; session: Session | null; isAuthenticated: boolean }> {
    console.log('[AUTH BOOT: START]');
    console.log('[AUTH BOOT: PERSISTED SESSION CHECK]');

    // Step 1: Immediate local storage inspection
    const localSession = this.getLocalPersistedSession();

    if (localSession && localSession.user) {
      console.log('[AUTH BOOT: SESSION FOUND (LOCAL STORAGE)]');
      const user = this.toUserProfile(localSession.user);

      // Hydrate profile from local cache
      console.log('[AUTH BOOT: PROFILE HYDRATION]');
      try {
        const cachedProfile =
          (await storageEngine.loadProfile(user.id)) ||
          (await storageEngine.get<any>(`pauseflow:v2:${user.id}:profile`, null));
        if (cachedProfile) {
          if (cachedProfile.avatar_url) user.avatar_url = cachedProfile.avatar_url;
          if (cachedProfile.display_name) user.display_name = cachedProfile.display_name;
          if (cachedProfile.timezone) user.timezone = cachedProfile.timezone;
        }
      } catch (err) {
        console.warn('[AUTH BOOT: PROFILE HYDRATION NON-FATAL ERROR]', err);
      }

      console.log('[AUTH BOOT: AUTH STATE = AUTHENTICATED]');
      console.log('[AUTH BOOT: READY]');

      // Step 2: Background session verification & refresh (Non-blocking)
      const isOnline = typeof navigator === 'undefined' || navigator.onLine;
      if (isOnline && !this.isRefreshingToken) {
        this.isRefreshingToken = true;
        console.log('[AUTH BOOT: SESSION REFRESH START]');
        (async () => {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              const lower = error.message?.toLowerCase() || '';
              if (
                lower.includes('invalid_grant') ||
                lower.includes('refresh_token_not_found') ||
                lower.includes('user not found')
              ) {
                console.warn('[AUTH BOOT: SESSION REFRESH FAILURE — EXPLICITLY REVOKED]', error.message);
                await this.signOut(user.id);
                return;
              }
              console.warn('[AUTH BOOT: SESSION REFRESH NETWORK TRANSIENT FAILURE (RETAINING SESSION)]', error.message);
            } else if (data.session) {
              console.log('[AUTH BOOT: SESSION REFRESH SUCCESS]');
            }
          } catch (refErr: any) {
            console.warn('[AUTH BOOT: SESSION REFRESH SKIPPED/OFFLINE]', refErr?.message || refErr);
          } finally {
            this.isRefreshingToken = false;
          }
        })();
      } else if (!isOnline) {
        console.log('[AUTH BOOT: OFFLINE MODE — USING LOCAL PERSISTENCE]');
      }

      return { user, session: localSession, isAuthenticated: true };
    }

    // Step 3: No raw local session found -> Try official Supabase client getSession()
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session && data.session.user) {
        console.log('[AUTH BOOT: SESSION FOUND (SUPABASE CLIENT)]');
        const user = this.toUserProfile(data.session.user);

        console.log('[AUTH BOOT: PROFILE HYDRATION]');
        try {
          const cachedProfile =
            (await storageEngine.loadProfile(user.id)) ||
            (await storageEngine.get<any>(`pauseflow:v2:${user.id}:profile`, null));
          if (cachedProfile) {
            if (cachedProfile.avatar_url) user.avatar_url = cachedProfile.avatar_url;
            if (cachedProfile.display_name) user.display_name = cachedProfile.display_name;
            if (cachedProfile.timezone) user.timezone = cachedProfile.timezone;
          }
        } catch (_) {}

        console.log('[AUTH BOOT: AUTH STATE = AUTHENTICATED]');
        console.log('[AUTH BOOT: READY]');
        return { user, session: data.session, isAuthenticated: true };
      }
    } catch (err: any) {
      console.warn('[AUTH BOOT: getSession error]', err?.message || err);
    }

    // Step 4: Truly unauthenticated (no session exists anywhere)
    console.log('[AUTH BOOT: SESSION NOT FOUND]');
    console.log('[AUTH BOOT: AUTH STATE = UNAUTHENTICATED]');
    console.log('[AUTH BOOT: READY]');
    return { user: null, session: null, isAuthenticated: false };
  }

  /**
   * Sign out and perform full user state & cache teardown
   */
  public async signOut(userId?: string): Promise<{ error: string | null }> {
    try {
      if (userId) {
        await storageEngine.clearUserScopedTransientState(userId);
      }

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error: this.formatAuthError(error) };
      }
      return { error: null };
    } catch (err: any) {
      return { error: this.formatAuthError(err) };
    }
  }

  /**
   * Alias for backward compatibility with older components
   */
  public async logout(userId?: string): Promise<{ error: string | null }> {
    return this.signOut(userId);
  }

  /**
   * Send password reset email
   */
  public async resetPasswordForEmail(email: string, redirectTo?: string): Promise<{ error: string | null }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectTo || getConfirmationRedirectUrl(),
      });
      if (error) {
        return { error: this.formatAuthError(error) };
      }
      return { error: null };
    } catch (err: any) {
      return { error: this.formatAuthError(err) };
    }
  }

  /**
   * Update password for current session
   */
  public async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return { error: this.formatAuthError(error) };
      }
      return { error: null };
    } catch (err: any) {
      return { error: this.formatAuthError(err) };
    }
  }

  /**
   * Check whether a user is currently authenticated
   */
  public isAuthenticated(): boolean {
    return Boolean(this.getLocalPersistedSession() || supabase.auth.getSession());
  }

  /**
   * Alias for getCurrentUser
   */
  public async getActiveUser(): Promise<UserProfile | null> {
    return this.getCurrentUser();
  }

  /**
   * Resend confirmation / verification email with error formatting and rate limit classification
   */
  public async sendVerification(email: string): Promise<{ error: string | null; isRateLimited?: boolean; isEmailRateLimited?: boolean }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (error) {
        return {
          error: this.formatAuthError(error),
          isRateLimited: this.isRateLimitError(error),
          isEmailRateLimited: this.isEmailRateLimitError(error),
        };
      }
      return { error: null, isRateLimited: false, isEmailRateLimited: false };
    } catch (err: any) {
      return {
        error: this.formatAuthError(err),
        isRateLimited: this.isRateLimitError(err),
        isEmailRateLimited: this.isEmailRateLimitError(err),
      };
    }
  }

  /**
   * Change user email address
   */
  public async changeEmail(
    newEmail: string,
    _currentPassword?: string
  ): Promise<{ data: { user: UserProfile } | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: newEmail.trim().toLowerCase(),
      });
      if (error || !data.user) {
        return { data: null, error: this.formatAuthError(error) };
      }
      return { data: { user: this.toUserProfile(data.user) }, error: null };
    } catch (err: any) {
      return { data: null, error: this.formatAuthError(err) };
    }
  }

  /**
   * Permanently delete user account and profile
   */
  public async deleteAccount(
    _password?: string
  ): Promise<{ error: string | null }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return { error: 'No active authenticated user to delete.' };
      }
      await (supabase.from('profiles') as any).delete().eq('id', user.id);
      await this.signOut(user.id);
      return { error: null };
    } catch (err: any) {
      return { error: this.formatAuthError(err) };
    }
  }

  /**
   * Central listener for Supabase Auth state changes
   */
  public onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();
