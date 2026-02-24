/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerNotificationHandler } from './src/services/notifications/notificationHandler';

// Register background notification handler before app mounts
registerNotificationHandler();

AppRegistry.registerComponent(appName, () => App);
