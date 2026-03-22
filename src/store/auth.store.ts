import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppUser } from '../types/user';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: AppUser | null;
  isAuthenticated: boolean;
  login: (user: AppUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => {
        set({ user, isAuthenticated: true });
        // Trigger a fresh sync pull now that we're authenticated
        import('../lib/syncEngine').then(({ syncEngine }) => {
          syncEngine.pullData().catch(err => console.error('[AuthStore] Sync pull failed:', err));
        });
      },
      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'impacto-ia-auth-storage', // name of the item in the storage (must be unique)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
