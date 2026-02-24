# Mobile App Subsystem - GroceryApp

## Overview

The GroceryApp mobile application is built with React Native and TypeScript, providing a cross-platform solution for iOS and Android. The app follows an offline-first architecture with optional cloud sync for premium users.

## Architecture

### Design Pattern: Clean Architecture + MVVM

```
Presentation Layer (UI)
    ↓
ViewModel Layer (State Management)
    ↓
Domain Layer (Business Logic)
    ↓
Data Layer (Repositories)
    ↓
Data Sources (SQLite, Firebase, API)
```

## Project Structure

```
mobile-app/
├── src/
│   ├── config/                    # App configuration
│   │   ├── firebase.ts           # Firebase initialization & exports
│   │   ├── api.ts                # Axios client with Firebase token interceptor
│   │   └── constants.ts          # App constants, feature flags, categories
│   │
│   ├── database/                  # WatermelonDB data layer
│   │   ├── schema.ts            # Schema (4 tables)
│   │   ├── models/              # WatermelonDB Model classes
│   │   │   ├── GroceryItem.ts
│   │   │   ├── ShoppingList.ts
│   │   │   ├── ListItem.ts
│   │   │   └── AnalyticsEvent.ts
│   │   ├── repositories/        # Data access repositories
│   │   │   ├── GroceryRepository.ts
│   │   │   ├── ShoppingListRepository.ts
│   │   │   └── AnalyticsRepository.ts
│   │   └── migrations/
│   │       └── migration_v1.ts
│   │
│   ├── services/                  # Business logic & external APIs
│   │   ├── barcode/
│   │   │   ├── BarcodeService.ts       # Camera permissions & scanner config
│   │   │   └── BarcodeApiService.ts    # Backend barcode API calls
│   │   ├── firebase/
│   │   │   ├── AuthService.ts          # Firebase Auth wrapper
│   │   │   ├── FirestoreService.ts     # Firestore sync operations
│   │   │   └── AnalyticsService.ts     # Firebase Analytics wrapper
│   │   ├── sync/
│   │   │   └── SyncService.ts          # Background & foreground sync
│   │   └── openFoodFacts/
│   │       └── OpenFoodFactsService.ts # Fallback product lookup
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.ts            # Auth state subscription
│   │   ├── useDatabase.ts        # DB singleton & repository access
│   │   ├── useBarcode.ts         # Scan → lookup flow
│   │   └── useSync.ts            # Periodic sync & network monitoring
│   │
│   ├── screens/                   # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── home/
│   │   │   └── HomeScreen.tsx
│   │   ├── inventory/
│   │   │   ├── InventoryScreen.tsx
│   │   │   └── InventoryDetailScreen.tsx
│   │   ├── scanner/
│   │   │   └── BarcodeScannerScreen.tsx
│   │   ├── lists/
│   │   │   ├── ShoppingListsScreen.tsx
│   │   │   └── ListDetailScreen.tsx
│   │   └── settings/
│   │       └── SettingsScreen.tsx
│   │
│   ├── components/                # Reusable UI components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Loading.tsx
│   │   ├── grocery/
│   │   │   ├── GroceryItemCard.tsx
│   │   │   └── CategoryFilter.tsx
│   │   └── scanner/
│   │       └── BarcodeOverlay.tsx
│   │
│   ├── navigation/                # React Navigation setup
│   │   ├── RootNavigator.tsx     # Auth gate (Auth vs Main)
│   │   ├── AuthNavigator.tsx     # Login → Register stack
│   │   └── MainNavigator.tsx     # Bottom tabs with nested stacks
│   │
│   ├── store/                     # Zustand state management
│   │   ├── authStore.ts          # User, auth state, tier
│   │   ├── groceryStore.ts       # Items, search, categories
│   │   └── settingsStore.ts      # Theme, currency, notifications (persisted)
│   │
│   ├── types/                     # TypeScript definitions
│   │   ├── index.ts              # Re-exports
│   │   ├── database.ts           # Data layer types
│   │   └── api.ts                # API request/response types
│   │
│   ├── utils/                     # Utility functions
│   │   ├── dateUtils.ts          # Date formatting (date-fns)
│   │   ├── validators.ts         # Zod validation schemas
│   │   └── helpers.ts            # General helpers & feature gating
│   │
│   └── App.tsx                    # Root component
│
├── android/              # Android-specific code
├── ios/                  # iOS-specific code
├── __tests__/            # Test files
└── package.json
```

## Core Modules

### 1. Database Service (SQLite)

**Purpose**: Local data persistence for offline-first functionality

**Key Features**:
- CRUD operations for all entities
- Transaction support
- Database migrations
- Query builder
- Indexing for performance

