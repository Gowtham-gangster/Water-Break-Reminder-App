// src/services/profileService.ts
// PauseFlow V2 — Official Supabase User Profile Service

import { supabase } from './supabaseClient.ts';
import { storageEngine } from '../engine/storageEngine.ts';
import type { ProfileEntity } from '../types/index.ts';

export class ProfileService {
  /**
   * Returns the user-scoped local cache key for a profile
   */
  public getScopedProfileKey(userId: string): string {
    return `pauseflow:v2:${userId}:profile`;
  }

  /**
   * Fetch authenticated user's profile from Supabase with local cache fallback
   */
  public async getProfile(userId: string): Promise<{ profile: ProfileEntity | null; error: string | null }> {
    if (!userId) {
      return { profile: null, error: 'User ID is required to fetch profile.' };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .limit(1);

      if (data && data.length > 0 && !error) {
        const profile = data[0] as ProfileEntity;
        // Update user-scoped local cache
        await storageEngine.set(this.getScopedProfileKey(userId), profile);
        return { profile, error: null };
      }

      // If cloud query failed (e.g. offline), fallback to local user-scoped cache
      const cached = await storageEngine.get<ProfileEntity | null>(this.getScopedProfileKey(userId), null);
      if (cached) {
        return { profile: cached, error: null };
      }

      return { profile: null, error: error ? error.message : 'Profile not found.' };
    } catch (err: any) {
      // Fallback to local user-scoped cache
      const cached = await storageEngine.get<ProfileEntity | null>(this.getScopedProfileKey(userId), null);
      if (cached) {
        return { profile: cached, error: null };
      }
      return { profile: null, error: err?.message || 'Failed to fetch profile.' };
    }
  }

  /**
   * Create profile record in Supabase
   */
  public async createProfile(
    userId: string,
    profileData: {
      display_name?: string;
      avatar_url?: string | null;
      timezone?: string;
    }
  ): Promise<{ profile: ProfileEntity | null; error: string | null }> {
    if (!userId) {
      return { profile: null, error: 'User ID is required to create profile.' };
    }

    const payload: ProfileEntity = {
      id: userId,
      display_name: profileData.display_name?.trim() || 'PauseFlow User',
      avatar_url: profileData.avatar_url || null,
      timezone: profileData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await ((supabase
        .from('profiles') as any)
        .upsert(payload, { onConflict: 'id' })
        .select()
        .limit(1) as any);

      if (error) {
        // Fallback to caching locally in offline mode
        await storageEngine.set(this.getScopedProfileKey(userId), payload);
        return { profile: payload, error: null };
      }

      const created = (Array.isArray(data) ? data[0] : data) as ProfileEntity || payload;
      await storageEngine.set(this.getScopedProfileKey(userId), created);
      return { profile: created, error: null };
    } catch {
      await storageEngine.set(this.getScopedProfileKey(userId), payload);
      return { profile: payload, error: null };
    }
  }

