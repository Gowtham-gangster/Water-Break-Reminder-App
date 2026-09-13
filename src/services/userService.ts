import { apiClient } from './apiClient';
import type { UserProfile } from './authService';

class UserService {
  public async getProfile() {
    return apiClient.get<{ user: UserProfile }>('/auth/me');
  }

  public async updateProfile(updates: Partial<Pick<UserProfile, 'display_name' | 'avatar_url' | 'timezone'>>) {
    return apiClient.patch<{ user: UserProfile }>('/auth/me', updates);
  }
}

export const userService = new UserService();
