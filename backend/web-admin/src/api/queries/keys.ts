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
  household: ['household'] as const,
  locations: ['locations'] as const,
  analytics: ['analytics'] as const,
  ocr: {
    config: ['ocr', 'config'] as const,
    scans: (params?: Record<string, unknown>) => ['ocr', 'scans', params] as const,
    errors: ['ocr', 'errors'] as const,
    history: ['ocr', 'history'] as const,
  },
  // Phase 2 refactor keys
  catalog: {
    all: (params?: { q?: string; sort_by?: string }) => ['catalog', params] as const,
    detail: (nameNorm: string) => ['catalog', nameNorm] as const,
    byBarcode: (barcode: string) => ['catalog', 'barcode', barcode] as const,
  },
  purchases: {
    all: (params?: { status?: string; location?: string; catalog_name_norm?: string }) =>
      ['purchases', params] as const,
    detail: (id: string) => ['purchases', id] as const,
  },
  countries: {
    all: ['countries'] as const,
    lookup: (barcode: string) => ['countries', 'lookup', barcode] as const,
  },
  reminders: {
    all: (includeDismissed?: boolean) => ['reminders', { includeDismissed }] as const,
    detail: (id: string) => ['reminders', id] as const,
  },
  waste: {
    summary: (period: string) => ['waste', 'summary', period] as const,
    spending: (period: string) => ['waste', 'spending', period] as const,
    financial: (period: string) => ['waste', 'financial', period] as const,
    health: ['waste', 'health'] as const,
    healthHistory: (days: number) => ['waste', 'health-history', days] as const,
  },
  featureFlags: ['feature-flags'] as const,
  scanInfo: (barcode: string) => ['scan-info', barcode] as const,
  catalogAnalysis: ['catalog-analysis'] as const,
  insights: {
    all: ['insights'] as const,
    detail: (id: string) => ['insights', id] as const,
  },
  businessMetrics: {
    all: ['business-metrics'] as const,
    revenue: ['business-metrics', 'revenue'] as const,
  },
};