**Schema**:
```typescript
// Items table
interface Item {
  id: string;              // UUID
  name: string;
  barcode?: string;
  category_id: string;
  quantity: number;
  unit: string;
  price?: number;
  purchase_date?: string;
  expiry_date?: string;
  location?: string;
  notes?: string;
  image_uri?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
  deleted: boolean;        // Soft delete
}

// Categories table
interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
}

// Shopping List table
interface ShoppingList {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Shopping List Items
interface ShoppingListItem {
  id: string;
  list_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  price_estimate?: number;
  notes?: string;
}

// Purchases table
interface Purchase {
  id: string;
  item_id: string;
  quantity: number;
  price: number;
  store?: string;
  purchase_date: string;
  created_at: string;
}

// User Settings
interface UserSettings {
  id: string;
  user_id?: string;
  tier: 'free' | 'paid';
  theme: 'light' | 'dark';
  currency: string;
  language: string;
  notifications_enabled: boolean;
  sync_enabled: boolean;
  last_sync?: string;
}
```

**Implementation**:
```typescript
// services/database/DatabaseService.ts
import SQLite from 'react-native-sqlite-storage';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabase({
      name: 'groceryapp.db',
      location: 'default',
    });
    await this.runMigrations();
  }

  async runMigrations(): Promise<void> {
    // Execute migration scripts
  }

  // CRUD operations
  async createItem(item: Omit<Item, 'id' | 'created_at' | 'updated_at'>): Promise<Item> {
    // Implementation
  }

  async getItems(filters?: ItemFilters): Promise<Item[]> {
    // Implementation
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<void> {
    // Implementation
  }

  async deleteItem(id: string): Promise<void> {
    // Soft delete
  }
}

export default new DatabaseService();
```

### 2. Firebase Integration

**Purpose**: Cloud sync and authentication for premium users

**Components**:

#### Authentication
```typescript
// services/firebase/FirebaseAuth.ts
import auth from '@react-native-firebase/auth';

class FirebaseAuth {
  async signInWithEmail(email: string, password: string) {
    return auth().signInWithEmailAndPassword(email, password);
  }

  async signUpWithEmail(email: string, password: string) {
    return auth().createUserWithEmailAndPassword(email, password);
  }

  async signInWithGoogle() {
    // Google Sign-In implementation
  }

  async signOut() {
    return auth().signOut();
  }

  onAuthStateChanged(callback: (user: User | null) => void) {
    return auth().onAuthStateChanged(callback);
  }
}

export default new FirebaseAuth();
```

#### Firestore Sync
```typescript
// services/firebase/FirestoreSync.ts
import firestore from '@react-native-firebase/firestore';

class FirestoreSync {
  async syncInventory(userId: string, items: Item[]): Promise<void> {
    const batch = firestore().batch();

    items.forEach(item => {
      const ref = firestore()
        .collection('users')
        .doc(userId)
        .collection('items')
        .doc(item.id);

      if (item.deleted) {
        batch.delete(ref);
      } else {
        batch.set(ref, item, { merge: true });
      }
    });

    await batch.commit();
  }

  async fetchInventory(userId: string): Promise<Item[]> {
    const snapshot = await firestore()
      .collection('users')
      .doc(userId)
      .collection('items')
      .get();

    return snapshot.docs.map(doc => doc.data() as Item);
  }

  onInventoryChange(userId: string, callback: (items: Item[]) => void) {
    return firestore()
      .collection('users')
      .doc(userId)
      .collection('items')
      .onSnapshot(snapshot => {
        const items = snapshot.docs.map(doc => doc.data() as Item);
        callback(items);
      });
  }
}

export default new FirestoreSync();
```

### 3. Barcode Scanner

**Purpose**: Scan barcodes and lookup product information

**Implementation**:
```typescript
// services/barcode/BarcodeScanner.ts
import { Camera } from 'react-native-vision-camera';
import { BarcodeFormat, useScanBarcodes } from 'vision-camera-code-scanner';

export const useBarcodeScanner = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [frameProcessor, barcodes] = useScanBarcodes([
    BarcodeFormat.EAN_13,
    BarcodeFormat.UPC_A,
    BarcodeFormat.QR_CODE,
  ]);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const status = await Camera.requestCameraPermission();
    setHasPermission(status === 'authorized');
  };

  const scanBarcode = async (barcode: string): Promise<Product> => {
    // Call backend API to fetch product info
    const response = await BarcodeAPI.scanBarcode(barcode);
    return response.data;
  };

  return { hasPermission, frameProcessor, barcodes, scanBarcode };
};
```

### 4. State Management

**Using Zustand** (lightweight alternative to Redux):

