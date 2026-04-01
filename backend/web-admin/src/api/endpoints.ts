export const API = {
  ME: '/api/me',
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

  // Receipt OCR
  RECEIPT_SCAN: '/api/receipt/scan',
  RECEIPT_CONFIRM: '/api/receipt/confirm',
  RECEIPT_HISTORY: '/api/receipt/history',
  CONFIG_OCR: '/api/admin/config/ocr',
  CONFIG_OCR_REQUIREMENTS: '/api/admin/config/ocr/requirements',
  CONFIG_OCR_TEST: (provider: string) => `/api/admin/config/ocr/test/${provider}`,
  ADMIN_RECEIPT_SCANS: '/api/admin/receipt-scans',
  ADMIN_RECEIPT_ERRORS: '/api/admin/receipt-scans/errors',
} as const;
