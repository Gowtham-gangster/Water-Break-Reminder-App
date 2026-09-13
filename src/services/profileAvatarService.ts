// src/services/profileAvatarService.ts
// PauseFlow V2 — Official Supabase Storage Avatar & Profile Photo Synchronization Engine

import { supabase } from './supabaseClient.ts';
import { profileService } from './profileService.ts';

export const AVATAR_BUCKET = 'avatars';
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit
export const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface AvatarValidationResult {
  valid: boolean;
  error?: string;
}

export interface AvatarUploadResult {
  success: boolean;
  avatarUrl: string | null;
  error?: string;
}

export class ProfileAvatarService {
  /**
   * Validate image file type and size
   */
  public validateImage(file: File | Blob): AvatarValidationResult {
    if (!file) {
      return { valid: false, error: 'No image file provided.' };
    }

    // Check mime type
    const type = file.type.toLowerCase();
    if (type && !ALLOWED_AVATAR_TYPES.includes(type)) {
      return {
        valid: false,
        error: 'Invalid file format. Please upload a JPEG, PNG, or WebP image.',
      };
    }

    // Check size limit
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      return {
        valid: false,
        error: 'Image exceeds the maximum allowed size of 5MB. Please choose a smaller photo.',
      };
    }

    return { valid: true };
  }

  /**
   * Client-side high performance canvas compression & aspect-ratio crop (512x512)
   */
  public async compressAndResizeImage(
    file: File | Blob,
    maxDimension: number = 512,
    quality: number = 0.85
  ): Promise<Blob> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return file;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Square center-crop and scale
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const targetSize = Math.min(minDim, maxDimension);
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          // Draw square cropped image
          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            targetSize,
            targetSize
          );

          // Export as WebP or JPEG
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/webp',
            quality
          );
        } catch (err) {
          console.warn('[ProfileAvatarService] Compression failed, using original file:', err);
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not decode image file for processing.'));
      };

      img.src = url;
    });
  }

  /**
   * Resolve stored avatar reference into a full loadable URL
   */
  public resolveAvatarUrl(avatarRef: string | null | undefined): string | null {
    if (!avatarRef) return null;

    // 1. Data URLs (legacy base64 fallback)
    if (avatarRef.startsWith('data:image/')) {
      return avatarRef;
    }

    // 2. Full HTTP(S) URLs
    if (avatarRef.startsWith('http://') || avatarRef.startsWith('https://')) {
      return avatarRef;
    }

    // 3. Storage Object Relative Path (e.g. "userId/avatar_12345.webp" or "avatars/userId/...")
    let cleanPath = avatarRef;
    if (cleanPath.startsWith('avatars/')) {
      cleanPath = cleanPath.replace(/^avatars\//, '');
    }

    try {
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(cleanPath);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  }

  /**
   * Uploads an avatar to Supabase Storage and updates the profiles table atomically
   */
  public async uploadAvatar(userId: string, file: File | Blob): Promise<AvatarUploadResult> {
    if (!userId) {
      return { success: false, avatarUrl: null, error: 'User ID is required for avatar upload.' };
    }

    // 1. Validate
    const validation = this.validateImage(file);
    if (!validation.valid) {
      return { success: false, avatarUrl: null, error: validation.error };
    }

    // 2. Compress and resize image
    let processedBlob: Blob;
    try {
      processedBlob = await this.compressAndResizeImage(file, 512, 0.85);
    } catch (err: any) {
      return { success: false, avatarUrl: null, error: err?.message || 'Failed to process image.' };
    }

    // 3. Fetch current profile to get old avatar path for cleanup
    let oldAvatarUrl: string | null = null;
    try {
      const { profile } = await profileService.getProfile(userId);
      oldAvatarUrl = profile?.avatar_url || null;
    } catch (_) {}

    // 4. Generate unique versioned filename (prevents cache collisions)
    const timestamp = Date.now();
    const filePath = `${userId}/avatar_${timestamp}.webp`;

    try {
      // 5. Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, processedBlob, {
          contentType: 'image/webp',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('[ProfileAvatarService] Storage upload error:', uploadError);
        return {
          success: false,
          avatarUrl: null,
          error: `Storage upload failed: ${uploadError.message}`,
        };
      }

      // 6. Get Public URL
      const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(uploadData.path);
      const newAvatarUrl = publicUrlData?.publicUrl || null;

      if (!newAvatarUrl) {
        return {
          success: false,
          avatarUrl: null,
          error: 'Failed to retrieve storage public URL for uploaded avatar.',
        };
      }

      // 7. Update profiles table in Supabase
      const { profile: updatedProfile, error: dbError } = await profileService.updateProfile(userId, {
        avatar_url: newAvatarUrl,
      });

      if (dbError || !updatedProfile) {
        // Rollback uploaded file if DB update fails
        await supabase.storage.from(AVATAR_BUCKET).remove([filePath]).catch(() => {});
        return {
          success: false,
          avatarUrl: null,
          error: `Database update failed: ${dbError || 'Unknown error'}`,
        };
      }

      // 8. Safely remove previous storage object if it exists and belongs to this user
      if (oldAvatarUrl && !oldAvatarUrl.startsWith('data:image/')) {
        this.cleanupOldAvatar(userId, oldAvatarUrl).catch(() => {});
      }

      console.log('[ProfileAvatarService] Avatar uploaded and profile updated successfully:', newAvatarUrl);
      return { success: true, avatarUrl: newAvatarUrl };
    } catch (err: any) {
      console.error('[ProfileAvatarService] Avatar upload exception:', err);
      return { success: false, avatarUrl: null, error: err?.message || 'Unexpected upload error.' };
    }
  }

  /**
   * Delete user avatar and update profile
   */
  public async deleteAvatar(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!userId) return { success: false, error: 'User ID is required.' };

    try {
      const { profile } = await profileService.getProfile(userId);
      const oldAvatarUrl = profile?.avatar_url;

      // Update profile in DB first
      const { error: dbError } = await profileService.updateProfile(userId, { avatar_url: null });
      if (dbError) {
        return { success: false, error: dbError };
      }

      // Cleanup storage object
      if (oldAvatarUrl && !oldAvatarUrl.startsWith('data:image/')) {
        await this.cleanupOldAvatar(userId, oldAvatarUrl);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to remove avatar.' };
    }
  }

  /**
   * Migration utility: converts legacy data:image/base64 avatars to persistent Supabase Storage
   */
  public async migrateLegacyBase64Avatar(userId: string, base64DataUrl: string): Promise<string | null> {
    if (!userId || !base64DataUrl || !base64DataUrl.startsWith('data:image/')) {
      return null;
    }

    try {
      console.log(`[ProfileAvatarService] Migrating legacy base64 avatar for user ${userId}...`);
      // Convert base64 data URL to Blob
      const res = await fetch(base64DataUrl);
      const blob = await res.blob();

      const uploadRes = await this.uploadAvatar(userId, blob);
      if (uploadRes.success && uploadRes.avatarUrl) {
        console.log(`[ProfileAvatarService] Legacy base64 avatar migrated successfully to: ${uploadRes.avatarUrl}`);
        return uploadRes.avatarUrl;
      }
    } catch (err) {
      console.warn('[ProfileAvatarService] Legacy base64 avatar migration error:', err);
    }
    return null;
  }

  /**
   * Safe helper to remove old avatar files from user storage folder
   */
  private async cleanupOldAvatar(userId: string, oldUrl: string): Promise<void> {
    try {
      const urlObj = new URL(oldUrl);
      const pathParts = urlObj.pathname.split(`/${AVATAR_BUCKET}/`);
      if (pathParts.length > 1) {
        const objectPath = decodeURIComponent(pathParts[1]);
        if (objectPath.startsWith(`${userId}/`)) {
          await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
          console.log(`[ProfileAvatarService] Removed old avatar object: ${objectPath}`);
        }
      }
    } catch (_) {
      // Ignore URL parsing or deletion errors for external or non-standard URLs
    }
  }
}

export const profileAvatarService = new ProfileAvatarService();
