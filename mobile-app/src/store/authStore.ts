import {create} from 'zustand';

export type UserTier = 'free' | 'paid';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  tier: UserTier;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tier: UserTier;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setTier: (tier: UserTier) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  tier: 'free',

  setUser: (user: User | null) =>
    set({
      user,
      isAuthenticated: !!user,
      tier: user?.tier ?? 'free',
    }),

  setLoading: (isLoading: boolean) => set({isLoading}),
  setTier: (tier: UserTier) => set({tier}),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      tier: 'free',
    }),
}));
