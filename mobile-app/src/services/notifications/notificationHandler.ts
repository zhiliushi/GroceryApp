import notifee, {EventType} from '@notifee/react-native';
import NotificationService from './NotificationService';

/**
 * Register the background notification event handler.
 * Must be called at the top level (outside any component), e.g. in index.js.
 *
 * Handles notification taps when the app is in the background or killed.
 * Foreground events are handled by the useNotifications hook.
 */
export function registerNotificationHandler(): void {
  notifee.onBackgroundEvent(async event => {
    if (
      event.type === EventType.PRESS ||
      event.type === EventType.ACTION_PRESS
    ) {
      // The navigation will be handled when the app opens and
      // useNotifications reads the initial notification. For background
      // events we just need to ensure the notification is dismissed.
      const notificationId = event.detail.notification?.id;
      if (notificationId) {
        await notifee.cancelNotification(notificationId);
      }
    }
  });
}

/**
 * Check if the app was launched via a notification tap and return
 * navigation data. Call this once during app startup.
 */
export async function getInitialNotification(): Promise<{
  action: 'navigate_item' | 'navigate_list' | 'none';
  itemId?: string;
  listId?: string;
} | null> {
  const initial = await notifee.getInitialNotification();
  if (!initial) return null;

  // Ensure the service is initialized before handling
  await NotificationService.initialize();

  return NotificationService.handleNotificationEvent({
    type: EventType.PRESS,
    detail: initial,
  });
}
