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

  // v2 user-side shopping lists (uid implicit from auth — never in URL)
  MY_SHOPPING_LISTS: '/api/shopping-lists',
  MY_SHOPPING_LIST: (id: string) => `/api/shopping-lists/${id}`,
  MY_SHOPPING_LIST_ITEMS: (listId: string) => `/api/shopping-lists/${listId}/items`,
  MY_SHOPPING_LIST_ITEM: (listId: string, itemId: string) =>
    `/api/shopping-lists/${listId}/items/${itemId}`,
  MY_SHOPPING_LIST_ITEM_PRICES: (listId: string, itemId: string) =>
    `/api/shopping-lists/${listId}/items/${itemId}/prices`,
  MY_SHOPPING_LIST_ITEM_PRICE: (listId: string, itemId: string, priceId: string) =>
    `/api/shopping-lists/${listId}/items/${itemId}/prices/${priceId}`,
  // v3 tick + checkout + promote
  MY_SHOPPING_LIST_ITEM_PRICE_TICK: (listId: string, itemId: string, priceId: string) =>
    `/api/shopping-lists/${listId}/items/${itemId}/prices/${priceId}/tick`,
  MY_SHOPPING_LIST_ITEM_PROMOTE: (listId: string, itemId: string) =>
    `/api/shopping-lists/${listId}/items/${itemId}/promote-to-alternative`,
  MY_SHOPPING_LIST_CHECKOUT: (listId: string) =>
    `/api/shopping-lists/${listId}/checkout`,
  // v3 user grocery preferences (default storage + analytics opt-in)
  MY_GROCERY_PREFERENCES: '/api/me/grocery-preferences',
  // Feedback (cap-hit auto-prompt + general feedback form + RPi-ready)
  FEEDBACK: '/api/feedback',
  ADMIN_FEEDBACK: '/api/admin/feedback',
  ADMIN_FEEDBACK_ITEM: (id: string) => `/api/admin/feedback/${id}`,

  // External links (donation / reference / social) surfaced on AboutPage
  EXTERNAL_LINKS: '/api/external-links',
  ADMIN_EXTERNAL_LINKS: '/api/admin/external-links',
  ADMIN_EXTERNAL_LINK: (id: string) => `/api/admin/external-links/${id}`,
  ADMIN_EXTERNAL_LINKS_SEED: '/api/admin/external-links/seed-defaults',

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
  MEALS_RECIPE_COST: (id: string) => `/api/meals/recipes/${id}/cost`,
  MEALS_SUGGESTIONS: '/api/meals/suggestions',
  MEALS_SCAN_RECIPE: '/api/meals/scan-recipe',
  MEALS_RECIPE_REVISIONS: (id: string) => `/api/meals/recipes/${id}/revisions`,
  MEALS_RECIPE_REVISION_RESTORE: (id: string, revId: string) =>
    `/api/meals/recipes/${id}/revisions/${revId}/restore`,
  MEALS_INGREDIENT_STAR: (rid: string, idx: number) =>
    `/api/meals/recipes/${rid}/ingredients/${idx}/star`,
  MEALS_INGREDIENT_PIN: (rid: string, idx: number) =>
    `/api/meals/recipes/${rid}/ingredients/${idx}/pin`,
  MEALS_INGREDIENT_COMMENT: (rid: string, idx: number) =>
    `/api/meals/recipes/${rid}/ingredients/${idx}/comment`,
  MEALS_INGREDIENT_COMMENT_ITEM: (rid: string, idx: number, cid: string) =>
    `/api/meals/recipes/${rid}/ingredients/${idx}/comment/${cid}`,
  MEALS_COMMON_INGREDIENTS: '/api/meals/common-ingredients',

  // Preppers (beta — niche tier)
  PREPPERS_COMMON_PRESERVES: '/api/preppers/common-preserves',
  PREPPERS_RECIPES: '/api/preppers/recipes',
  PREPPERS_RECIPE: (rid: string) => `/api/preppers/recipes/${rid}`,
  PREPPERS_BATCHES: '/api/preppers/batches',
  PREPPERS_BATCH: (bid: string) => `/api/preppers/batches/${bid}`,
  PREPPERS_BATCH_STATUS: (bid: string) => `/api/preppers/batches/${bid}/status`,
  PREPPERS_ELIGIBILITY: '/api/preppers/eligibility',
  PREPPERS_HOUSEHOLD: '/api/preppers/household',
  PREPPERS_SUPPLY_ESTIMATE: '/api/preppers/supply-estimate',
  PREPPERS_RECOMMENDATIONS: '/api/preppers/recommendations',

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
  USER_HOMEMAKER: (uid: string) => `/api/admin/users/${uid}/homemaker`,
  USER_PREPPERS: (uid: string) => `/api/admin/users/${uid}/preppers`,

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
  PURCHASE_MOVE: (id: string) => `/api/purchases/${id}/move`,
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
  WASTE_FINANCIAL_SUMMARY: '/api/waste/financial-summary',

  BARCODE_SCAN_INFO: (barcode: string) => `/api/barcode/${encodeURIComponent(barcode)}/scan-info`,

  // Admin Phase 2 endpoints
  ADMIN_FEATURES: '/api/admin/features',
  ADMIN_CATALOG_ANALYSIS: '/api/admin/catalog-analysis',
  ADMIN_CATALOG_PROMOTE: '/api/admin/catalog-analysis/promote',
  ADMIN_CATALOG_FLAG_SPAM: '/api/admin/catalog-analysis/flag-spam',

  // Catalog evolution Phase F — counter diagnostic
  ADMIN_DIAGNOSTIC_CATALOG_COUNTERS: '/api/admin/diagnostic/catalog-counters',

  // Catalog evolution Phase 0 — migration v2 dry-run (read-only)
  ADMIN_MIGRATION_DRY_RUN_V2: '/api/admin/migration/dry-run-v2',

  // Catalog evolution Phase A — migration v2 run + audit log
  ADMIN_MIGRATION_RUN_V2: '/api/admin/migration/run-v2',
  ADMIN_MIGRATION_AUDIT_LOG: '/api/admin/migration/audit-log',
  ADMIN_MIGRATION_AUDIT_LOG_DETAIL: (runId: string) =>
    `/api/admin/migration/audit-log/${encodeURIComponent(runId)}`,

  // Catalog evolution post-deploy: restore a terminal-status event
  PURCHASE_RESTORE: (id: string) => `/api/purchases/${encodeURIComponent(id)}/restore`,
  ADMIN_PURCHASES_RESTORE_RECENT: '/api/admin/purchases/restore-recent',

  // Catalog evolution Phase B — pricing + currency + multi-pack
  PURCHASES_MULTI_PACK: '/api/purchases/multi-pack',
  ME_CURRENCY_PREFERENCE: '/api/me/currency-preference',
  ADMIN_FX_RATES: '/api/admin/fx-rates',
  ADMIN_FX_RATES_LOOKUP: '/api/admin/fx-rates/lookup',

  // Catalog evolution Phase C — quota + idle TTL + cascade
  ME_QUOTA: '/api/me/quota',
  ADMIN_IDLE_CLOCK_EXPIRED: '/api/admin/idle-clock/expired',
  ADMIN_IDLE_CLOCK_CASCADE: '/api/admin/idle-clock/cascade',
  ADMIN_IDLE_CLOCK_AUDIT_LOG: '/api/admin/idle-clock/audit-log',

  // Catalog evolution Phase D — store catalog
  STORES_LIST: '/api/stores',
  STORES_SEARCH: '/api/stores/search',
  STORES_QUOTA: '/api/stores/quota',
  STORE_DETAIL: (storeId: string) => `/api/stores/${encodeURIComponent(storeId)}`,

  // Catalog evolution Phase E — catalog overview
  CATALOG_OVERVIEW: (nameNorm: string) =>
    `/api/catalog/${encodeURIComponent(nameNorm)}/overview`,

  // Catalog evolution Phase G — similarity + transfer
  CATALOG_SIMILAR: '/api/catalog/_/similar',
  CATALOG_DUPLICATES: '/api/catalog/_/duplicates',
  CATALOG_TRANSFER_PREVIEW: '/api/catalog/_/transfer/preview',
  CATALOG_TRANSFER_EXECUTE: '/api/catalog/_/transfer/execute',
  CATALOG_TRANSFER_REVERSE: (transferId: string) =>
    `/api/catalog/_/transfer/${encodeURIComponent(transferId)}/reverse`,
  CATALOG_TRANSFER_LOG: '/api/catalog/_/transfer/log',

  // Public subset of flags — safe for unauthenticated dashboard reads
  PUBLIC_FEATURES: '/api/features/public',

  // Federated search (GlobalSearchBar / Cmd+K)
  SEARCH: '/api/search',

  // Insights (milestone-driven)
  INSIGHTS: '/api/insights',
  INSIGHT: (id: string) => `/api/insights/${id}`,
  INSIGHT_DISMISS: (id: string) => `/api/insights/${id}/dismiss`,
} as const;
