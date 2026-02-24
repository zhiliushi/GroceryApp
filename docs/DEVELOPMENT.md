# Development Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Required for React Native |
| npm | 10+ | Comes with Node.js |
| Python | 3.11+ | For backend (tested up to 3.14) |
| JDK | 17+ | Required for Android builds |
| Android Studio | Latest | SDK 34+, platform-tools on PATH |
| Xcode | 15+ | iOS only, macOS required |
| Git | 2.x | Version control |

## Project Setup

```bash
# Clone and install
git clone <repository-url>
cd GroceryApp

# Mobile app
cd mobile-app
npm install
cd ios && pod install && cd ..    # iOS only

# Backend
cd ../backend
python -m venv venv
venv\Scripts\activate             # Windows
python -m pip install -r requirements.txt
cp .env.example .env
```

## Development Workflow

### Running the App

```bash
# Terminal 1: Metro bundler
cd mobile-app
npx react-native start

# Terminal 2: Backend
cd backend
python main.py

# Terminal 3: Android/iOS
cd mobile-app
npx react-native run-android
# or: npx react-native run-ios
```

Or use the PowerShell scripts from the project root:

```powershell
.\scripts\run-backend-local.ps1    # Starts backend with venv
.\scripts\run-android-debug.ps1    # Starts Metro + builds + installs + logcat
```

### Code Validation

```bash
cd mobile-app

# Run everything
npm run validate    # type-check + lint + test

# Individual checks
npm run type-check  # TypeScript errors
npm run lint        # ESLint
npm test            # Jest tests
```

## Code Style

### TypeScript Conventions

- Strict TypeScript (`strict: true` in tsconfig)
- Path aliases: `@utils/`, `@services/`, `@components/`, `@screens/`, `@hooks/`, `@store/`, `@database/`
- Interfaces prefixed with `I` for database records: `IGroceryItem`, `IShoppingList`
- Input types suffixed with `Input`: `CreateGroceryItemInput`, `UpdateGroceryItemInput`
- Enums as union types, not TypeScript enums: `type InventoryStatus = 'active' | 'consumed' | 'expired' | 'discarded'`
- Zod schemas for runtime validation at system boundaries

### Component Patterns

- Screens in `src/screens/{feature}/` — one directory per feature area
- Reusable components in `src/components/{category}/`
- Hooks abstract service interactions: `useAuth`, `useBarcode`, `useSync`
- Zustand stores for persistent UI state
- `React.memo` for list item components (e.g., `InventoryItemCard`)
- FlatList optimization: `removeClippedSubviews`, `maxToRenderPerBatch`, `windowSize`

### Python Conventions

- FastAPI with Pydantic models for all request/response types
- Service layer pattern: routes → services → Firestore
- Pydantic Settings for environment configuration
- Async endpoints where possible
- Structured logging with `logging` module

## Git Workflow

### Branch Naming

```
feature/barcode-scanning
fix/expiry-notification-timing
refactor/database-schema
docs/api-reference
```

### Commit Messages

Use conventional commits:

```
feat: add barcode contribution modal
fix: correct expiry notification scheduling during quiet hours
refactor: normalize category/unit into lookup tables
docs: add API reference documentation
test: add inventory repository CRUD tests
chore: update dependencies to latest stable
```

### PR Process

1. Create feature branch from `main`
2. Make changes, write tests
3. Run `npm run validate` — must pass
4. Push branch and create PR
5. CI runs lint + type-check + tests
6. Merge after review

## Testing

### Running Tests

```bash
cd mobile-app

npm test                   # All tests (CI mode)
npm run test:watch         # Interactive watch mode
npm run test:coverage      # Generate coverage report
npm run test:unit          # Utils and repositories only
npm run test:integration   # Integration scenarios only
```

### Full Project Test Suite

```powershell
.\scripts\test-all.ps1
```

Runs: Jest tests + coverage, Python syntax check, TypeScript type check, ESLint.

### Writing Tests

**Test file location**: Mirror the source structure with `__tests__/` directories:
```
src/utils/dateUtils.ts
src/utils/__tests__/dateUtils.test.ts
```

