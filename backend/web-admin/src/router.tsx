import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Layout
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const ProtectedRoute = lazy(() => import('@/components/layout/ProtectedRoute'));
const AdminRoute = lazy(() => import('@/components/layout/AdminRoute'));

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
    element: (
      <SuspenseWrapper>
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      </SuspenseWrapper>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper> },
      { path: 'inventory', element: <SuspenseWrapper><InventoryListPage /></SuspenseWrapper> },
      { path: 'inventory/:uid/:itemId', element: <SuspenseWrapper><InventoryDetailPage /></SuspenseWrapper> },
      { path: 'shopping-lists', element: <SuspenseWrapper><ShoppingListsPage /></SuspenseWrapper> },
      { path: 'shopping-lists/:uid/:listId', element: <SuspenseWrapper><ShoppingListDetailPage /></SuspenseWrapper> },
      { path: 'foodbanks', element: <SuspenseWrapper><FoodbanksListPage /></SuspenseWrapper> },
      { path: 'analytics', element: <SuspenseWrapper><AnalyticsPage /></SuspenseWrapper> },
      { path: 'settings', element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper> },
      // Admin-only routes
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
          { path: 'foodbanks/new', element: <SuspenseWrapper><FoodbankFormPage /></SuspenseWrapper> },
          { path: 'foodbanks/:foodbankId/edit', element: <SuspenseWrapper><FoodbankFormPage /></SuspenseWrapper> },
        ],
      },
    ],
  },
]);
