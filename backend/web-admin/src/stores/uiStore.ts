import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean; // mobile: overlay open/closed
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  adminCountryFilter: string;
  setAdminCountryFilter: (country: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  adminCountryFilter: '',
  setAdminCountryFilter: (country) => set({ adminCountryFilter: country }),
}));
