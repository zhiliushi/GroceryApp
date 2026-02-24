import {useEffect} from 'react';
import AuthService from '../services/firebase/AuthService';
import FirestoreService from '../services/firebase/FirestoreService';
import AnalyticsService from '../services/firebase/AnalyticsService';
import {useAuthStore} from '../store/authStore';

/**
 * Subscribes to Firebase auth state and keeps the Zustand auth store in sync.
 * Call once at the root of the app (e.g. in RootNavigator).
 *
 * On first sign-in (new user), creates a Firestore profile document.
 * Fetches the user's subscription tier from their profile on every auth change.
 */
export function useAuth() {
  const {setUser, setLoading, logout} = useAuthStore();

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        // Fetch or create Firestore profile
        let profile = await FirestoreService.getUserProfile(firebaseUser.uid);
        const tier = (profile?.tier as 'free' | 'paid') ?? 'free';

        // Create profile document for new users
        if (!profile) {
          await FirestoreService.saveUserProfile(firebaseUser.uid, {
            email: firebaseUser.email ?? '',
            displayName: firebaseUser.displayName,
            tier: 'free',
          });
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          tier,
        });

        // Set analytics context
        await AnalyticsService.setUserId(firebaseUser.uid);
        await AnalyticsService.setUserProperties({
          tier,
          sign_in_method: firebaseUser.providerData[0]?.providerId ?? 'unknown',
        });
      } else {
        logout();
        await AnalyticsService.setUserId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [setUser, setLoading, logout]);

  return useAuthStore();
}
