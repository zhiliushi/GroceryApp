import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Layout
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const ProtectedRoute = lazy(() => import('@/components/layout/ProtectedRoute'));
const AdminRoute = lazy(() => import('@/components/layout/AdminRoute'));
const TierRoute = lazy(() => import('@/components/layout/TierRoute'));

// Pages
const LoginPage = lazy(() => import('@/pages/login/LoginPage'));

// Onboarding v2 — auth-state pages (PLAN_ONBOARDING_V2.md Phase 4)
const StateGate = lazy(() => import('@/components/auth/StateGate'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const PendingApprovalPage = lazy(() => import('@/pages/auth/PendingApprovalPage'));
const DisabledPage = lazy(() => import('@/pages/auth/DisabledPage'));
const RegistrationClosedPage = lazy(() => import('@/pages/auth/RegistrationClosedPage'));
const RegistrationFormPage = lazy(() => import('@/pages/register/RegistrationFormPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ShoppingListsPage = lazy(() => import('@/pages/shopping-lists/ShoppingListsPage'));
const ShoppingListDetailPage = lazy(() => import('@/pages/shopping-lists/ShoppingListDetailPage'));
const FoodbanksListPage = lazy(() => import('@/pages/foodbanks/FoodbanksListPage'));
const FoodbankFormPage = lazy(() => import('@/pages/foodbanks/FoodbankFormPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const ProductsListPage = lazy(() => import('@/pages/products/ProductsListPage'));
const ProductFormPage = lazy(() => import('@/pages/products/ProductFormPage'));
const UsersListPage = lazy(() => import('@/pages/users/UsersListPage'));
const UserDetailPage = lazy(() => import('@/pages/users/UserDetailPage'));
const ContributedPage = lazy(() => import('@/pages/contributed/ContributedPage'));
const NeedsReviewPage = lazy(() => import('@/pages/needs-review/NeedsReviewPage'));
const PriceRecordsPage = lazy(() => import('@/pages/price-records/PriceRecordsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin-settings/AdminSettingsPage'));
const MapPage = lazy(() => import('@/pages/map/MapPage'));
const JoinPage = lazy(() => import('@/pages/join/JoinPage'));
const MealsPage = lazy(() => import('@/pages/meals/MealsPage'));
const RecipeFormPage = lazy(() => import('@/pages/meals/RecipeFormPage'));
const StoragePage = lazy(() => import('@/pages/storage/StoragePage'));

// Refactor pages
const HealthScorePage = lazy(() => import('@/pages/health-score/HealthScorePage'));
const RemindersPage = lazy(() => import('@/pages/reminders/RemindersPage'));
const WastePage = lazy(() => import('@/pages/waste/WastePage'));
const SpendingPage = lazy(() => import('@/pages/spending/SpendingPage'));
const SpendingHistoryPage = lazy(() => import('@/pages/spending/SpendingHistoryPage'));
const PrivacyPage = lazy(() => import('@/pages/legal/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/legal/TermsPage'));
const MyItemsPage = lazy(() => import('@/pages/my-items/MyItemsPage'));
const PurchaseEventDetailPage = lazy(() => import('@/pages/my-items/PurchaseEventDetailPage'));
const CatalogListPage = lazy(() => import('@/pages/catalog/CatalogListPage'));
const CatalogEntryPage = lazy(() => import('@/pages/catalog/CatalogEntryPage'));
const InsightsPage = lazy(() => import('@/pages/insights/InsightsPage'));
const CatalogAnalysisPage = lazy(() => import('@/pages/admin/CatalogAnalysisPage'));
const CatalogCountersDiagnosticPage = lazy(
  () => import('@/pages/admin/CatalogCountersDiagnosticPage'),
);
const MigrationDryRunPage = lazy(() => import('@/pages/admin/MigrationDryRunPage'));
const AdminMigrationPage = lazy(() => import('@/pages/admin/AdminMigrationPage'));
const ExperimentalPage = lazy(() => import('@/pages/admin/ExperimentalPage'));
const UserManualPage = lazy(() => import('@/pages/help/UserManualPage'));
const StorageDetailPage = lazy(() => import('@/pages/storage/StorageDetailPage'));

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ga-accent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// TierRoute wraps user-facing pages to enforce tier-based access.
// Admin users bypass all tier checks (handled inside useVisibility).
function TierGated({ page, children }: { page: string; children: React.ReactNode }) {
  return (
    <SuspenseWrapper>
      <TierRoute page={page}>{children}</TierRoute>
    </SuspenseWrapper>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/join/:code',
    element: (
      <SuspenseWrapper>
        <JoinPage />
      </SuspenseWrapper>
    ),
  },
  // Onboarding v2 — auth-state pages. Each is StateGate-wrapped so it only
  // renders for users in the matching state; otherwise StateGate redirects
  // to the destination for the user's actual state. See PLAN_ONBOARDING_V2.md
  // Phase 4. Lives outside AppLayout — full-screen standalone screens.
  {
    path: '/auth/verify-email',
    element: (
      <SuspenseWrapper>
        <StateGate requires="verify_email_required">
          <VerifyEmailPage />
        </StateGate>
      </SuspenseWrapper>
    ),
  },
  {
    path: '/auth/pending',
    element: (
      <SuspenseWrapper>
        <StateGate requires="pending_approval">
          <PendingApprovalPage />
        </StateGate>
      </SuspenseWrapper>
    ),
  },
  {
    path: '/auth/disabled',
    element: (
      <SuspenseWrapper>
        <StateGate requires="disabled">
          <DisabledPage />
        </StateGate>
      </SuspenseWrapper>
    ),
  },
  {
    path: '/auth/closed',
    element: (
      <SuspenseWrapper>
        <StateGate requires="registration_closed">
          <RegistrationClosedPage />
        </StateGate>
      </SuspenseWrapper>
    ),
  },
  {
    path: '/register',
    element: (
      <SuspenseWrapper>
        <StateGate requires="registration_required">
          <RegistrationFormPage />
        </StateGate>
      </SuspenseWrapper>
    ),
  },
  // Legal pages — publicly accessible, no auth required.
  {
    path: '/privacy',
    element: (
      <SuspenseWrapper>
        <PrivacyPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/terms',
    element: (
      <SuspenseWrapper>
        <TermsPage />
      </SuspenseWrapper>
    ),
  },
  {
    element: (
      <SuspenseWrapper>
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      </SuspenseWrapper>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // ── User-facing pages (tier-gated) ──────────────────────
      { path: 'dashboard', element: <TierGated page="dashboard"><DashboardPage /></TierGated> },
      { path: 'health-score', element: <SuspenseWrapper><HealthScorePage /></SuspenseWrapper> },
      { path: 'reminders', element: <SuspenseWrapper><RemindersPage /></SuspenseWrapper> },
      { path: 'waste', element: <SuspenseWrapper><WastePage /></SuspenseWrapper> },
      { path: 'spending', element: <SuspenseWrapper><SpendingPage /></SuspenseWrapper> },
      { path: 'spending/history', element: <SuspenseWrapper><SpendingHistoryPage /></SuspenseWrapper> },
      // My Items — refactored purchase-events list
      { path: 'my-items', element: <SuspenseWrapper><MyItemsPage /></SuspenseWrapper> },
      { path: 'my-items/:eventId', element: <SuspenseWrapper><PurchaseEventDetailPage /></SuspenseWrapper> },
      // Catalog — user's personal reusable name catalog
      { path: 'catalog', element: <SuspenseWrapper><CatalogListPage /></SuspenseWrapper> },
      { path: 'catalog/:nameNorm', element: <SuspenseWrapper><CatalogEntryPage /></SuspenseWrapper> },
      { path: 'insights', element: <SuspenseWrapper><InsightsPage /></SuspenseWrapper> },
      // Legacy URL support — redirect old /inventory → /my-items.
      { path: 'inventory', element: <Navigate to="/my-items" replace /> },
      { path: 'inventory/:uid/:itemId', element: <Navigate to="/my-items" replace /> },
      { path: 'item/:barcode', element: <Navigate to="/catalog" replace /> },
      { path: 'analytics', element: <Navigate to="/insights" replace /> },
      { path: 'storage', element: <TierGated page="storage"><StoragePage /></TierGated> },
      // Per-location detail — lightweight, current-state-only view of one
      // storage location ("what's in my fridge right now?"). Manager view
      // for adding/renaming/reordering locations stays at /storage.
      { path: 'storage/:locationKey', element: <TierGated page="storage"><StorageDetailPage /></TierGated> },
      { path: 'shopping-lists', element: <TierGated page="shopping_lists"><ShoppingListsPage /></TierGated> },
      // v2 user-side detail — uid implicit from auth
      { path: 'shopping-lists/:listId', element: <TierGated page="shopping_lists"><ShoppingListDetailPage /></TierGated> },
      // Legacy admin deep-link — preserve so old bookmarks/links don't break.
      // Drops the uid segment because the user-side detail only renders the
      // current user's list. (Admin cross-user view lives in Users → user detail.)
      { path: 'shopping-lists/:uid/:listId', element: <Navigate to="/shopping-lists" replace /> },
      { path: 'foodbanks', element: <TierGated page="foodbanks"><FoodbanksListPage /></TierGated> },
      { path: 'settings', element: <TierGated page="settings"><SettingsPage /></TierGated> },
      { path: 'meals', element: <SuspenseWrapper><MealsPage /></SuspenseWrapper> },
      { path: 'meals/new', element: <SuspenseWrapper><RecipeFormPage /></SuspenseWrapper> },
      { path: 'meals/:id/edit', element: <SuspenseWrapper><RecipeFormPage /></SuspenseWrapper> },
      // User manual — always accessible, no tier gating. The help content
      // is the same for free and paid users (paid features are tier-tagged
      // inside the manual itself).
      { path: 'help', element: <SuspenseWrapper><UserManualPage /></SuspenseWrapper> },

      // ── Admin-only pages ──
      {
        element: (
          <SuspenseWrapper>
            <AdminRoute>
              <Outlet />
            </AdminRoute>
          </SuspenseWrapper>
        ),
        children: [
          { path: 'products', element: <SuspenseWrapper><ProductsListPage /></SuspenseWrapper> },
          { path: 'products/new', element: <SuspenseWrapper><ProductFormPage /></SuspenseWrapper> },
          { path: 'products/:barcode/edit', element: <SuspenseWrapper><ProductFormPage /></SuspenseWrapper> },
          { path: 'users', element: <SuspenseWrapper><UsersListPage /></SuspenseWrapper> },
          { path: 'users/:uid', element: <SuspenseWrapper><UserDetailPage /></SuspenseWrapper> },
          { path: 'contributed-products', element: <SuspenseWrapper><ContributedPage /></SuspenseWrapper> },
          { path: 'needs-review', element: <SuspenseWrapper><NeedsReviewPage /></SuspenseWrapper> },
          { path: 'price-records', element: <SuspenseWrapper><PriceRecordsPage /></SuspenseWrapper> },
          { path: 'admin-settings', element: <SuspenseWrapper><AdminSettingsPage /></SuspenseWrapper> },
          { path: 'admin/catalog-analysis', element: <SuspenseWrapper><CatalogAnalysisPage /></SuspenseWrapper> },
          { path: 'admin/catalog-counters', element: <SuspenseWrapper><CatalogCountersDiagnosticPage /></SuspenseWrapper> },
          { path: 'admin/migration-dry-run', element: <SuspenseWrapper><MigrationDryRunPage /></SuspenseWrapper> },
          { path: 'admin/migration-run', element: <SuspenseWrapper><AdminMigrationPage /></SuspenseWrapper> },
          { path: 'admin/experimental', element: <SuspenseWrapper><ExperimentalPage /></SuspenseWrapper> },
          { path: 'map', element: <SuspenseWrapper><MapPage /></SuspenseWrapper> },
          { path: 'foodbanks/new', element: <SuspenseWrapper><FoodbankFormPage /></SuspenseWrapper> },
          { path: 'foodbanks/:foodbankId/edit', element: <SuspenseWrapper><FoodbankFormPage /></SuspenseWrapper> },
        ],
      },
    ],
  },
]);
