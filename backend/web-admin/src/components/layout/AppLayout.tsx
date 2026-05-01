import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import FloatingScanButton from '@/components/barcode/FloatingScanButton';
import StickyAddButton from './StickyAddButton';
import PrimaryActionFab from './PrimaryActionFab';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import GlobalSearchBar from '@/components/search/GlobalSearchBar';
import UpdatePrompt from '@/components/pwa/UpdatePrompt';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import CatalogCleanupBanner from '@/components/banners/CatalogCleanupBanner';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

export default function AppLayout() {
  const { sidebarCollapsed, setSidebarOpen, quickAddOpen, closeQuickAdd } = useUiStore();

  return (
    <div className="min-h-screen bg-ga-bg-primary">
      <Sidebar />

      {/* Mobile top bar with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-ga-bg-sidebar flex items-center px-4 z-20">
        <button onClick={() => setSidebarOpen(true)} className="text-xl mr-3 text-white">☰</button>
        <span className="font-bold text-white text-sm">GroceryApp</span>
      </div>

      <main
        className={cn(
          'transition-all duration-200 min-h-screen',
          // Desktop: offset by sidebar width
          sidebarCollapsed ? 'md:ml-[60px]' : 'md:ml-60',
          // Mobile: no sidebar margin, top padding for mobile header
          'ml-0 pt-12 md:pt-0',
        )}
      >
        {/* Banner is sibling of the page-content wrapper so its background
            spans the full main area; banner content has its own pr for
            clearance. Page content gets `md:pr-[260px]` to clear the fixed
            top-right Add/Scan pills (z-30) on desktop, plus `pb-24 md:pb-0`
            so mobile FAB at bottom-right doesn't cover the last list row. */}
        <CatalogCleanupBanner />
        <div className="md:pr-[260px] pb-24 md:pb-0 min-w-0">
          <Outlet />
        </div>
      </main>

      {/* Desktop Add pill + Scan pill (top-right). Mobile uses PrimaryActionFab below. */}
      <StickyAddButton />
      <FloatingScanButton />
      <QuickAddModal open={quickAddOpen} onClose={closeQuickAdd} />

      {/* Mobile-only speed-dial FAB — consolidates Add + Scan into one thumb-zone control. */}
      <PrimaryActionFab />

      {/* Cmd/Ctrl+K federated search — mounted globally, collapsed by default. */}
      <GlobalSearchBar />

      {/* PWA: service-worker update toast + mobile "Install" banner. */}
      <UpdatePrompt />
      <InstallPrompt />
    </div>
  );
}
