# GroceryApp - Project Context

## Project Overview

GroceryApp is a comprehensive grocery management mobile application built with React Native that helps users manage their grocery inventory, track purchases, scan barcodes, and analyze spending patterns. The app operates on a freemium model with both free and paid tiers.

## Business Model

### Free Tier
- **Local-only storage** using React Native SQLite Storage
- Basic grocery management features:
  - Manual item entry and management
  - Barcode scanning with product lookup
  - Simple inventory tracking
  - Basic expense tracking
  - Local data persistence

### Paid Tier (Premium)
- **Cloud sync** via Firebase Firestore
- **AI-powered features**:
  - Smart shopping list generation
  - Price trend analysis
  - Expiry date predictions
  - Recipe suggestions based on inventory
- **Advanced analytics**:
  - Spending insights and trends
  - Category-wise expense breakdown
  - Budget tracking and alerts
- **Multi-device sync**
- **Data backup and restore**
- **Priority support**

## Technology Stack

### Mobile App (React Native)
- **Framework**: React Native (latest stable)
- **Language**: TypeScript
- **Local Database**: React Native SQLite Storage (equivalent to Android Room)
- **Cloud Services**: Firebase (Firestore + Authentication)
- **Barcode Scanning**: React Native Camera / react-native-vision-camera
- **Navigation**: React Navigation v6+
- **State Management**: Redux Toolkit / Zustand
- **UI Components**: React Native Paper / Native Base
- **HTTP Client**: Axios

### Backend (Python FastAPI)
- **Framework**: FastAPI
- **Deployment**: Render.com
- **Database**: Firebase Firestore (cloud database)
- **External APIs**:
  - Open Food Facts API (product information)
  - Firebase Admin SDK
- **Purpose**:
  - Barcode scanning workflow intermediary
  - Analytics data aggregation
  - AI feature processing (paid tier)
  - Firebase integration

### Infrastructure
- **Cloud Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage (for images)
- **Backend Hosting**: Render.com (FastAPI)
- **External API**: Open Food Facts (product database)

## Architecture Overview

### Data Flow - Barcode Scanning

```
Mobile App (Scanner)
    ↓
    → Capture barcode via Camera
    ↓
    → Send to FastAPI Backend (Render)
    ↓
    → Query Open Food Facts API
    ↓
    → Store/Update in Firebase (paid users)
    ↓
    → Return product data to app
    ↓
    → Store locally in SQLite (all users)
    ↓
Display product info to user
```

### Data Flow - Analytics Sync (Paid Tier Only)

```
Mobile App (Local SQLite)
    ↓
    → Periodic batch collection of:
       - Purchase records
       - Inventory changes
       - Expense data
    ↓
    → Send to FastAPI Backend
    ↓
    → Validate user subscription
    ↓
    → Store in Firebase Firestore
    ↓
    → Trigger AI analysis (if enabled)
    ↓
Return insights to mobile app
```

### Storage Strategy

#### Free Tier Users
- All data stored locally in SQLite
- No cloud backup
- Data tied to single device
- Manual export/import for data transfer

#### Paid Tier Users
- **Primary**: Local SQLite (for offline access)
- **Secondary**: Firebase Firestore (for sync & backup)
- Two-way sync on app launch and periodically
- Conflict resolution: Last-write-wins with timestamps
- Offline-first architecture

## Core Features

### 1. Inventory Management
- Add/Edit/Delete grocery items
- Categories and tags
- Quantity tracking
- Expiry date management
- Low stock alerts
- Search and filter

### 2. Barcode Scanning
- Camera-based barcode scanning
- Product info lookup via Open Food Facts
- Manual entry fallback
- Quick add to inventory
- Historical scan records

### 3. Shopping List
- Create multiple lists
- Smart suggestions (AI - paid tier)
- Share lists (paid tier)
- Item categorization
- Price estimates

### 4. Expense Tracking
- Purchase recording
- Receipt scanning (paid tier)
- Category-based tracking
- Budget management
- Monthly/weekly reports

### 5. Analytics & Insights (Enhanced for Paid Tier)
- Spending trends
- Category analysis
- Price comparisons
- Waste tracking (expired items)
- AI-powered predictions

### 6. User Management
- Firebase Authentication
  - Email/Password
  - Google Sign-In
  - Apple Sign-In (iOS)
- Profile management
- Subscription management
- Settings and preferences

## Project Structure

