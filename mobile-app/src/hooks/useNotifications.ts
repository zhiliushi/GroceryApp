import {useEffect, useRef, useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import notifee, {EventType} from '@notifee/react-native';
import NotificationService from '../services/notifications/NotificationService';
import type {NotificationPreferences} from '../services/notifications/NotificationService';
import {useSettingsStore} from '../store/settingsStore';
import {useDatabase} from './useDatabase';

/**
 * Hook that initializes the notification system, listens for notification
 * taps, and provides helpers for scheduling/cancelling notifications.
 *
 * Mount this once in a top-level component (e.g. HomeScreen or App).
 */
export function useNotifications() {
  const navigation = useNavigation<any>();
  const {inventory} = useDatabase();
  const notificationPrefs = useSettingsStore(s => s.notificationPrefs);
  const setNotificationPrefs = useSettingsStore(s => s.setNotificationPrefs);
  const initializedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Initialize service + request permissions on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      await NotificationService.initialize();
      await NotificationService.requestPermission();

      // Sync stored prefs into the service
      await NotificationService.savePreferences(notificationPrefs);

      // Check for already-expired items on launch
      try {
        const expiredItems = await inventory.getExpiredItems();
        if (expiredItems.length > 0) {
          await NotificationService.checkExpiredItems(
            expiredItems.map(item => ({
              id: item.id,
              name: item.name,
              expiryDate: item.expiryDate,
              status: item.status,
            })),
          );
        }
      } catch {
        // Non-critical — don't crash if DB isn't ready
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Foreground notification event listener
  // -------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(event => {
      if (event.type === EventType.PRESS || event.type === EventType.ACTION_PRESS) {
        const result = NotificationService.handleNotificationEvent(event);
        if (!result) return;

        if (result.action === 'navigate_item' && result.itemId) {
          navigation.navigate('InventoryTab', {
            screen: 'InventoryDetail',
            params: {itemId: result.itemId},
          });
        } else if (result.action === 'navigate_list' && result.listId) {
          navigation.navigate('ShoppingTab', {
            screen: 'ListDetail',
            params: {listId: result.listId},
          });
        }
      }
    });

    return unsubscribe;
  }, [navigation]);

  // -------------------------------------------------------------------------
  // Keep service preferences in sync with store
  // -------------------------------------------------------------------------
  useEffect(() => {
    NotificationService.savePreferences(notificationPrefs);
  }, [notificationPrefs]);

  // -------------------------------------------------------------------------
  // Public helpers
  // -------------------------------------------------------------------------

  /** Schedule expiry notifications for an item. */
  const scheduleExpiryNotifications = useCallback(
    async (itemId: string, itemName: string, expiryDate: Date | null) => {
      await NotificationService.scheduleExpiryNotifications(itemId, itemName, expiryDate);
    },
    [],
  );

  /** Cancel all notifications for an item (on consume/delete). */
  const cancelItemNotifications = useCallback(async (itemId: string) => {
    await NotificationService.cancelItemNotifications(itemId);
  }, []);

  /** Schedule a shopping list reminder. */
  const scheduleShoppingReminder = useCallback(
    async (listId: string, listName: string, date: Date) => {
      await NotificationService.scheduleShoppingReminder(listId, listName, date);
    },
    [],
  );

  /** Cancel a shopping reminder. */
  const cancelShoppingReminder = useCallback(async (listId: string) => {
    await NotificationService.cancelShoppingReminder(listId);
  }, []);

  /** Show low stock notification. */
  const showLowStockNotification = useCallback(
    async (itemId: string, itemName: string) => {
      await NotificationService.showLowStockNotification(itemId, itemName);
    },
    [],
  );

  /** Update notification preferences. */
  const updatePreferences = useCallback(
    async (prefs: Partial<NotificationPreferences>) => {
      setNotificationPrefs(prefs);
      await NotificationService.savePreferences(prefs);

      // Reschedule all if quiet hours or enabled state changed
      if (
        prefs.quietHoursEnabled !== undefined ||
        prefs.quietHoursStart !== undefined ||
        prefs.quietHoursEnd !== undefined ||
        prefs.enabled !== undefined ||
        prefs.expiringSoon !== undefined ||
        prefs.expiringToday !== undefined
      ) {
        try {
          const activeItems = await inventory.getActive();
          await NotificationService.rescheduleAll(
            activeItems.map(item => ({
              id: item.id,
              name: item.name,
              expiryDate: item.expiryDate,
            })),
          );
        } catch {
          // Non-critical
        }
      }
    },
    [inventory, setNotificationPrefs],
  );

  return {
    scheduleExpiryNotifications,
    cancelItemNotifications,
    scheduleShoppingReminder,
    cancelShoppingReminder,
    showLowStockNotification,
    updatePreferences,
    preferences: notificationPrefs,
  };
}
