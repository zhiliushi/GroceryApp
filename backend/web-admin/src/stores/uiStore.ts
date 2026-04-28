import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean; // mobile: overlay open/closed
  sidebarSecondaryOpen: boolean; // desktop: "▼ More" section expanded
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarSecondaryOpen: (open: boolean) => void;
  adminCountryFilter: string;
  setAdminCountryFilter: (country: string) => void;
  // Dismissed progressive nudges (5/10/20-item thresholds) — persisted
  dismissedNudges: string[];
  dismissNudge: (key: string) => void;
  resetNudges: () => void;
  // Global QuickAdd — mounted in AppLayout; plan: "sticky primary action"
  quickAddOpen: boolean;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  // Mobile speed-dial for the unified PrimaryActionFab (add / scan / search).
  speedDialOpen: boolean;
  openSpeedDial: () => void;
  closeSpeedDial: () => void;
  toggleSpeedDial: () => void;
  // Global scanner — PrimaryActionFab + legacy callers both flip this.
  scannerOpen: boolean;
  openScanner: () => void;
  closeScanner: () => void;
  // GlobalSearchBar (Cmd/Ctrl+K) — panel open state.
  globalSearchOpen: boolean;
  openGlobalSearch: () => void;
  closeGlobalSearch: () => void;
  // PWA install prompt — timestamp of last dismissal (epoch ms) for 30-day cooldown.
  pwaInstallDismissedAt: number | null;
  dismissPwaInstall: () => void;
  resetPwaInstallDismissal: () => void;
  // Recently edited purchase event id — set by PurchaseEventDetailPage on save,
  // consumed by MyItemsPage to scroll-to + pulse-highlight the row so users can
  // see where the item moved between groups (e.g. Active → Expiring soon).
  recentlyEditedPurchaseId: string | null;
  setRecentlyEditedPurchaseId: (id: string | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarOpen: false,
      sidebarSecondaryOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarSecondaryOpen: (open) => set({ sidebarSecondaryOpen: open }),
      adminCountryFilter: '',
      setAdminCountryFilter: (country) => set({ adminCountryFilter: country }),
      dismissedNudges: [],
      dismissNudge: (key) =>
        set((s) =>
          s.dismissedNudges.includes(key)
            ? s
            : { dismissedNudges: [...s.dismissedNudges, key] },
        ),
      resetNudges: () => set({ dismissedNudges: [] }),
      quickAddOpen: false,
      openQuickAdd: () => set({ quickAddOpen: true, speedDialOpen: false }),
      closeQuickAdd: () => set({ quickAddOpen: false }),
      speedDialOpen: false,
      openSpeedDial: () => set({ speedDialOpen: true }),
      closeSpeedDial: () => set({ speedDialOpen: false }),
      toggleSpeedDial: () => set((s) => ({ speedDialOpen: !s.speedDialOpen })),
      scannerOpen: false,
      openScanner: () => set({ scannerOpen: true, speedDialOpen: false }),
      closeScanner: () => set({ scannerOpen: false }),
      globalSearchOpen: false,
      openGlobalSearch: () => set({ globalSearchOpen: true, speedDialOpen: false }),
      closeGlobalSearch: () => set({ globalSearchOpen: false }),
      pwaInstallDismissedAt: null,
      dismissPwaInstall: () => set({ pwaInstallDismissedAt: Date.now() }),
      resetPwaInstallDismissal: () => set({ pwaInstallDismissedAt: null }),
      recentlyEditedPurchaseId: null,
      setRecentlyEditedPurchaseId: (id) => set({ recentlyEditedPurchaseId: id }),
    }),
    {
      name: 'ga-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarSecondaryOpen: s.sidebarSecondaryOpen,
        dismissedNudges: s.dismissedNudges,
        pwaInstallDismissedAt: s.pwaInstallDismissedAt,
      }),
    },
  ),
);
