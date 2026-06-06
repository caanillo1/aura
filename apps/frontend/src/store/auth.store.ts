import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@/types/auth.types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('aura_access_token', accessToken);
          localStorage.setItem('aura_refresh_token', refreshToken);
          // Cookie para el middleware Next.js (SSR route protection)
          document.cookie = `aura_access_token=${accessToken};path=/;max-age=${60 * 60 * 24 * 7}`;
        }
        set({ user, accessToken, isAuthenticated: true });
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aura_access_token');
          localStorage.removeItem('aura_refresh_token');
          document.cookie = 'aura_access_token=;path=/;max-age=0';
        }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: 'aura-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
