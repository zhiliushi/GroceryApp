import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import analytics from '@react-native-firebase/analytics';

// ---------------------------------------------------------------------------
// Firebase instances
// ---------------------------------------------------------------------------

// Firebase is auto-configured via google-services.json (Android)
// and GoogleService-Info.plist (iOS). No manual config needed here.

export const firebaseAuth = auth();
export const firebaseFirestore = firestore();
export const firebaseAnalytics = analytics();

// ---------------------------------------------------------------------------
// Firestore settings
// ---------------------------------------------------------------------------

// Enable offline persistence with 100 MB cache
firestore().settings({
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
  persistence: true,
});

// ---------------------------------------------------------------------------
// Collection & subcollection path constants
// ---------------------------------------------------------------------------

/** Top-level and nested Firestore collection names. */
export const COLLECTIONS = {
  /** Top-level: /users */
  USERS: 'users',
  /** Subcollection: /users/{uid}/grocery_items */
  ITEMS: 'grocery_items',
  /** Subcollection: /users/{uid}/shopping_lists */
  SHOPPING_LISTS: 'shopping_lists',
  /** Sub-subcollection: /users/{uid}/shopping_lists/{listId}/items */
  LIST_ITEMS: 'items',
  /** Subcollection: /users/{uid}/analytics */
  ANALYTICS: 'analytics',
  /** Subcollection: /users/{uid}/sync_meta */
  SYNC_META: 'sync_meta',
  /** Top-level: /foodbanks (global, not per-user) */
  FOODBANKS: 'foodbanks',
  /** Subcollection: /users/{uid}/price_records */
  PRICE_RECORDS: 'price_records',
} as const;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Get reference to a user's root document. */
export function userDocRef(userId: string) {
  return firestore().collection(COLLECTIONS.USERS).doc(userId);
}

/** Get reference to a user's grocery_items subcollection. */
export function inventoryColRef(userId: string) {
  return userDocRef(userId).collection(COLLECTIONS.ITEMS);
}

/** Get reference to a user's shopping_lists subcollection. */
export function shoppingListsColRef(userId: string) {
  return userDocRef(userId).collection(COLLECTIONS.SHOPPING_LISTS);
}

/** Get reference to the items subcollection of a specific shopping list. */
export function listItemsColRef(userId: string, listId: string) {
  return shoppingListsColRef(userId).doc(listId).collection(COLLECTIONS.LIST_ITEMS);
}

/** Get reference to a user's analytics subcollection. */
export function analyticsColRef(userId: string) {
  return userDocRef(userId).collection(COLLECTIONS.ANALYTICS);
}

/** Get reference to the global foodbanks collection. */
export function foodbanksColRef() {
  return firestore().collection(COLLECTIONS.FOODBANKS);
}

/** Get reference to a user's price_records subcollection. */
export function priceRecordsColRef(userId: string) {
  return userDocRef(userId).collection(COLLECTIONS.PRICE_RECORDS);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export const isFirebaseInitialized = (): boolean => {
  return firebase.apps.length > 0;
};

export default firebase;
