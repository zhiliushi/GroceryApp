# Credentials & API Keys - GroceryApp

## ⚠️ SECURITY WARNING
**This file contains placeholders only. Never commit actual credentials to Git.**

## Firebase Configuration

### Development Environment
```javascript
// mobile-app/src/config/firebase.dev.ts
export const firebaseConfig = {
  apiKey: "YOUR_DEV_API_KEY",
  authDomain: "groceryapp-dev.firebaseapp.com",
  projectId: "groceryapp-dev",
  storageBucket: "groceryapp-dev.appspot.com",
  messagingSenderId: "YOUR_DEV_SENDER_ID",
  appId: "YOUR_DEV_APP_ID",
  measurementId: "YOUR_DEV_MEASUREMENT_ID"
};
```

### Production Environment
```javascript
// mobile-app/src/config/firebase.prod.ts
export const firebaseConfig = {
  apiKey: "YOUR_PROD_API_KEY",
  authDomain: "groceryapp-prod.firebaseapp.com",
  projectId: "groceryapp-prod",
  storageBucket: "groceryapp-prod.appspot.com",
  messagingSenderId: "YOUR_PROD_SENDER_ID",
  appId: "YOUR_PROD_APP_ID",
  measurementId: "YOUR_PROD_MEASUREMENT_ID"
};
```

### Service Account (Backend)
```bash
# backend/.env
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://groceryapp-dev.firebaseio.com
```

**Download from**: Firebase Console > Project Settings > Service Accounts > Generate New Private Key

## Backend API Configuration

### FastAPI Backend (Render)
```bash
# backend/.env
ENVIRONMENT=development
API_V1_STR=/api/v1
ALLOWED_ORIGINS=["http://localhost:3000", "http://localhost:8081"]

# Firebase
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://groceryapp-dev.firebaseio.com

# Open Food Facts
OPEN_FOOD_FACTS_API=https://world.openfoodfacts.org/api/v2
```

### Production Deployment
- **Platform**: Render.com
- **Repository**: Connected to GitHub repo
- **Environment Variables**: Set in Render dashboard
- **Auto-deploy**: Enabled for main branch

## Mobile App Configuration

### Android
```
# android/app/google-services.json (from Firebase)
# Location: mobile-app/android/app/google-services.json
```

### iOS
```
# GoogleService-Info.plist (from Firebase)
# Location: mobile-app/ios/GoogleService-Info.plist
```

### Bundle IDs
- **Android**: `com.groceryapp.mobile`
- **iOS**: `com.groceryapp.mobile`

## API Keys

### Open Food Facts
- **No API key required** for basic usage
- **Rate limit**: Respect the API rate limits
- **API URL**: https://world.openfoodfacts.org/api/v2

### Future Integrations (TBD)
- Payment processing (Stripe/RevenueCat)
- Analytics (Mixpanel/Amplitude)
- Crash reporting (Sentry)
- Push notifications (Firebase Cloud Messaging)

## App Store Credentials

### Android Release Signing

| Property | Value |
|----------|-------|
| Keystore file | `mobile-app/android/app/groceryapp-release.keystore` |
| Keystore format | JKS (RSA 2048-bit, validity 10,000 days) |
| Key alias | `groceryapp-key` |
| Keystore password | `groceryapp2024` |
| Key password | `groceryapp2024` |

**Gradle properties** (in `mobile-app/android/gradle.properties`, gitignored):
```properties
MYAPP_UPLOAD_STORE_FILE=groceryapp-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=groceryapp-key
MYAPP_UPLOAD_STORE_PASSWORD=groceryapp2024
MYAPP_UPLOAD_KEY_PASSWORD=groceryapp2024
```

**Build commands:**
```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"
cd mobile-app/android

# Release APK (for direct device install / testing)
./gradlew.bat assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk

# Release AAB (for Play Store upload)
./gradlew.bat bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

**WARNING:** If this keystore is lost, you cannot update the app on Play Store. Back it up securely.

### Google Play Console (TBD)
- **Developer Account**: [Email]
- **App ID**: com.groceryapp
- **Keystore location**: `mobile-app/android/app/groceryapp-release.keystore`

### Apple App Store (TBD)
- **Apple ID**: [Email]
- **Team ID**: [Team ID]
- **Bundle ID**: com.groceryapp.mobile
- **Certificates**: Managed through Xcode

## Development Access

### Firebase Console
- **URL**: https://console.firebase.google.com
- **Project**: groceryapp-dev
- **Access**: Team members listed in Firebase IAM

### Render Dashboard
- **URL**: https://dashboard.render.com
- **Account**: [Team account]
- **Services**: groceryapp-api

### GitHub Repository
- **URL**: [Repository URL]
- **Access**: Team members with appropriate permissions

## Credential Rotation Schedule

- **Firebase API Keys**: Every 90 days or on team member departure
- **Service Account Keys**: Every 90 days or on security incident
- **App Signing Keys**: Never rotate (for app stores)
- **Backend Secrets**: Every 90 days

## Emergency Contacts

- **Firebase Support**: firebase-support@google.com
- **Render Support**: support@render.com
- **Team Lead**: [Contact info]
- **Security Issues**: [Security contact]

## Notes

1. All credentials are stored securely in team password manager
2. Use separate Firebase projects for dev, staging, and production
3. Never commit `.env` files or service account keys to Git
4. Use `.env.example` files with placeholder values for reference
5. Rotate all credentials immediately if compromised
6. Keep this document updated when credentials change
