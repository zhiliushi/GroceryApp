import {create} from 'zustand';
import type {InventoryStatus} from '../database/models/InventoryItem';

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export interface InventoryItemView {
  id: string;
  name: string;
  barcode?: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  quantity: number;
  unitId: string;
  unitAbbreviation: string;
  price?: number;
  expiryDate?: number;
  addedDate: number;
  brand?: string;
  imageUrl?: string;
  status: InventoryStatus;
  location: string;
}

// ---------------------------------------------------------------------------
// Sort & filter types
// ---------------------------------------------------------------------------

export type SortOption = 'date_added' | 'expiry_date' | 'name' | 'category';
export type FilterOption = 'all' | 'expiring_soon' | 'expired' | 'past_items';
export type ViewMode = 'list' | 'grid';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface InventoryState {
  items: InventoryItemView[];
  searchQuery: string;
  selectedCategoryId: string | null;
  sortBy: SortOption;
  filterBy: FilterOption;
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;

  setItems: (items: InventoryItemView[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (categoryId: string | null) => void;
  setSortBy: (sort: SortOption) => void;
  setFilterBy: (filter: FilterOption) => void;
  setViewMode: (mode: ViewMode) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useInventoryStore = create<InventoryState>(set => ({
  items: [],
  searchQuery: '',
  selectedCategoryId: null,
  sortBy: 'date_added',
  filterBy: 'all',
  viewMode: 'list',
  loading: false,
  error: null,

  setItems: (items) => set({items}),
  setSearchQuery: (searchQuery) => set({searchQuery}),
  setSelectedCategoryId: (selectedCategoryId) => set({selectedCategoryId}),
  setSortBy: (sortBy) => set({sortBy}),
  setFilterBy: (filterBy) => set({filterBy}),
  setViewMode: (viewMode) => set({viewMode}),
  setLoading: (loading) => set({loading}),
  setError: (error) => set({error}),
}));
