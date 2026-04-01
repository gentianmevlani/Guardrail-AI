/**
 * Authentication API
 */
import { API_BASE, logger } from './core';

export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!res.ok && res.status !== 200) {
      return { success: false, error: "Logout failed" };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Logout error:', error);
    return { success: false, error: "Logout request failed" };
  }
}

export async function getCurrentUser(): Promise<{
  user: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
    tier?: string;
    stripeCustomerId?: string;
  } | null;
}> {
  try {
    const res = await fetch(`/api/auth/user`, {
      credentials: "include",
    });
    
    if (!res.ok) {
      return { user: null };
    }
    
    return await res.json();
  } catch (error) {
    return { user: null };
  }
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: "admin" | "member" | "viewer";
  createdAt: string;
  preferences?: {
    emailNotifications: boolean;
    slackNotifications: boolean;
    theme: "light" | "dark" | "system";
  };
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug('API unavailable for user profile');
    return null;
  }
}

export async function updateUserProfile(
  updates: Partial<UserProfile>,
): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (error) {
    logger.debug('API unavailable for profile update');
    return null;
  }
}