```
GroceryApp/
├── mobile-app/              # React Native application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── screens/         # Screen components
│   │   ├── navigation/      # Navigation configuration
│   │   ├── services/        # API and business logic
│   │   │   ├── api/         # API calls
│   │   │   ├── database/    # SQLite operations
│   │   │   ├── firebase/    # Firebase integration
│   │   │   └── barcode/     # Barcode scanning logic
│   │   ├── store/           # State management
│   │   ├── utils/           # Utility functions
│   │   ├── types/           # TypeScript type definitions
│   │   └── constants/       # Constants and config
│   ├── android/             # Android-specific code
│   ├── ios/                 # iOS-specific code
│   └── package.json
│
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/      # API endpoints
│   │   │       ├── barcode.py
│   │   │       ├── analytics.py
│   │   │       └── ai.py
│   │   ├── core/            # Configuration
│   │   ├── models/          # Data models
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utilities
│   ├── tests/               # Backend tests
│   ├── requirements.txt
│   └── main.py
│
└── docs/                    # Documentation
    ├── PROJECT_CONTEXT.md
    ├── DEVELOPMENT_RULES.md
    ├── CREDENTIALS.md
    ├── ACTIVE_TASKS.md
    └── subsystems/
        ├── android-grocery-app.md
        └── interface-grocery-app.md
```

## Development Phases

### Phase 1: Core Mobile App (Current)
- [ ] Project setup and configuration
- [ ] Basic UI/UX implementation
- [ ] SQLite database integration
- [ ] Core inventory management
- [ ] Basic CRUD operations

### Phase 2: Barcode Integration
- [ ] Camera integration
- [ ] Barcode scanning functionality
- [ ] FastAPI backend setup
- [ ] Open Food Facts API integration
- [ ] Product lookup workflow

### Phase 3: Cloud Features
- [ ] Firebase Authentication
- [ ] Firebase Firestore integration
- [ ] Cloud sync logic
- [ ] Subscription management
- [ ] Free vs Paid tier logic

### Phase 4: Analytics
- [ ] Local analytics tracking
- [ ] Backend analytics API
- [ ] Data visualization
- [ ] Report generation

### Phase 5: AI Features (Paid Tier)
- [ ] Smart shopping lists
- [ ] Price predictions
- [ ] Expiry predictions
- [ ] Recipe suggestions
- [ ] Spending insights

### Phase 6: Polish & Launch
- [ ] Performance optimization
- [ ] Testing (unit, integration, E2E)
- [ ] Security audit
- [ ] App store preparation
- [ ] Marketing materials

## Key Technical Decisions

### Why React Native?
- Cross-platform (iOS + Android) from single codebase
- Large ecosystem and community
- Good performance for this use case
- Faster development and iteration

### Why SQLite for Local Storage?
- Offline-first capability
- Fast local queries
- Proven reliability
- Small footprint
- No network dependency

### Why Firebase?
- Managed backend reduces infrastructure work
- Real-time sync capabilities
- Built-in authentication
- Scalable and reliable
- Free tier for development

### Why FastAPI Backend?
- Fast and modern Python framework
- Easy deployment on Render
- Excellent performance
- Built-in API documentation
- Async support for external API calls

### Why Open Food Facts?
- Free and open product database
- Good barcode coverage
- Community-maintained
- No API key required for basic usage
- Nutrition data available

## Security Considerations

1. **API Keys**: Store in environment variables, never commit
2. **Firebase Rules**: Implement proper Firestore security rules
3. **User Data**: Encrypt sensitive data in SQLite
4. **Authentication**: Use Firebase Auth best practices
5. **Backend**: Validate all inputs, implement rate limiting
6. **HTTPS**: All network communication over HTTPS
7. **Subscription Validation**: Server-side verification

## Performance Targets

- App launch: < 2 seconds
- Barcode scan: < 1 second
- Local database queries: < 100ms
- Cloud sync: < 5 seconds for typical dataset
- UI responsiveness: 60 FPS target

## Monetization Strategy

- Free tier to build user base
- Premium subscription: $4.99/month or $49.99/year
- 7-day free trial for premium features
- Feature-gated approach (not time-limited for free tier)
- In-app purchase via App Store/Play Store

## Success Metrics

- User retention rate
- Free to paid conversion rate
- Daily active users (DAU)
- Barcode scan success rate
- Cloud sync reliability
- App store ratings
- Customer support ticket volume
