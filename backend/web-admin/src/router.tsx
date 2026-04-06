import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Layout
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const ProtectedRoute = lazy(() => import('@/components/layout/ProtectedRoute'));
const AdminRoute = lazy(() => import('@/components/layout/AdminRoute'));
const TierRoute = lazy(() => import('@/components/layout/TierRoute'));

// Pages
const LoginPage = lazy(() => import('@/pages/login/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const InventoryListPage = lazy(() => import('@/pages/inventory/InventoryListPage'));
const InventoryDetailPage = lazy(() => import('@/pages/inventory/InventoryDetailPage'));
const ShoppingListsPage = lazy(() => import('@/pages/shopping-lists/ShoppingListsPage'));
const ShoppingListDetailPage = lazy(() => import('@/pages/shopping-lists/ShoppingListDetailPage'));
const FoodbanksListPage = lazy(() => import('@/pages/foodbanks/FoodbanksListPage'));
const FoodbankFormPage = lazy(() => import('@/pages/foodbanks/FoodbankFormPage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const ProductsListPage = lazy(() => import('@/pages/products/ProductsListPage'));
const ProductFormPage = lazy(() => import('@/pages/products/ProductFormPage'));
const UsersListPage = lazy(() => import('@/pages/users/UsersListPage'));
const UserDetailPage = lazy(() => import('@/pages/users/UserDetailPage'));
const ContributedPage = lazy(() => import('@/pages/contributed/ContributedPage'));
const NeedsReviewPage = lazy(() => import('@/pages/needs-review/NeedsReviewPage'));
const PriceRecordsPage = lazy(() => import('@/pages/price-records/PriceRecordsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin-settings/AdminSettingsPage'));
const OcrTestScanPage = lazy(() => import('@/pages/admin-settings/OcrTestScanPage'));
const MapPage = lazy(() => import('@/pages/map/MapPage'));
const JoinPage = lazy(() => import('@/pages/join/JoinPage'));
const MealsPage = lazy(() => import('@/pages/meals/MealsPage'));
const RecipeFormPage = lazy(() => import('@/pages/meals/RecipeFormPage'));
const ItemOverviewPage = lazy(() => import('@/pages/item/ItemOverviewPage'));
const StoragePage = lazy(() => import('@/pages/storage/StoragePage'));

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
// If user's tier is below the page's minTier, shows UpgradeBanner.
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
      // Dashboard: free tier (all users)
      { path: 'dashboard', element: <TierGated page="dashboard"><DashboardPage /></TierGated> },
      // Inventory: free tier (all users see it, sections gated inside)
      { path: 'inventory', element: <TierGated page="inventory"><InventoryListPage /></TierGated> },
      { path: 'inventory/:uid/:itemId', element: <TierGated page="inventory"><InventoryDetailPage /></TierGated> },
      // Storage: all users
      { path: 'storage', element: <TierGated page="storage"><StoragePage /></TierGated> },
      // Shopping Lists: free tier
      { path: 'shopping-lists', element: <TierGated page="shopping_lists"><ShoppingListsPage /></TierGated> },
      { path: 'shopping-lists/:uid/:listId', element: <TierGated page="shopping_lists"><ShoppingListDetailPage /></TierGated> },
      // Foodbanks: always free
      { path: 'foodbanks', element: <TierGated page="foodbanks"><FoodbanksListPage /></TierGated> },
      // Analytics: plus tier (free users see UpgradeBanner)
      { path: 'analytics', element: <TierGated page="analytics"><AnalyticsPage /></TierGated> },
      // Settings: free tier
      { path: 'settings', element: <TierGated page="settings"><SettingsPage /></TierGated> },
      // Item overview: barcode-level history page
      { path: 'item/:barcode', element: <SuspenseWrapper><ItemOverviewPage /></SuspenseWrapper> },
      // Map: experimental + tier-gated
      { path: 'map', element: <TierGated page="map"><MapPage /></TierGated> },
      // Meals: free tier (waste prevention)
      { path: 'meals', element: <SuspenseWrapper><MealsPage /></SuspenseWrapper> },
      { path: 'meals/new', element: <SuspenseWrapper><RecipeFormPage /></SuspenseWrapper> },
      { path: 'meals/:id/edit', element: <SuspenseWrapper><RecipeFormPage /></SuspenseWrapper> },

      // ── Admin-only pages (role-gated, no tier check needed) ──
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
          { path: 'admin-settings/test-scan', element: <SuspenseWrapper><OcrTestScanPage /></SuspenseWrapper> },
          { path: 'foodbanks/new', element: <SuspenseWrapper><FoodbankFormPage /></SuspenseWrapper> },
          { path: 'foodbanks/:foodbankId/edit', element: <SuspenseWrapper><FoodbankFormPage /></SuspenseWrapper> },
        ],
      },
    ],
  },
]);
