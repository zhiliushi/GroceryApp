# Web Analytics Dashboard — Implementation Plan

> **Status**: Planned (not yet implemented)
> **Scope**: Web-only feature for paid users. Not shown in mobile app.
> **Platform**: React + Vite + TypeScript web application
> **Created**: 2026-01-30

---

## Overview

A web-based analytics dashboard for paid-tier users that provides shopping patterns, waste reduction analysis, nutrition overview, spending analysis, AI-powered insights, and report export. Hosted separately from the mobile app, authenticated via the same Firebase project.

**Data flow**: `Web App -> Firebase Auth -> Bearer Token -> FastAPI Backend -> Firebase Admin SDK -> Firestore -> Aggregated JSON -> Recharts`

---

## Architecture

Two parts:
- **(A)** New React + Vite + TypeScript web app at `web-dashboard/`
- **(B)** Backend API enhancements at `backend/`

The web app authenticates via Firebase Web SDK (same project as mobile), sends Bearer tokens to FastAPI, which queries Firestore and returns aggregated analytics JSON. Charts rendered with Recharts.

---

## Part A: Backend Enhancements

### New Files

| File | Purpose |
|------|---------|
| `backend/app/api/dependencies.py` | Firebase auth token verification + paid-tier gate |
| `backend/app/schemas/__init__.py` | Package init |
| `backend/app/schemas/analytics.py` | All Pydantic response models (DashboardResponse, per-section models) |
| `backend/app/services/__init__.py` | Package init |
| `backend/app/services/analytics_service.py` | Firestore queries + data aggregation for all 4 dashboard sections |
| `backend/app/services/insights_service.py` | Rule-based AI insights engine |
| `backend/app/services/export_service.py` | Email report via SendGrid |

### Modified Files

| File | Changes |
|------|---------|
| `backend/app/api/routes/analytics.py` | Replace stubs with real endpoints using services + dependencies |
| `backend/main.py` | Update CORS origins to include web dashboard origin |
| `backend/app/core/config.py` | Add `SENDGRID_API_KEY`, `FRONTEND_URL` settings |
| `backend/requirements.txt` | Add `sendgrid` |

### API Endpoints

```
GET  /api/analytics/dashboard?period=7d|30d|3m|all    # Full dashboard (primary)
GET  /api/analytics/shopping-patterns?period=...       # Individual section
GET  /api/analytics/waste-analysis?period=...
GET  /api/analytics/nutrition?period=...
GET  /api/analytics/spending?period=...
GET  /api/analytics/insights?period=...
POST /api/analytics/export/email   { email, period }   # Email report
POST /api/analytics/sync           (keep existing)
GET  /api/analytics/stats/{user_id} (keep existing)
```

All endpoints require `Authorization: Bearer <firebase_id_token>` + paid-tier check.

### Auth Dependency

- `get_current_user(token)`: Extracts Bearer token, calls `firebase_admin.auth.verify_id_token()`, returns `uid`
- `require_paid_user(uid)`: Reads `users/{uid}` from Firestore, checks `tier == 'paid'`, raises 403 if not

### Analytics Service

Reads Firestore subcollections under `users/{userId}/`:

| Dashboard Section | Collections Read | Key Fields |
|---|---|---|
| Shopping Patterns | `grocery_items`, `analytics` | `purchaseDate`, `price`, `name`, `categoryId` |
| Waste Analysis | `grocery_items` (expired/discarded), `analytics` (`item_expired_wasted`) | `status`, `consumedDate`, `categoryId`, `reason` |
| Nutrition Overview | `grocery_items` (all) | `categoryId`, `name` |
| Spending Analysis | `grocery_items` (with price) | `price`, `purchaseDate`, `categoryId` |

**Key calculations**:
- Shopping frequency: distinct purchase dates = trips
- Predicted next shopping: median interval between trips (null if < 3 trips)
- Avg spend per trip: sum prices by date, average across trips
- Waste %: (expired + discarded) / total * 100, with delta vs previous period
- Nutrition balance score: (unique_food_groups / 7) * 100
- Cost trends: per-item average price over time, top 5 items

**Category mapping**: Embed 9 default categories from `seed.ts` as Python constant. Build dynamic map from Firestore item data.

### AI Insights Service

Rule-based heuristics (no ML):
1. Waste reduction (waste % > 20%): smaller quantity suggestions
2. Shopping optimization (frequency > 3x/week): weekly planning tips
3. Meal planning: template-based suggestions by category mix
4. Budget alerts: spending trend notifications
5. Expiry warnings: items expiring within 3 days

### Export Service

