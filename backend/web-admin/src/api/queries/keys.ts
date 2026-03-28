import type { InventoryFilters } from '@/types/api';

export const qk = {
  dashboard: ['dashboard'] as const,
  me: ['me'] as const,
  users: {
    all: ['users'] as const,
    detail: (uid: string) => ['users', uid] as const,
  },
  inventory: {
    all: (filters?: InventoryFilters) => ['inventory', filters] as const,
    detail: (uid: string, id: string) => ['inventory', uid, id] as const,
  },
  products: {
    all: (search?: string) => ['products', { search }] as const,
    detail: (barcode: string) => ['products', barcode] as const,
  },
  contributed: {
    all: (params: { search?: string; status?: string; page?: number }) =>
      ['contributed', params] as const,
  },
  needsReview: ['needs-review'] as const,
  shoppingLists: {
    all: ['shopping-lists'] as const,
    detail: (uid: string, id: string) => ['shopping-lists', uid, id] as const,
  },
  priceRecords: {
    all: (params: { search?: string; page?: number }) =>
      ['price-records', params] as const,
  },
  foodbanks: {
    all: (country?: string) => ['foodbanks', { country }] as const,
    detail: (id: string) => ['foodbanks', id] as const,
    sources: ['foodbank-sources'] as const,
  },
  analytics: ['analytics'] as const,
};
