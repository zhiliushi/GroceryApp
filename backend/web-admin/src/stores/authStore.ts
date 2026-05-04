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
import { useActiveHouseholdStore } from './activeHouseholdStore';

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

// ── Pending-invitation handoff (Onboarding v2 / Phase 4) ─────────────────
// When an unauthenticated user lands on /join/CODE, the JoinPage stores the
// code here so that after Firebase sign-in completes, fetchUserInfo can pass
// it to /api/me?invitation_code=CODE. Backend uses it to auto-approve (skip
// admin queue) and link the user's profile to the invitation for later
// auto-accept on registration completion.
const PENDING_INVITE_KEY = 'groceryapp.pending_invite_code';

export function setPendingInvite(code: string): void {
  try {
    window.localStorage.setItem(PENDING_INVITE_KEY, code.toUpperCase());
  } catch {
    /* localStorage disabled — invitation will fall back to self-signup pending */
  }
}

function readPendingInvite(): string | null {
  try {
    return window.localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

function clearPendingInvite(): void {
  try {
    window.localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    /* non-fatal */
  }
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
    // MH-3a: clear cross-store active-household state so a different user
    // signing in on the same browser doesn't inherit the previous user's
    // membership list. Per-user localStorage keys still survive — each user
    // sees their own choice on the next sign-in.
    useActiveHouseholdStore.getState().reset();
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
      // Onboarding v2: pass any pending invitation code to /api/me so the
      // backend can auto-approve invited users (skip admin queue).
      const pendingCode = readPendingInvite();
      const url = pendingCode
        ? `/api/me?invitation_code=${encodeURIComponent(pendingCode)}`
        : '/api/me';
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.authenticated) {
        // Clear pending invite once it's been bound (or fell through to self-signup).
        // Done unconditionally: re-trying with the same stale code on every page load
        // would burn the auto-approve match against a different account by mistake.
        if (pendingCode) clearPendingInvite();
        set({
          user: data as AuthUser,
          isAuthenticated: true,
          isAdmin: data.role === 'admin',
          loading: false,
          initialized: true,
        });
      } else {
        // Anonymous response — but it still carries maintenance_mode / web_public_url.
        // Stash those in user so the maintenance banner can render on /login.
        set({
          user: data as AuthUser,
          loading: false,
          initialized: true,
        });
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
