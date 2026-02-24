import '@testing-library/jest-native/extend-expect';

// ---------------------------------------------------------------------------
// React Native core mocks
// ---------------------------------------------------------------------------

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// ---------------------------------------------------------------------------
// AsyncStorage
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

jest.mock('@react-native-firebase/app', () => ({
  apps: [],
  initializeApp: jest.fn(),
}));

jest.mock('@react-native-firebase/auth', () => {
  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
  };
  return () => ({
    signInWithEmailAndPassword: jest.fn().mockResolvedValue({user: mockUser}),
    createUserWithEmailAndPassword: jest.fn().mockResolvedValue({user: mockUser}),
    signOut: jest.fn().mockResolvedValue(undefined),
    onAuthStateChanged: jest.fn(callback => {
      callback(null);
      return jest.fn();
    }),
    currentUser: null,
  });
});

jest.mock('@react-native-firebase/firestore', () => {
  const mockDoc = {exists: false, data: jest.fn(() => ({})), id: 'mock-doc-id'};
  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn().mockResolvedValue(mockDoc),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    })),
    add: jest.fn().mockResolvedValue({id: 'new-doc-id'}),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({docs: [], empty: true}),
  }));
  return () => ({
    collection: mockCollection,
    doc: jest.fn(),
    batch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    })),
  });
});

jest.mock('@react-native-firebase/analytics', () => () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
  setUserId: jest.fn().mockResolvedValue(undefined),
  setUserProperties: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-firebase/crashlytics', () => () => ({
  recordError: jest.fn(),
  log: jest.fn(),
  setUserId: jest.fn(),
}));

// ---------------------------------------------------------------------------
// SQLite / WatermelonDB
// ---------------------------------------------------------------------------

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
    executeSql: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

jest.mock('react-native-vision-camera', () => ({
  Camera: {
    getCameraPermissionStatus: jest.fn().mockResolvedValue('granted'),
    requestCameraPermission: jest.fn().mockResolvedValue('granted'),
  },
  useCameraDevice: jest.fn(() => ({id: 'back', position: 'back'})),
  useCameraDevices: jest.fn(() => ({back: {id: 'back'}})),
  useCodeScanner: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

jest.mock('@notifee/react-native', () => ({
  createChannel: jest.fn().mockResolvedValue('channel-id'),
  displayNotification: jest.fn().mockResolvedValue(undefined),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
  createTriggerNotification: jest.fn().mockResolvedValue('trigger-id'),
  getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
  requestPermission: jest.fn().mockResolvedValue({authorizationStatus: 1}),
  onForegroundEvent: jest.fn(() => jest.fn()),
  onBackgroundEvent: jest.fn(),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  AndroidImportance: {HIGH: 4, DEFAULT: 3, LOW: 2},
  TriggerType: {TIMESTAMP: 0},
  EventType: {PRESS: 1, DISMISSED: 2},
}));

// ---------------------------------------------------------------------------
// Background Fetch
// ---------------------------------------------------------------------------

jest.mock('react-native-background-fetch', () => ({
  configure: jest.fn(),
  scheduleTask: jest.fn(),
  finish: jest.fn(),
  STATUS_AVAILABLE: 2,
}));

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}));

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({params: {}}),
  useIsFocused: () => true,
  useFocusEffect: jest.fn(),
}));

// ---------------------------------------------------------------------------
// React Native Paper
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}) => children,
  SafeAreaView: ({children}) => children,
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

global.__reanimatedWorkletInit = jest.fn();