**Test utilities** in `src/__tests__/testUtils.tsx`:
- `renderWithProviders()` — wraps component with all required providers
- `buildInventoryItem()` — creates mock inventory items
- `buildExpiringSoonItem()` — creates items expiring within days
- `buildBarcodeProduct()` — creates mock barcode lookup results
- `flushPromises()` — drains microtask queue

**Mock setup** in `jest.setup.js`:
- 15 native module mocks pre-configured
- Firebase, camera, notifications, network, navigation all mocked
- Import and configure additional mocks per test as needed

### Test Categories

| Category | Pattern | What to Test |
|----------|---------|-------------|
| Unit | `utils/__tests__/` | Pure functions, formatters, validators |
| Service | `services/*/__tests__/` | Business logic, API calls, caching |
| Repository | `repositories/__tests__/` | Database CRUD, queries |
| Component | `components/*/__tests__/` | Rendering, user interaction |
| Screen | `screens/*/__tests__/` | Data loading, navigation |
| Integration | `__tests__/integration/` | Multi-service workflows |

## Debugging

### React Native

```bash
# Reset Metro cache
npx react-native start --reset-cache

# Android logs
adb logcat *:S ReactNative:V ReactNativeJS:V GroceryApp:V

# React DevTools
npx react-devtools
```

### Backend

```bash
# Debug mode (auto-enabled in development)
python main.py
# Logs at DEBUG level when ENVIRONMENT=development

# API docs
# http://localhost:8000/docs      (Swagger UI)
# http://localhost:8000/redoc     (ReDoc)
```

### Common Issues

| Issue | Fix |
|-------|-----|
| Metro bundler stale cache | `npx react-native start --reset-cache` |
| Android build fails | `cd android && .\gradlew.bat clean && cd ..` |
| iOS pod errors | `cd ios && pod install --repo-update && cd ..` |
| WatermelonDB schema mismatch | Increment `DB_VERSION` in constants.ts, add migration |
| Firebase "no app" error | Check `google-services.json` in `android/app/` |
| Python import errors | Ensure venv is activated: `venv\Scripts\activate` |
| pydantic build fails (Python 3.14) | Use `pydantic>=2.12.5` (has prebuilt wheels) |

## Build Scripts

### PowerShell Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `build-android.ps1` | Clean Gradle build → release APK → copies to `builds/` with timestamp |
| `run-android-debug.ps1` | Checks adb, starts Metro, builds debug, streams logcat |
| `run-backend-local.ps1` | Creates venv, installs deps, copies .env, starts FastAPI |
| `deploy-backend.ps1` | Checks git status, pushes to main, polls health endpoint |
| `test-all.ps1` | Jest tests + coverage, Python syntax, TypeScript check, ESLint |

### NPM Scripts (`mobile-app/package.json`)

| Script | Command |
|--------|---------|
| `test` | `jest --ci --forceExit --passWithNoTests` |
| `test:watch` | `jest --watch` |
| `test:coverage` | `jest --coverage --ci --forceExit --passWithNoTests` |
| `test:unit` | `jest --testPathPattern='utils/\|repositories/'` |
| `test:integration` | `jest --testPathPattern='integration/'` |
| `lint` | `eslint src/ --ext .ts,.tsx` |
| `lint:fix` | `eslint src/ --ext .ts,.tsx --fix` |
| `type-check` | `tsc --noEmit` |
| `format` | `prettier --write "src/**/*.{ts,tsx,js,jsx,json,md}"` |
| `format:check` | `prettier --check "src/**/*.{ts,tsx,js,jsx,json,md}"` |
| `validate` | `type-check && lint && test` |
| `build:android` | `gradlew.bat assembleRelease` |
| `build:ios` | `xcodebuild archive` |
| `clean` | `gradlew.bat clean` |
| `clean:all` | Remove node_modules + reinstall |

## Environment Variables

### Mobile App (`mobile-app/.env`)

```env
API_BASE_URL=http://localhost:8000
FIREBASE_WEB_CLIENT_ID=your-google-oauth-web-client-id
```

### Backend (`backend/.env`)

```env
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
OPEN_FOOD_FACTS_API=https://world.openfoodfacts.org/api/v2
AI_SERVICE_URL=                    # Optional: Ollama/OpenAI endpoint
AI_MODEL_NAME=llama3.2
ALLOWED_ORIGINS=["*"]
ENVIRONMENT=development
```
