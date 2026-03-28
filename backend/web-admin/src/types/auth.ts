export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

export interface AuthState {
  user: import('./api').AuthUser | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}
