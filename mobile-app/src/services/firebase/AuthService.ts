import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standardised auth error returned by all AuthService methods. */
export interface AuthError {
  code: string;
  message: string;
}

/** Map Firebase error codes to user-friendly messages. */
const ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
  'auth/invalid-credential': 'Invalid credentials. Please try again.',
};

function toAuthError(error: unknown): AuthError {
  const firebaseError = error as {code?: string; message?: string};
  const code = firebaseError.code ?? 'auth/unknown';
  return {
    code,
    message: ERROR_MESSAGES[code] ?? firebaseError.message ?? 'An unexpected error occurred.',
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class AuthService {
  // -------------------------------------------------------------------------
  // Google Sign-In
  // -------------------------------------------------------------------------

  /**
   * Configure Google Sign-In. Call once on app start.
   * The webClientId comes from your Firebase project's OAuth 2.0 client ID
   * (found in google-services.json → client → oauth_client → client_id
   * where client_type === 3).
   */
  configureGoogleSignIn(webClientId: string): void {
    GoogleSignin.configure({webClientId});
  }

  /**
   * Sign in with Google.
   * Triggers the native Google Sign-In flow, then authenticates with Firebase.
   */
  async signInWithGoogle(): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      // Ensure Google Play Services are available (Android)
      await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

      // Trigger Google Sign-In UI
      const response = await GoogleSignin.signIn();

      if (!response.data?.idToken) {
        throw {code: 'auth/invalid-credential', message: 'No ID token returned from Google.'};
      }

      // Create Firebase credential and sign in
      const credential = auth.GoogleAuthProvider.credential(response.data.idToken);
      return await auth().signInWithCredential(credential);
    } catch (error: unknown) {
      throw toAuthError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Email / Password
  // -------------------------------------------------------------------------

  /** Sign in with email and password. */
  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      return await auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw toAuthError(error);
    }
  }

  /** Create a new account with email and password. */
  async signUp(
    email: string,
    password: string,
  ): Promise<FirebaseAuthTypes.UserCredential> {
    try {
      return await auth().createUserWithEmailAndPassword(email, password);
    } catch (error) {
      throw toAuthError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Session management
  // -------------------------------------------------------------------------

  /** Sign out the current user (Firebase + Google). */
  async signOut(): Promise<void> {
    try {
      // Sign out of Google if the user signed in via Google
      const isGoogleSignedIn = await GoogleSignin.getCurrentUser();
      if (isGoogleSignedIn) {
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
      }
    } catch {
      // Google sign-out may fail if user didn't use Google — ignore
    }

    await auth().signOut();
  }

  /** Get the currently signed-in user (or null). */
  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  /** Subscribe to auth-state changes. Returns an unsubscribe function. */
  onAuthStateChanged(
    callback: (user: FirebaseAuthTypes.User | null) => void,
  ): () => void {
    return auth().onAuthStateChanged(callback);
  }

  // -------------------------------------------------------------------------
  // Token & profile
  // -------------------------------------------------------------------------

  /** Get a fresh ID token for API calls. */
  async getIdToken(): Promise<string | null> {
    const user = auth().currentUser;
    return user ? user.getIdToken() : null;
  }

  /** Update the display name of the current user. */
  async updateDisplayName(displayName: string): Promise<void> {
    const user = auth().currentUser;
    if (user) {
      await user.updateProfile({displayName});
    }
  }

  /** Send a password-reset email. */
  async resetPassword(email: string): Promise<void> {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      throw toAuthError(error);
    }
  }

  // -------------------------------------------------------------------------
  // Account deletion (GDPR)
  // -------------------------------------------------------------------------

  /**
   * Delete the current user's Firebase Auth account.
   * The caller should delete Firestore data first via FirestoreService.deleteUserData().
   * May require recent authentication — catch 'auth/requires-recent-login'.
   */
  async deleteAccount(): Promise<void> {
    const user = auth().currentUser;
    if (!user) {
      throw {code: 'auth/no-current-user', message: 'No user is currently signed in.'} as AuthError;
    }

    try {
      // Revoke Google access if applicable
      try {
        const isGoogleSignedIn = await GoogleSignin.getCurrentUser();
        if (isGoogleSignedIn) {
          await GoogleSignin.revokeAccess();
        }
      } catch {
        // Ignore — user may not have used Google
      }

      await user.delete();
    } catch (error) {
      throw toAuthError(error);
    }
  }
}

export default new AuthService();
