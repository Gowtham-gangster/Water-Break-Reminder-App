// src/services/authService.ts
// EyeFlow V2 — Official Supabase Authentication Service

import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './supabaseClient.ts';
import { storageEngine } from '../engine/storageEngine.ts';

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
}

export class AuthService {
  private inFlightSignUpPromise: Promise<AuthResponse<{ user: User | null; session: Session | null }>> | null = null;
  private inFlightSignInPromise: Promise<AuthResponse<{ user: User; session: Session }>> | null = null;

  /**
   * Checks if an error is an authentication rate limit error
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
      code === 'email_rate_limit_exceeded' ||
      code === 'over_email_send_rate_limit' ||
      lower.includes('rate limit') ||
      lower.includes('too many') ||
      lower.includes('email rate limit')
    );
  }

  /**
   * Formats Supabase Auth error messages into safe, user-friendly strings
   */
  public formatAuthError(err: any): string {
    if (!err) return 'An unexpected authentication error occurred.';

    // Structured development logging without exposing sensitive data
    console.error('[EyeFlow Auth Error Diagnostics]', {
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

    // 1. Rate Limit / Too Many Attempts (HTTP 429)
    if (this.isRateLimitError(err)) {
      return 'Too many signup attempts. Please wait a few minutes before trying again.';
    }

    // 2. Email Already Exists
    if (
      code === 'user_already_exists' ||
      lower.includes('user already registered') ||
      lower.includes('email address already in use') ||
      lower.includes('already exists')
    ) {
      return 'This email is already registered. Try logging in instead.';
    }

    // 3. Invalid Email Address Format or Domain
    if (
      code === 'email_address_invalid' ||
      (lower.includes('email address') && lower.includes('invalid')) ||
      lower.includes('invalid email')
    ) {
      return 'Please enter a valid, deliverable email address.';
    }

    // 4. Invalid Credentials
    if (
      lower.includes('invalid login credentials') ||
      lower.includes('invalid_grant') ||
      code === 'invalid_credentials'
    ) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }

    // 5. Email Not Confirmed
    if (lower.includes('email not confirmed')) {
      return 'Please verify your email address before logging in. Check your inbox for the confirmation link.';
    }

    // 6. Weak / Rejected Password
    if (
      code === 'weak_password' ||
      lower.includes('password should be at least') ||
      lower.includes('password is too weak')
    ) {
      return 'Your password does not meet security requirements. Please use at least 6 characters.';
    }

    // 7. Network / Fetch Failures vs Service Unreachable
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

    // 8. Timeout
    if (lower.includes('timeout') || lower.includes('took too long') || code === 'timeout') {
      return 'The request took too long to complete. Please try again.';
    }

    return msg || 'Authentication request could not be completed. Please try again.';
  }

  /**
   * Helper to convert Supabase User to EyeFlow UserProfile
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
   * Register a new user with Supabase Auth with single-flight deduplication
   */
  public async signUp(
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthResponse<{ user: User | null; session: Session | null }>> {
    // If a signup request is already in-flight, return the active promise to avoid duplicate network calls
    if (this.inFlightSignUpPromise) {
      console.warn('[EyeFlow Auth] Duplicate signup call intercepted; returning active request promise.');
      return this.inFlightSignUpPromise;
    }

    this.inFlightSignUpPromise = (async () => {
      try {
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = displayName?.trim() || cleanEmail.split('@')[0];
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: cleanName,
              timezone,
            },
          },
        });

        if (error) {
          return {
            data: null,
            user: null,
            session: null,
            error: this.formatAuthError(error),
            isRateLimited: this.isRateLimitError(error),
          };
        }

        const userProfile = data.user ? this.toUserProfile(data.user) : null;
        const requiresEmailConfirmation = !data.session && Boolean(data.user);

        return {
          data: { user: data.user, session: data.session },
          user: userProfile,
          session: data.session,
          error: null,
          requiresEmailConfirmation,
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
      console.warn('[EyeFlow Auth] Duplicate signin call intercepted; returning active request promise.');
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
   * Safe promise wrapper with timeout to prevent network operations from blocking indefinitely
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number = 4000, fallback: T): Promise<T> {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallback), ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch {
      clearTimeout(timeoutId);
      return fallback;
    }
  }

  /**
   * Restore current active session from Supabase's built-in persistence with strict timeout
   */
  public async getSession(): Promise<Session | null> {
    return this.withTimeout(
      (async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) return null;
          return data.session;
        } catch {
          return null;
        }
      })(),
      4000,
      null
    );
  }

  /**
   * Get current authenticated user with strict timeout
   */
  public async getCurrentUser(): Promise<UserProfile | null> {
    return this.withTimeout(
      (async () => {
        try {
          const { data, error } = await supabase.auth.getUser();
          if (error || !data.user) return null;
          const user = this.toUserProfile(data.user);
          try {
            const cachedProfile =
              (await storageEngine.loadProfile(user.id)) ||
              (await storageEngine.get<any>(`eyeflow:v2:${user.id}:profile`, null));
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
      })(),
      4000,
      null
    );
  }

  /**
   * Restores session and validates user state on app startup with strict fallback
   */
  public async restoreSession(): Promise<{ user: UserProfile | null; session: Session | null; isAuthenticated: boolean }> {
    return this.withTimeout(
      (async () => {
        try {
          const session = await this.getSession();
          if (!session || !session.user) {
            return { user: null, session: null, isAuthenticated: false };
          }

          const user = this.toUserProfile(session.user);
          try {
            const cachedProfile =
              (await storageEngine.loadProfile(user.id)) ||
              (await storageEngine.get<any>(`eyeflow:v2:${user.id}:profile`, null));
            if (cachedProfile) {
              if (cachedProfile.avatar_url) user.avatar_url = cachedProfile.avatar_url;
              if (cachedProfile.display_name) user.display_name = cachedProfile.display_name;
              if (cachedProfile.timezone) user.timezone = cachedProfile.timezone;
            }
          } catch (_) {}
          return { user, session, isAuthenticated: true };
        } catch {
          return { user: null, session: null, isAuthenticated: false };
        }
      })(),
      4000,
      { user: null, session: null, isAuthenticated: false }
    );
  }

  /**
   * Sign out and perform full user state & cache teardown
   */
  public async signOut(userId?: string): Promise<{ error: string | null }> {
    try {
      if (userId) {
        // Clear user-scoped transient state and active timers
        await storageEngine.clearUserScopedTransientState(userId);
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
        redirectTo: redirectTo || (typeof window !== 'undefined' ? window.location.origin : undefined),
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
    return Boolean(supabase.auth.getSession());
  }

  /**
   * Alias for getCurrentUser
   */
  public async getActiveUser(): Promise<UserProfile | null> {
    return this.getCurrentUser();
  }

  /**
   * Resend confirmation / verification email
   */
  public async sendVerification(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
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
      // Delete user profile record (triggers cascade if FK exists)
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

