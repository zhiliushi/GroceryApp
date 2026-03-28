import { create } from 'zustand';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User as FBUser,
} from 'firebase/auth';
import type { AuthUser } from '@/types/api';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function setCookie(token: string) {
  document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
}

function clearCookie() {
  document.cookie = '__session=; path=/; max-age=0';
}

interface AuthStoreState {
  user: AuthUser | null;
  firebaseUser: FBUser | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUserInfo: () => Promise<void>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  initialized: false,
  isAuthenticated: false,
  isAdmin: false,

  signInWithEmail: async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const token = await result.user.getIdToken();
    setCookie(token);
    set({ firebaseUser: result.user });
    await get().fetchUserInfo();
  },

  signInWithGoogle: async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const token = await result.user.getIdToken();
    setCookie(token);
    set({ firebaseUser: result.user });
    await get().fetchUserInfo();
  },

  signOut: async () => {
    await fbSignOut(auth);
    clearCookie();
    set({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isAdmin: false,
    });
  },

  fetchUserInfo: async () => {
    try {
      const cookie = document.cookie.match(/__session=([^;]+)/);
      const token = cookie?.[1] || '';
      const resp = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.authenticated) {
        set({
          user: data as AuthUser,
          isAuthenticated: true,
          isAdmin: data.role === 'admin',
          loading: false,
          initialized: true,
        });
      } else {
        set({ loading: false, initialized: true });
      }
    } catch {
      set({ loading: false, initialized: true });
    }
  },
}));

// Listen for Firebase auth state changes
onAuthStateChanged(auth, async (fbUser) => {
  if (fbUser) {
    const token = await fbUser.getIdToken();
    setCookie(token);
    useAuthStore.setState({ firebaseUser: fbUser });
    await useAuthStore.getState().fetchUserInfo();
  } else {
    useAuthStore.setState({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isAdmin: false,
      loading: false,
      initialized: true,
    });
  }
});

// Token refresh every 50 minutes
setInterval(async () => {
  const fbUser = useAuthStore.getState().firebaseUser;
  if (fbUser) {
    try {
      const token = await fbUser.getIdToken(true);
      setCookie(token);
    } catch (e) {
      console.warn('Token refresh failed:', e);
    }
  }
}, 50 * 60 * 1000);
