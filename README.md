# GroceryApp

A comprehensive grocery management mobile application built with React Native and TypeScript, featuring inventory tracking with a 3-stage item lifecycle, barcode scanning with multi-source lookup, shopping lists, cloud sync, local notifications, and AI-powered insights.

## Project Structure

```
GroceryApp/
├── mobile-app/          # React Native mobile application (TypeScript)
├── backend/             # Python FastAPI backend (Render deployment)
├── scripts/             # PowerShell build, run, test, and deploy scripts
├── docs/                # Project documentation
├── .github/workflows/   # CI/CD pipeline (GitHub Actions)
└── firestore.rules      # Firebase Firestore security rules
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Framework | React Native 0.83.1 |
| Language | TypeScript 5.8+ |
| Local Database | WatermelonDB (SQLite) |
| Cloud Database | Firebase Firestore |
| Authentication | Firebase Auth (email + Google) |
| State Management | Zustand (persisted with AsyncStorage) |
| Navigation | React Navigation 7 (stack + bottom tabs) |
| UI Components | React Native Paper |
| Data Fetching | TanStack React Query |
| Notifications | Notifee |
| Backend | FastAPI (Python 3.11+) |
| Barcode API | Open Food Facts |
| Deployment | Render.com (Docker) |
| CI/CD | GitHub Actions |

## Features

### Free Tier
- Local SQLite inventory management with offline-first architecture
- Barcode scanning with 7-step multi-source lookup (Firebase, Open Food Facts)
- 3-stage item lifecycle: Scan → Active Inventory → Consumed/Expired/Discarded
- Shopping lists with category grouping and progress tracking
- Local notifications for expiry alerts, low stock, and shopping reminders
- Product contribution for unrecognized barcodes

### Premium Tier
- Cloud sync across devices (Firestore bidirectional sync)
- AI-powered insights (waste reduction, shopping optimization, nutrition, budget)
- Advanced analytics dashboard
- Shopping list sharing
- Recipe suggestions

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- React Native development environment ([React Native CLI setup](https://reactnative.dev/docs/set-up-your-environment))
- Python 3.11+ (for backend)
- Android Studio (for Android) or Xcode (for iOS)
- Firebase project with Auth + Firestore enabled

### Mobile App

```bash
cd mobile-app
npm install

# Android
npx react-native run-android

# iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
python -m pip install -r requirements.txt
cp .env.example .env           # Edit with your Firebase credentials
python main.py                 # Starts at http://localhost:8000
```

### PowerShell Scripts

```powershell
# Run all tests (mobile + backend)
.\scripts\test-all.ps1

# Start backend locally (auto-creates venv, installs deps)
.\scripts\run-backend-local.ps1

# Build Android release APK
.\scripts\build-android.ps1

# Run Android debug on device/emulator
.\scripts\run-android-debug.ps1

# Deploy backend to Render
.\scripts\deploy-backend.ps1
```

## NPM Scripts

```bash
cd mobile-app

npm test                  # Run all tests (CI mode)
npm run test:watch        # Watch mode for development
npm run test:coverage     # Tests with coverage report
npm run test:unit         # Unit tests only (utils + repositories)
npm run test:integration  # Integration tests only
npm run lint              # ESLint check
npm run lint:fix          # ESLint auto-fix
npm run type-check        # TypeScript type check (no emit)
npm run format            # Prettier formatting
npm run format:check      # Prettier check only
npm run validate          # Full validation: type-check + lint + test
npm run build:android     # Release APK via Gradle
npm run build:ios         # Release build via xcodebuild
npm run clean             # Clean Android build
npm run clean:all         # Remove node_modules and reinstall
```

## Architecture Overview

```
Mobile App (React Native)
├── Config Layer          → Firebase, API client, constants
├── Database Layer        → WatermelonDB schema, 7 models, 6 repositories
├── Service Layer         → Barcode, Firebase (Auth/Firestore/Analytics/Storage),
│                           Sync, Notifications, Open Food Facts
├── Hook Layer            → useAuth, useDatabase, useBarcode, useSync, useNotifications
├── Store Layer           → Zustand stores (auth, inventory, scan, settings, sync)
├── Navigation Layer      → Root → Auth stack / Main bottom tabs with nested stacks
└── UI Layer              → Screens (9) + Components (common, grocery, scanner)

Backend (FastAPI)
├── Routes                → /api/barcode/*, /api/analytics/*
├── Schemas               → Pydantic request/response models
├── Services              → Barcode lookup, analytics aggregation, AI insights
└── Config                → Environment settings, Firebase Admin SDK
```

## Documentation

| Document | Description |
|----------|-------------|
| [Mobile App](docs/MOBILE_APP.md) | React Native setup, component architecture, state management |
| [Backend](docs/BACKEND.md) | FastAPI endpoints, deployment, Firebase Admin SDK |
| [Database](docs/DATABASE.md) | WatermelonDB schema, models, repositories, Firestore structure |
| [Workflows](docs/WORKFLOWS.md) | Barcode scanning, sync, auth, notifications, item lifecycle |
| [Development](docs/DEVELOPMENT.md) | Code style, git workflow, testing, debugging |
| [API Reference](docs/API.md) | Complete API documentation with examples |
| [Project Context](docs/PROJECT_CONTEXT.md) | Architecture decisions and technical context |
| [Development Rules](docs/DEVELOPMENT_RULES.md) | Coding standards and conventions |
| [Changes Record](docs/changes_record.md) | Append-only changelog |

## Deployment

### Backend (Render)
- Auto-deploys on push to `main` via `render.yaml` Blueprint
- Docker container: Python 3.11-slim + Gunicorn + Uvicorn workers
- Health check endpoint: `GET /health`
- CI/CD: GitHub Actions runs lint + import verification before deploy

### Mobile App
- **Android**: `.\scripts\build-android.ps1` generates signed APK in `builds/`
- **iOS**: `npm run build:ios` builds via xcodebuild

## License

Copyright 2026 GroceryApp. All rights reserved.
