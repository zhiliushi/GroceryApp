import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import FloatingScanButton from '@/components/barcode/FloatingScanButton';
import StickyAddButton from './StickyAddButton';
import PrimaryActionFab from './PrimaryActionFab';
import HouseholdSwitcher from './HouseholdSwitcher';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import GlobalSearchBar from '@/components/search/GlobalSearchBar';
import UpdatePrompt from '@/components/pwa/UpdatePrompt';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import CatalogCleanupBanner from '@/components/banners/CatalogCleanupBanner';
import MaintenanceBanner from '@/components/banners/MaintenanceBanner';
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
        {/* ┌─ LAYOUT SAFE-ZONE — DO NOT add per-page pl/pr/pt hacks. ────┐
            │                                                              │
            │ Floating UI lives at top of viewport on desktop:             │
            │   • GlobalSearchBar  — top-4 left-64  z-30 (left side)       │
            │   • FloatingScanBtn  — top-4 right-36 z-30 (right side)      │
            │   • StickyAddButton  — top-4 right-4  z-30 (right side)      │
            │                                                              │
            │ All three end at y≈56px (top-4 + ~40px height).              │
            │ Outlet wrapper reserves `md:pt-16` (64px) so EVERY page's    │
            │ content starts BELOW the pill row — clears LEFT and RIGHT    │
            │ at once without wasting horizontal real estate.              │
            │                                                              │
            │ Mobile: pills hidden; FAB at bottom-right replaces them.     │
            │ `pb-24 md:pb-0` keeps the last list row above the FAB.       │
            │                                                              │
            │ Banner is a SIBLING (not a child) so its amber bg spans the  │
            │ full main width. Banner has z-40 — it covers the pills in    │
            │ its overlap area, so banner's content needs no per-pill pr.  │
            │                                                              │
            │ Discipline rule + reasoning: project_context.md "Layout —    │
            │ global floating-action safe-zone".                           │
            └──────────────────────────────────────────────────────────────┘ */}
        <MaintenanceBanner />
        <CatalogCleanupBanner />
        <div className="md:pt-16 pb-24 md:pb-0 min-w-0">
          <Outlet />
        </div>
      </main>

      {/* Desktop Add pill + Scan pill (top-right). Mobile uses PrimaryActionFab below. */}
      <StickyAddButton />
      <FloatingScanButton />
      {/* MH-3a: active-household switcher pill — top-4 right-72 (between Scan
          pill at right-36 and the global content). No-op today (single
          household per user); shows real switcher rows once MH-3b lands. */}
      <HouseholdSwitcher />
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
