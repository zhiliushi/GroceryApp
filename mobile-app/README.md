# GroceryApp Mobile

React Native mobile application for grocery management with offline-first architecture.

## Features

- 📦 Inventory Management
- 📱 Barcode Scanning
- 🛒 Shopping Lists
- 💰 Expense Tracking
- 📊 Analytics & Insights (Premium)
- ☁️ Cloud Sync (Premium)
- 🔐 Firebase Authentication

## Tech Stack

- **React Native** 0.83+
- **TypeScript** for type safety
- **React Navigation** for routing
- **Zustand** for state management
- **SQLite** for local storage
- **Firebase** for cloud sync and auth
- **React Native Paper** for UI components

## Prerequisites

- Node.js 20+
- npm or yarn
- React Native development environment setup
  - For iOS: Xcode 14+
  - For Android: Android Studio with SDK 33+
- CocoaPods (for iOS)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install iOS pods (macOS only):
```bash
cd ios && pod install && cd ..
# or use npm script
npm run pod-install
```

## Running the App

### Start Metro Bundler
```bash
npm start
```

### iOS (macOS only)
```bash
npm run ios
```

### Android
```bash
# Make sure you have an emulator running or device connected
npm run android
```

## Development

### Code Style

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Firebase Setup

1. Create Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Add iOS app:
   - Download `GoogleService-Info.plist`
   - Place in `ios/GroceryApp/`
3. Add Android app:
   - Download `google-services.json`
   - Place in `android/app/`

## Building for Production

### iOS
```bash
# Release build
npm run ios -- --configuration Release
```

### Android
```bash
# Release APK
cd android && ./gradlew assembleRelease
```

## Project Structure

```
src/
├── components/       # Reusable components
├── screens/         # Screen components
├── navigation/      # Navigation config
├── services/        # Business logic & APIs
├── store/           # State management
├── hooks/           # Custom hooks
├── utils/           # Utility functions
├── types/           # TypeScript types
└── theme/           # Theme configuration
```

## Learn More

- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Firebase for React Native](https://rnfirebase.io/)
- [Project Documentation](../docs/)

## License

Copyright © 2026 GroceryApp. All rights reserved.
