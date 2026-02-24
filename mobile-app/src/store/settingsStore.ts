import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {NotificationPreferences} from '../services/notifications/NotificationService';
import {DEFAULT_NOTIFICATION_PREFS} from '../services/notifications/NotificationService';

type ThemeMode = 'light' | 'dark' | 'system';

const DEFAULT_QUICK_ACTIONS = ['add_inventory', 'add_shopping_list', 'restock_settings', 'past_items'];
const DEFAULT_STORAGE_LOCATIONS = ['fridge', 'pantry', 'freezer'];

interface SettingsState {
  theme: ThemeMode;
  currency: string;
  notificationsEnabled: boolean;
  expiryAlertDays: number;
  notificationPrefs: NotificationPreferences;
  quickActions: string[];
  storageLocations: string[];
  defaultStorageLocation: string;
  shoppingItemExpiryDays: number;
  autoLocationEnabled: boolean;

  setTheme: (theme: ThemeMode) => void;
  setCurrency: (currency: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setExpiryAlertDays: (days: number) => void;
  setNotificationPrefs: (prefs: Partial<NotificationPreferences>) => void;
  setQuickActions: (actions: string[]) => void;
  addStorageLocation: (location: string) => void;
  removeStorageLocation: (location: string) => void;
  setDefaultStorageLocation: (location: string) => void;
  setShoppingItemExpiryDays: (days: number) => void;
  setAutoLocationEnabled: (enabled: boolean) => void;
  loadFromStorage: () => Promise<void>;
}

const SETTINGS_KEY = '@groceryapp_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  currency: 'USD',
  notificationsEnabled: true,
  expiryAlertDays: 3,
  notificationPrefs: {...DEFAULT_NOTIFICATION_PREFS},
  quickActions: [...DEFAULT_QUICK_ACTIONS],
  storageLocations: [...DEFAULT_STORAGE_LOCATIONS],
  defaultStorageLocation: 'fridge',
  shoppingItemExpiryDays: 7,
  autoLocationEnabled: true,

  setTheme: (theme) => {
    set({theme});
    persistSettings(get());
  },
  setCurrency: (currency) => {
    set({currency});
    persistSettings(get());
  },
  setNotificationsEnabled: (notificationsEnabled) => {
    set({notificationsEnabled});
    persistSettings(get());
  },
  setExpiryAlertDays: (expiryAlertDays) => {
    set({expiryAlertDays});
    persistSettings(get());
  },
  setNotificationPrefs: (prefs) => {
    const current = get().notificationPrefs;
    const updated = {...current, ...prefs};
    set({notificationPrefs: updated});
    persistSettings(get());
  },
  setQuickActions: (quickActions) => {
    set({quickActions});
    persistSettings(get());
  },
  addStorageLocation: (location) => {
    const normalized = location.toLowerCase().trim();
    if (!normalized) return;
    const current = get().storageLocations;
    if (current.includes(normalized)) return;
    set({storageLocations: [...current, normalized]});
    persistSettings(get());
  },
  removeStorageLocation: (location) => {
    const current = get().storageLocations;
    if (current.length <= 1) return;
    const updated = current.filter(l => l !== location);
    set({storageLocations: updated});
    if (get().defaultStorageLocation === location) {
      set({defaultStorageLocation: updated[0]});
    }
    persistSettings(get());
  },
  setDefaultStorageLocation: (defaultStorageLocation) => {
    set({defaultStorageLocation});
    persistSettings(get());
  },
  setShoppingItemExpiryDays: (shoppingItemExpiryDays) => {
    set({shoppingItemExpiryDays});
    persistSettings(get());
  },
  setAutoLocationEnabled: (autoLocationEnabled) => {
    set({autoLocationEnabled});
    persistSettings(get());
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({
          theme: saved.theme ?? 'system',
          currency: saved.currency ?? 'USD',
          notificationsEnabled: saved.notificationsEnabled ?? true,
          expiryAlertDays: saved.expiryAlertDays ?? 3,
          notificationPrefs: saved.notificationPrefs
            ? {...DEFAULT_NOTIFICATION_PREFS, ...saved.notificationPrefs}
            : {...DEFAULT_NOTIFICATION_PREFS},
          quickActions: Array.isArray(saved.quickActions)
            ? saved.quickActions
            : [...DEFAULT_QUICK_ACTIONS],
          storageLocations: Array.isArray(saved.storageLocations) && saved.storageLocations.length > 0
            ? saved.storageLocations
            : [...DEFAULT_STORAGE_LOCATIONS],
          defaultStorageLocation: saved.defaultStorageLocation ?? 'fridge',
          shoppingItemExpiryDays: saved.shoppingItemExpiryDays ?? 7,
          autoLocationEnabled: saved.autoLocationEnabled ?? true,
        });
      }
    } catch {
      // Keep defaults on read failure
    }
  },
}));

function persistSettings(state: SettingsState): void {
  const data = {
    theme: state.theme,
    currency: state.currency,
    notificationsEnabled: state.notificationsEnabled,
    expiryAlertDays: state.expiryAlertDays,
    notificationPrefs: state.notificationPrefs,
    quickActions: state.quickActions,
    storageLocations: state.storageLocations,
    defaultStorageLocation: state.defaultStorageLocation,
    shoppingItemExpiryDays: state.shoppingItemExpiryDays,
    autoLocationEnabled: state.autoLocationEnabled,
  };
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(data)).catch(() => {});
}
