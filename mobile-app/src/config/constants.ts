// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:8000' // Android emulator → host machine
  : 'https://groceryapp-backend-7af2.onrender.com';

export const API_TIMEOUT = 10_000; // 10 s

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------
export const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 min foreground
export const BG_FETCH_INTERVAL_MIN = 30; // 30 min background

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
export const DB_NAME = 'groceryapp';
export const DB_VERSION = 8;

// ---------------------------------------------------------------------------
// Cart TTL (Time To Live)
// ---------------------------------------------------------------------------
export const CART_TTL_HOURS = 24; // Cart items expire after 24 hours

// ---------------------------------------------------------------------------
// Weight units for price comparison
// ---------------------------------------------------------------------------
export const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

// ---------------------------------------------------------------------------
// Storage locations
// NOTE: These are default seed values. At runtime, use settingsStore.storageLocations.
// ---------------------------------------------------------------------------
export const STORAGE_LOCATIONS = ['fridge', 'pantry', 'freezer'] as const;
export type StorageLocation = string;
export const DEFAULT_STORAGE_LOCATION = 'fridge';

// ---------------------------------------------------------------------------
// Barcode formats accepted by the scanner
// ---------------------------------------------------------------------------
export const BARCODE_FORMATS = [
  'ean-13',
  'ean-8',
  'upc-a',
  'upc-e',
  'code-128',
  'code-39',
  'qr',
] as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
export const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Feature gating
// ---------------------------------------------------------------------------
export const FEATURES = {
  CLOUD_SYNC: 'cloud_sync',
  AI_SHOPPING_LIST: 'ai_shopping_list',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  MULTI_DEVICE: 'multi_device',
  PRICE_TRACKING: 'price_tracking',
  RECEIPT_SCANNING: 'receipt_scanning',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const PAID_FEATURES: readonly FeatureKey[] = [
  FEATURES.CLOUD_SYNC,
  FEATURES.AI_SHOPPING_LIST,
  FEATURES.ADVANCED_ANALYTICS,
  FEATURES.MULTI_DEVICE,
  FEATURES.PRICE_TRACKING,
  FEATURES.RECEIPT_SCANNING,
];

// ---------------------------------------------------------------------------
// Default categories (seeded on first launch)
// ---------------------------------------------------------------------------
export const DEFAULT_CATEGORIES = [
  {name: 'Dairy', icon: 'cheese', color: '#D4A843'},
  {name: 'Produce', icon: 'food-apple', color: '#5A9E5E'},
  {name: 'Meat', icon: 'food-steak', color: '#C45454'},
  {name: 'Bakery', icon: 'bread-slice', color: '#C4873B'},
  {name: 'Beverages', icon: 'cup-water', color: '#4A80C4'},
  {name: 'Frozen', icon: 'snowflake', color: '#4A9EA8'},
  {name: 'Snacks', icon: 'cookie', color: '#8A5A96'},
  {name: 'Household', icon: 'home', color: '#6B7D87'},
  {name: 'Other', icon: 'dots-horizontal', color: '#8A8A8A'},
] as const;
