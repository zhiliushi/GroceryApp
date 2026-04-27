export const API = {
  ME: '/api/me',
  MY_INVENTORY: '/api/inventory/my',
  DASHBOARD: '/api/admin/dashboard',

  USERS: '/api/admin/users',
  USER: (uid: string) => `/api/admin/users/${uid}`,
  USER_ROLE: (uid: string) => `/api/admin/users/${uid}/role`,

  INVENTORY: '/api/admin/inventory',
  INVENTORY_ITEM: (uid: string, id: string) => `/api/admin/inventory/${uid}/${id}`,

  SHOPPING_LISTS: '/api/admin/shopping-lists',
  SHOPPING_LIST: (uid: string, id: string) => `/api/admin/shopping-lists/${uid}/${id}`,

  PRODUCTS: '/api/admin/products',
  PRODUCT: (barcode: string) => `/api/admin/products/${barcode}`,
  PRODUCT_LOOKUP: (barcode: string) => `/api/admin/products/lookup/${barcode}`,

  CONTRIBUTED: '/api/admin/contributed',
  CONTRIBUTED_COUNTS: '/api/admin/contributed/counts',
  CONTRIBUTED_APPROVE: (barcode: string) => `/api/admin/contributed/${encodeURIComponent(barcode)}/approve`,
  CONTRIBUTED_REJECT: (barcode: string) => `/api/admin/contributed/${encodeURIComponent(barcode)}/reject`,
  CONTRIBUTED_DELETE: (barcode: string) => `/api/admin/contributed/${encodeURIComponent(barcode)}`,
  CONTRIBUTED_BATCH_DELETE: '/api/admin/contributed/batch-delete',

  NEEDS_REVIEW: '/api/admin/needs-review',

  PRICE_RECORDS: '/api/admin/price-records',
  PRICE_RECORD_DELETE: (uid: string, id: string) => `/api/admin/price-records/${uid}/${id}`,
  PRICE_RECORDS_BATCH_DELETE: '/api/admin/price-records/batch-delete',

  FOODBANKS: '/api/foodbanks',
  FOODBANK: (id: string) => `/api/foodbanks/${id}`,
  FOODBANK_TOGGLE: (id: string) => `/api/foodbanks/${id}/toggle`,
  FOODBANK_REFRESH_ENTRY: (id: string) => `/api/foodbanks/${id}/refresh`,
  FOODBANK_SEED: '/api/foodbanks/seed',
  FOODBANK_REFRESH: '/api/foodbanks/refresh',
  FOODBANK_SOURCES: '/api/foodbanks/sources',
  FOODBANK_SOURCE_FETCH: (id: string) => `/api/foodbanks/sources/${id}/fetch`,
  FOODBANK_SOURCE_RESET: (id: string) => `/api/foodbanks/sources/${id}/reset`,
  FOODBANK_SOURCE_TOGGLE: (id: string) => `/api/foodbanks/sources/${id}/toggle`,

  // Smart Camera Scan
  SCAN_PRODUCT_LABEL: '/api/scan/product-label',
  SCAN_EXPIRY_DATE: '/api/scan/expiry-date',
  SCAN_SHELF_AUDIT: '/api/scan/shelf-audit',
  ITEM_OVERVIEW: (barcode: string) => `/api/barcode/item/${barcode}/overview`,

  // Meals
  MEALS_RECIPES: '/api/meals/recipes',
  MEALS_RECIPE: (id: string) => `/api/meals/recipes/${id}`,
  MEALS_SUGGESTIONS: '/api/meals/suggestions',
  MEALS_SCAN_RECIPE: '/api/meals/scan-recipe',

  // Household
  HOUSEHOLD_MY: '/api/household/my',
  HOUSEHOLD_CREATE: '/api/household/create',
  HOUSEHOLD_RENAME: '/api/household/rename',
  HOUSEHOLD_DISSOLVE: '/api/household/dissolve',
  HOUSEHOLD_LEAVE: '/api/household/leave',
  HOUSEHOLD_REMOVE: (uid: string) => `/api/household/remove/${uid}`,
  HOUSEHOLD_TRANSFER: (uid: string) => `/api/household/transfer/${uid}`,
  HOUSEHOLD_ROLE: '/api/household/role',
  HOUSEHOLD_INVITE: '/api/household/invite',
  HOUSEHOLD_REVOKE: (code: string) => `/api/household/invite/${code}/revoke`,
  HOUSEHOLD_JOIN_INFO: (code: string) => `/api/household/join/${code}`,
  HOUSEHOLD_JOIN: (code: string) => `/api/household/join/${code}`,

  // Config
  CONFIG_LOCATIONS: '/api/config/locations',
  CONFIG_LOCATIONS_ADMIN: '/api/admin/config/locations',
  CONFIG_PUBLIC: '/api/config',
  CONFIG_VISIBILITY: '/api/admin/config/visibility',
  CONFIG_TIERS: '/api/admin/config/tiers',
  EXCHANGE_RATES: '/api/exchange-rates',

  // User Management (enhanced)
  USER_TIER: (uid: string) => `/api/admin/users/${uid}/tier`,
  USER_STATUS: (uid: string) => `/api/admin/users/${uid}/status`,
  USER_APPROVE: (uid: string) => `/api/admin/users/${uid}/approve`,
  USER_DELETE: (uid: string) => `/api/admin/users/${uid}`,
  USER_TOOLS: (uid: string) => `/api/admin/users/${uid}/tools`,

  // Product Disputes
  DISPUTES_ADMIN: '/api/admin/disputes',
  DISPUTE_RESOLVE: (id: string) => `/api/admin/disputes/${id}`,
  DISPUTE_SUBMIT: '/api/barcode/dispute',
  DISPUTE_MY: (barcode: string) => `/api/barcode/dispute/${barcode}`,
  PRODUCT_RECHECK: (barcode: string) => `/api/admin/products/${barcode}/recheck`,
  BARCODE_PRICES: (barcode: string) => `/api/barcode/${barcode}/prices`,
  BARCODE_INVENTORY: (barcode: string) => `/api/barcode/${barcode}/inventory`,
  BARCODE_USE_ONE: (barcode: string) => `/api/barcode/${barcode}/use-one`,
  BARCODE_ADD_INVENTORY: (barcode: string) => `/api/barcode/${barcode}/add-to-inventory`,

  // Receipt OCR
  RECEIPT_SCAN: '/api/receipt/scan',
  RECEIPT_CONFIRM: '/api/receipt/confirm',
  RECEIPT_HISTORY: '/api/receipt/history',
  CONFIG_OCR: '/api/admin/config/ocr',
  CONFIG_OCR_REQUIREMENTS: '/api/admin/config/ocr/requirements',
  CONFIG_OCR_TEST: (provider: string) => `/api/admin/config/ocr/test/${provider}`,
  ADMIN_RECEIPT_SCANS: '/api/admin/receipt-scans',
  ADMIN_RECEIPT_ERRORS: '/api/admin/receipt-scans/errors',
  ADMIN_OCR_TEST_SCAN: '/api/admin/ocr/test-scan',
  ADMIN_OCR_PREVIEW_SCAN: '/api/admin/ocr/preview-scan',
  ADMIN_OCR_EMAIL_RESULTS: '/api/admin/ocr/email-results',

  // Map & Stores
  STORES: '/api/stores',
  ADMIN_STORES: '/api/admin/stores',
  ADMIN_STORE: (id: string) => `/api/admin/stores/${id}`,
  CONFIG_MAP: '/api/config/map',
  ADMIN_CONFIG_MAP: '/api/admin/config/map',

  // ============================================================
  // Phase 2 Refactor — new catalog + purchases + waste endpoints
  // ============================================================
  CATALOG: '/api/catalog',
  CATALOG_ENTRY: (nameNorm: string) => `/api/catalog/${encodeURIComponent(nameNorm)}`,
  CATALOG_MERGE: (nameNorm: string) => `/api/catalog/${encodeURIComponent(nameNorm)}/merge`,
  CATALOG_BARCODE_LOOKUP: (barcode: string) => `/api/catalog/lookup/barcode/${encodeURIComponent(barcode)}`,

  PURCHASES: '/api/purchases',
  PURCHASE: (id: string) => `/api/purchases/${id}`,
  PURCHASE_STATUS: (id: string) => `/api/purchases/${id}/status`,
  PURCHASE_CONSUME: '/api/purchases/consume',

  COUNTRIES: '/api/countries',
  COUNTRY_LOOKUP: (barcode: string) => `/api/countries/lookup/${encodeURIComponent(barcode)}`,

  REMINDERS: '/api/reminders',
  REMINDER: (id: string) => `/api/reminders/${id}`,
  REMINDER_DISMISS: (id: string) => `/api/reminders/${id}/dismiss`,

  WASTE_SUMMARY: '/api/waste/summary',
  WASTE_SPENDING: '/api/waste/spending',
  WASTE_HEALTH_SCORE: '/api/waste/health-score',
  WASTE_HEALTH_HISTORY: '/api/waste/health-history',
  BUSINESS_METRICS: '/api/admin/business-metrics',
  BUSINESS_METRICS_REVENUE: '/api/admin/business-metrics/revenue',
  BUSINESS_METRICS_REVENUE_DELETE: (id: string) => `/api/admin/business-metrics/revenue/${id}`,
  WASTE_FINANCIAL_SUMMARY: '/api/waste/financial-summary',

  BARCODE_SCAN_INFO: (barcode: string) => `/api/barcode/${encodeURIComponent(barcode)}/scan-info`,

  // Admin Phase 2 endpoints
  ADMIN_FEATURES: '/api/admin/features',
  ADMIN_CATALOG_ANALYSIS: '/api/admin/catalog-analysis',
  ADMIN_CATALOG_PROMOTE: '/api/admin/catalog-analysis/promote',
  ADMIN_CATALOG_FLAG_SPAM: '/api/admin/catalog-analysis/flag-spam',

  // Public subset of flags — safe for unauthenticated dashboard reads
  PUBLIC_FEATURES: '/api/features/public',

  // Federated search (GlobalSearchBar / Cmd+K)
  SEARCH: '/api/search',

  // Insights (milestone-driven)
  INSIGHTS: '/api/insights',
  INSIGHT: (id: string) => `/api/insights/${id}`,
  INSIGHT_DISMISS: (id: string) => `/api/insights/${id}/dismiss`,
} as const;