```typescript
// store/inventoryStore.ts
import create from 'zustand';
import DatabaseService from '../services/database/DatabaseService';

interface InventoryState {
  items: Item[];
  loading: boolean;
  error: string | null;

  fetchItems: () => Promise<void>;
  addItem: (item: Omit<Item, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  searchItems: (query: string) => Item[];
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const items = await DatabaseService.getItems();
      set({ items, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addItem: async (item) => {
    const newItem = await DatabaseService.createItem(item);
    set(state => ({ items: [...state.items, newItem] }));
  },

  updateItem: async (id, updates) => {
    await DatabaseService.updateItem(id, updates);
    set(state => ({
      items: state.items.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  },

  deleteItem: async (id) => {
    await DatabaseService.deleteItem(id);
    set(state => ({
      items: state.items.filter(item => item.id !== id)
    }));
  },

  searchItems: (query) => {
    return get().items.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  },
}));
```

### 5. Sync Service

**Purpose**: Manage background sync between SQLite and Firestore

```typescript
// services/sync/SyncService.ts
class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;

  async startPeriodicSync(userId: string): Promise<void> {
    // Sync every 15 minutes
    this.syncInterval = setInterval(() => {
      this.performSync(userId);
    }, 15 * 60 * 1000);
  }

  async performSync(userId: string): Promise<void> {
    try {
      // 1. Get items modified locally since last sync
      const localItems = await DatabaseService.getModifiedItems();

      // 2. Push local changes to Firestore
      await FirestoreSync.syncInventory(userId, localItems);

      // 3. Fetch remote changes
      const remoteItems = await FirestoreSync.fetchInventory(userId);

      // 4. Merge and resolve conflicts
      const mergedItems = this.resolveConflicts(localItems, remoteItems);

      // 5. Update local database
      await DatabaseService.bulkUpdate(mergedItems);

      // 6. Update last sync timestamp
      await DatabaseService.updateLastSync(new Date().toISOString());
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  private resolveConflicts(local: Item[], remote: Item[]): Item[] {
    // Last-write-wins strategy based on updated_at timestamp
    const merged = new Map<string, Item>();

    [...local, ...remote].forEach(item => {
      const existing = merged.get(item.id);
      if (!existing || item.updated_at > existing.updated_at) {
        merged.set(item.id, item);
      }
    });

    return Array.from(merged.values());
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export default new SyncService();
```

## Key Features Implementation

### Feature Gating (Free vs Paid)

```typescript
// utils/featureGating.ts
export const isFeatureAvailable = (feature: string, tier: 'free' | 'paid'): boolean => {
  const paidFeatures = [
    'cloud_sync',
    'ai_shopping_list',
    'advanced_analytics',
    'multi_device',
    'price_tracking',
    'receipt_scanning',
  ];

  if (tier === 'paid') return true;
  return !paidFeatures.includes(feature);
};
```

## Performance Optimizations

1. **FlatList virtualization** for long item lists
2. **React.memo** for expensive component renders
3. **useMemo/useCallback** for computed values and callbacks
4. **Image caching** with react-native-fast-image
5. **Database indexing** on frequently queried columns
6. **Lazy loading** for screens and components
7. **Background sync** during idle time

## Testing Strategy

### Unit Tests
- Database operations
- Business logic
- Utility functions
- Custom hooks

### Integration Tests
- API calls
- Firebase integration
- Sync service
- Navigation flows

### E2E Tests (Detox)
- Login flow
- Add item flow
- Barcode scan flow
- Sync flow

## Dependencies

```json
{
  "dependencies": {
    "react": "19.0.0",
    "react-native": "0.83.1",
    "@react-navigation/native": "^7.1.6",
    "@react-navigation/native-stack": "^7.3.10",
    "@react-navigation/bottom-tabs": "^7.3.10",
    "@nozbe/watermelondb": "^0.27.1",
    "@react-native-firebase/app": "^23.8.4",
    "@react-native-firebase/auth": "^23.8.4",
    "@react-native-firebase/firestore": "^23.8.4",
    "@react-native-firebase/analytics": "^23.8.4",
    "react-native-vision-camera": "^4.6.3",
    "zustand": "^5.0.5",
    "axios": "^1.9.0",
    "react-native-paper": "^5.14.5",
    "react-hook-form": "^7.56.4",
    "zod": "^3.25.36",
    "@hookform/resolvers": "^5.0.1",
    "date-fns": "^4.1.0",
    "@react-native-async-storage/async-storage": "^2.1.2",
    "@react-native-community/netinfo": "^11.4.1",
    "react-native-background-fetch": "^4.2.5",
    "react-native-safe-area-context": "^5.4.0",
    "react-native-screens": "^4.10.0",
    "@tanstack/react-query": "^5.90.0"
  }
}
```