  /**
   * Update user profile (display_name, avatar_url, timezone)
   */
  public async updateProfile(
    userId: string,
    updates: Partial<Pick<ProfileEntity, 'display_name' | 'avatar_url' | 'timezone'>>
  ): Promise<{ profile: ProfileEntity | null; error: string | null }> {
    if (!userId) {
      return { profile: null, error: 'User ID is required to update profile.' };
    }

    const cleanUpdates: Partial<ProfileEntity> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (cleanUpdates.display_name) {
      cleanUpdates.display_name = cleanUpdates.display_name.trim();
    }
    if (cleanUpdates.timezone) {
      cleanUpdates.timezone = cleanUpdates.timezone.trim();
    }

    try {
      // 1. Update in Supabase Profiles table with upsert
      const { data, error } = await ((supabase
        .from('profiles') as any)
        .upsert({ id: userId, ...cleanUpdates }, { onConflict: 'id' })
        .select()
        .limit(1) as any);

      // 2. Also enrich auth user metadata in background for instant session recovery
      supabase.auth.updateUser({
        data: {
          ...(cleanUpdates.display_name ? { display_name: cleanUpdates.display_name } : {}),
          ...(cleanUpdates.avatar_url !== undefined ? { avatar_url: cleanUpdates.avatar_url } : {}),
          ...(cleanUpdates.timezone ? { timezone: cleanUpdates.timezone } : {}),
        },
      }).catch(() => {});

      if (error) {
        console.warn('[ProfileService] Cloud upsert warning, trying fallback update:', error.message);
        const { data: updateData, error: updateError } = await ((supabase
          .from('profiles') as any)
          .update(cleanUpdates)
          .eq('id', userId)
          .select()
          .limit(1) as any);

        if (updateError || !updateData || updateData.length === 0) {
          const cached = (await storageEngine.get<ProfileEntity | null>(this.getScopedProfileKey(userId), null)) || {
            id: userId,
            display_name: 'PauseFlow User',
            avatar_url: null,
            timezone: 'UTC',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const updatedLocal = { ...cached, ...cleanUpdates } as ProfileEntity;
          await storageEngine.set(this.getScopedProfileKey(userId), updatedLocal);
          return { profile: updatedLocal, error: updateError?.message || error.message };
        }

        const updated = updateData[0] as ProfileEntity;
        await storageEngine.set(this.getScopedProfileKey(userId), updated);
        return { profile: updated, error: null };
      }

      const updated = (Array.isArray(data) ? data[0] : data) as ProfileEntity;
      // Update user-scoped local cache
      await storageEngine.set(this.getScopedProfileKey(userId), updated);
      console.log('[ProfileService] Cloud profile update confirmed:', updated);
      return { profile: updated, error: null };
    } catch {
      const cached = (await storageEngine.get<ProfileEntity | null>(this.getScopedProfileKey(userId), null)) || {
        id: userId,
        display_name: 'PauseFlow User',
        avatar_url: null,
        timezone: 'UTC',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updatedLocal = { ...cached, ...cleanUpdates } as ProfileEntity;
      await storageEngine.set(this.getScopedProfileKey(userId), updatedLocal);
      return { profile: updatedLocal, error: null };
    }
  }

  /**
   * Verifies that a profile exists for the user; creates one if missing
   */
  public async ensureProfileExists(user: {
    id: string;
    email?: string;
    user_metadata?: { display_name?: string; timezone?: string; avatar_url?: string };
  }): Promise<ProfileEntity> {
    const { profile } = await this.getProfile(user.id);
    if (profile) {
      return profile;
    }

    const displayName =
      user.user_metadata?.display_name ||
      user.email?.split('@')[0] ||
      'PauseFlow User';

    const timezone =
      user.user_metadata?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC';

    const avatarUrl = user.user_metadata?.avatar_url || null;

    const createRes = await this.createProfile(user.id, {
      display_name: displayName,
      timezone,
      avatar_url: avatarUrl,
    });

    if (createRes.profile) {
      return createRes.profile;
    }

    // Fallback in-memory profile
    const fallback: ProfileEntity = {
      id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
      timezone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await storageEngine.set(this.getScopedProfileKey(user.id), fallback);
    return fallback;
  }

  /**
   * Validates and uploads an avatar image file to Supabase Storage
   */
  public async uploadAvatar(
    userId: string,
    file: File | Blob
  ): Promise<{ avatarUrl: string | null; error: string | null }> {
    const { profileAvatarService } = await import('./profileAvatarService.ts');
    const result = await profileAvatarService.uploadAvatar(userId, file);
    return {
      avatarUrl: result.avatarUrl,
      error: result.error || null,
    };
  }

  /**
   * Remove custom avatar from user profile and storage
   */
  public async removeAvatar(userId: string): Promise<{ success: boolean; error: string | null }> {
    const { profileAvatarService } = await import('./profileAvatarService.ts');
    const result = await profileAvatarService.deleteAvatar(userId);
    return {
      success: result.success,
      error: result.error || null,
    };
  }
}

export const profileService = new ProfileService();