- Email: HTML template via SendGrid, key stats + dashboard link
- PDF: Client-side `window.print()` with print-optimized CSS

---

## Part B: Web Dashboard (New App)

### Project Structure

```
web-dashboard/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  .env.example
  .gitignore
  public/
    favicon.ico
  src/
    main.tsx                         # Root: Firebase init, QueryClient, Router
    App.tsx                          # Routes
    config/
      firebase.ts                   # Firebase web SDK init
      api.ts                        # Axios client with Bearer token interceptor
      constants.ts                  # Category colors, period labels
    hooks/
      useAuth.ts                    # Firebase auth state
      useDashboard.ts               # React Query data fetching
      useExport.ts                  # Export actions
    services/
      authService.ts                # Sign in/out (Firebase web SDK)
      dashboardService.ts           # API calls to /api/analytics/*
    types/
      analytics.ts                  # TS interfaces matching backend schemas
      auth.ts                       # User, AuthState
    components/
      layout/
        DashboardLayout.tsx         # Header + main content area
        Header.tsx                  # Logo, user avatar, sign out
      auth/
        LoginPage.tsx               # Email/password + Google sign-in
        AuthGuard.tsx               # Redirect unauthenticated -> login
        PaidGuard.tsx               # Show upgrade prompt if free tier
      dashboard/
        DashboardPage.tsx           # Period selector + all chart sections
        PeriodSelector.tsx          # 7d | 30d | 3m | All toggle
      charts/
        ShoppingPatterns.tsx        # BarChart + LineChart
        WasteAnalysis.tsx           # StatCards + BarChart
        NutritionOverview.tsx       # PieChart + balance score
        SpendingAnalysis.tsx        # PieChart + LineChart
        AIInsights.tsx              # Card list with recommendations
      export/
        ExportMenu.tsx              # Print PDF + Email report
      common/
        LoadingSpinner.tsx
        ErrorBoundary.tsx
        StatCard.tsx
        EmptyState.tsx
    styles/
      globals.css                   # Base styles, CSS variables, @media print
      dashboard.module.css
    utils/
      formatters.ts                 # Currency, date, percentage formatting
```

### Dependencies

```
react, react-dom, react-router-dom, firebase, recharts, @tanstack/react-query, axios
devDeps: @vitejs/plugin-react, typescript, vite, @types/react, @types/react-dom
```

### Auth Flow

1. `AuthGuard` checks Firebase auth via `onAuthStateChanged`
2. If unauthenticated -> `LoginPage` (email/password + Google sign-in via `signInWithPopup`)
3. Same Firebase project = same user accounts as mobile app
4. `PaidGuard` calls backend; 403 -> "Upgrade to Premium" prompt
5. All API calls include `Authorization: Bearer <idToken>`

### Chart Components

| Component | Recharts Used | Data Shown |
|---|---|---|
| ShoppingPatterns | `BarChart`, `LineChart` | Top 10 items, purchase frequency, avg spend, predicted date |
| WasteAnalysis | `BarChart`, `StatCard` | Expired count, waste % delta, wasted categories, suggestions |
| NutritionOverview | `PieChart`, circular progress | Food group distribution, balance score 0-100, missing groups |
| SpendingAnalysis | `PieChart`, `LineChart` | Total spent, category breakdown, cost trends (top 5 items) |
| AIInsights | Card layout | Recommendations, meal planning, shopping tips |

---

## Implementation Order

### Phase 1: Backend foundation
1. Auth dependency + paid-tier guard
2. Pydantic response schemas
3. Analytics service (Firestore aggregation)
4. Insights service (rule-based AI)
5. Export service (email)
6. Replace analytics route stubs
7. CORS + config updates

### Phase 2: Web app scaffold
1. Init Vite + React + TS project
2. Firebase web SDK config
3. Auth flow (Login, AuthGuard, PaidGuard)
4. Axios client + React Query setup

### Phase 3: Dashboard UI
1. Layout + Header + PeriodSelector
2. Common components (StatCard, Spinner, ErrorBoundary, EmptyState)
3. All 5 chart section components
4. Export menu + print CSS

### Phase 4: Polish
1. Loading/error/empty states
2. Responsive layout
3. Documentation

---

## Verification Checklist

- [ ] Backend compiles: `python -m py_compile main.py`
- [ ] Web app compiles: `npx tsc --noEmit`
- [ ] Backend health check: `GET /health`
- [ ] Web app dev server loads at `http://localhost:5173`
- [ ] Auth flow: login -> dashboard for paid, upgrade prompt for free
- [ ] Period selector switches re-fetch all charts
- [ ] PDF export via browser print
- [ ] Email export sends report
- [ ] All 5 dashboard sections render
