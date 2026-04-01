// === Auth ===
export interface AuthUser {
  authenticated: boolean;
  uid: string;
  email: string;
  role: 'admin' | 'user';
  display_name: string;
  tier: string;
  status: string;
  selected_tools: string[];
  country: string | null;
  currency: string | null;
}

// === Dashboard ===
export interface DashboardStats {
  total_users: number;
  total_items: number;
  active_items: number;
  expired_items: number;
  needs_review_count: number;
  total_foodbanks: number;
  contributed_pending: number;
}

// === Users ===
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  tier: string;
  role: string;
  status?: string;
  approved?: boolean;
  approved_at?: number | null;
  approved_by?: string | null;
  disabled_at?: number | null;
  disabled_reason?: string | null;
  selected_tools?: string[];
  tools_locked_until?: number | null;
  tools_changed_at?: number | null;
  tier_changed_at?: number | null;
  tier_changed_by?: string | null;
  country?: string;
  currency?: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface UsersResponse {
  count: number;
  users: User[];
}

// === Inventory ===
export type ItemStatus = 'active' | 'consumed' | 'expired' | 'discarded' | 'scanned';
export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter' | 'other';

export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  categoryId: string | null;
  status: ItemStatus;
  storage_location: string | null;
  location: string | null;
  quantity: number | null;
  unit: string | null;
  unitId: string | null;
  expiryDate: number | null;
  expiry_date: number | null;
  addedDate: number | null;
  purchase_date: number | null;
  purchaseDate: number | null;
  price: number | null;
  needsReview: boolean;
  notes: string | null;
  created_at: number | null;
  updated_at: number | null;
  updatedAt: number | null;
}

export interface InventoryResponse {
  count: number;
  items: InventoryItem[];
}

export interface InventoryFilters {
  status?: string;
  location?: string;
  needs_review?: boolean;
}

// === Products ===
export interface Product {
  barcode: string;
  product_name: string | null;
  brands: string | null;
  categories: string | null;
  image_url: string | null;
  nutrition_data: Record<string, unknown> | null;
  source: string;
  cached_at: number | null;
  updated_at: number | null;
}

export interface ProductsResponse {
  count: number;
  products: Product[];
}

// === Contributed Products ===
export type ReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'needs_info';

export interface ContributedProduct {
  barcode: string;
  product_name: string | null;
  brands: string | null;
  categories: string | null;
  image_url: string | null;
  contributed_by: string | null;
  contributed_at: number | null;
  status: ReviewStatus;
  reviewed_by?: string | null;
  reviewed_at?: number | null;
  rejection_reason?: string | null;
}

export interface ContributedCounts {
  total: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

export interface ContributedResponse {
  records: ContributedProduct[];
  total: number;
  counts: ContributedCounts;
}

// === Shopping Lists ===
export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  created_at: number | null;
  createdDate: number | null;
  item_count?: number;
  isCompleted?: boolean;
}

export interface ShoppingListItem {
  id: string;
  itemName: string;
  quantity: number | null;
  unitId: string | null;
  categoryId: string | null;
  isPurchased: boolean;
  barcode: string | null;
  brand: string | null;
  price: number | null;
  notes: string | null;
}

export interface ShoppingListsResponse {
  count: number;
  lists: ShoppingList[];
}

export interface ShoppingListDetailResponse {
  list: ShoppingList;
  items: ShoppingListItem[];
}

// === Price Records ===
export interface PriceRecord {
  id: string;
  user_id: string;
  barcode: string;
  product_name: string | null;
  price: number | null;
  store_name: string | null;
  location_address: string | null;
  created_at: number | null;
}

export interface PriceRecordsResponse {
  count: number;
  total: number;
  records: PriceRecord[];
}

// === Foodbanks ===
export interface Foodbank {
  id: string;
  name: string;
  description: string | null;
  country: string;
  state: string | null;
  location_name: string | null;
  location_address: string | null;
  location_link: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
  source_name: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
  last_refreshed: number | null;
}

export interface FoodbanksResponse {
  count: number;
  foodbanks: Foodbank[];
}

export interface FoodbankSource {
  id: string;
  name: string;
  url: string;
  country: string;
  status: 'healthy' | 'cooldown' | 'disabled';
  last_success: number | null;
  last_error: number | null;
  error_message: string | null;
  cooldown_until: number | null;
  cooldown_hours: number;
}

export interface FoodbankSourcesResponse {
  count: number;
  sources: FoodbankSource[];
}

// === Generic ===
export interface MutationResponse {
  success: boolean;
  message?: string;
}

export interface BatchDeleteResponse {
  success: boolean;
  deleted: number;
}

// === App Config (Visibility + Tiers) ===

export type TierKey = 'free' | 'plus' | 'pro';
export type TierOrAdmin = TierKey | 'admin';

export interface SectionVisibility {
  enabled: boolean;
  minTier: TierOrAdmin;
}

export interface PageVisibility {
  enabled: boolean;
  minTier: TierOrAdmin;
  alwaysFree?: boolean;
  sections: Record<string, SectionVisibility>;
}

export interface VisibilityConfig {
  pages: Record<string, PageVisibility>;
  updated_at: number | null;
  updated_by: string | null;
}

export interface TierLimits {
  max_items: number;
  max_lists: number;
  data_retention_days: number;
  max_scans_per_day: number;
}

export interface TierDefinition {
  key: string;
  name: string;
  price: number;
  currency: string;
  billing: string | null;
  limits: TierLimits;
  features: string[];
  selectable_tools: number;
  tool_menu?: string[];
  description: string;
}

export interface AddonDefinition {
  name: string;
  price: number | null;
  features: string[];
  note?: string;
}

export interface TiersConfig {
  tiers: Record<string, TierDefinition>;
  always_free: string[];
  admin_only: string[];
  separate_addons: Record<string, AddonDefinition>;
  updated_at: number | null;
}

export interface PublicConfig {
  visibility: VisibilityConfig;
  tiers: TiersConfig;
}

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  updated_at: number | null;
  source: string;
}

// === Product Disputes ===

export interface ProductDispute {
  id: string;
  barcode: string;
  type: 'wrong_name' | 'wrong_brand' | 'wrong_category' | 'other';
  current_value: string;
  suggested_value: string;
  notes: string;
  submitted_by: string;
  submitted_at: string;
  updated_at: string;
  status: 'pending' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

export interface PriceByLocation {
  store_name: string;
  store_id: string;
  latest_price: number;
  average_price: number;
  record_count: number;
  last_recorded: string | null;
}

export interface PriceSummary {
  barcode: string;
  total_records: number;
  locations: PriceByLocation[];
  cheapest: { price: number; store_name: string; date: string | null } | null;
  most_expensive: { price: number; store_name: string; date: string | null } | null;
  average_price: number | null;
}

// === Household ===

export interface HouseholdMember {
  uid: string;
  role: 'owner' | 'member';
  default_role: string;
  display_role: string;
  role_icon: string;
  role_color: string;
  display_name: string;
  joined_at: string;
  frozen: boolean;
}

export interface Household {
  id: string;
  name: string;
  owner_uid: string;
  tier: string;
  max_members: number;
  members: HouseholdMember[];
  created_at: string;
  updated_at: string;
}

export interface FamilyRole {
  key: string;
  name: string;
  icon: string;
  color: string;
}

export interface Invitation {
  code: string;
  household_id: string;
  household_name: string;
  invited_by: string;
  invited_email: string | null;
  assigned_role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  link?: string;
}

export interface HouseholdResponse {
  household: Household | null;
  available_roles: FamilyRole[];
  pending_invites: Invitation[];
}

// === Storage Locations ===

export interface LocationItem {
  key: string;
  name: string;
  icon: string;
  color: string;
  sort: number;
}

export interface LocationsResponse {
  locations: LocationItem[];
}

// === Barcode ===

export interface BarcodeProduct {
  barcode: string;
  product_name: string | null;
  brands: string | null;
  categories: string | null;
  image_url: string | null;
  nutrition_data: Record<string, unknown> | null;
  found: boolean;
  source: 'firebase' | 'contributed' | 'openfoodfacts' | 'not_found';
}

export interface BarcodeContributeRequest {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  image_url?: string;
  contributed_by?: string;
}

// === Receipt OCR ===

export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  barcode: string | null;
  confidence: number;
  brand: string | null;
  image_url: string | null;
  barcode_source: string | null;  // "firebase" | "contributed" | "openfoodfacts" | null
}

export interface ReceiptStore {
  name: string | null;
  address: string | null;
}

export interface ProviderAttempt {
  provider: string;
  status: 'success' | 'error' | 'skipped';
  duration_ms: number;
  items_found: number;
  confidence: number;
  error_type: string | null;
  error_message: string | null;
}

export interface ReceiptScanResult {
  success: boolean;
  scan_id: string;
  provider_used: string | null;
  confidence: number;
  store: ReceiptStore;
  items: ReceiptItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  date: string | null;
  currency: string | null;
  raw_text: string;
  attempts: ProviderAttempt[];
  error: string | null;
}

export interface ReceiptConfirmRequest {
  scan_id: string;
  store_name: string | null;
  store_address: string | null;
  date: string | null;
  destination: 'inventory' | 'shopping_list' | 'price_only';
  list_id?: string;
  items: {
    name: string;
    price: number;
    quantity: number;
    barcode: string | null;
    location: string;
  }[];
  total: number | null;
}

export interface ReceiptConfirmResponse {
  success: boolean;
  message: string;
  items_added: number;
  destination: string;
}

export interface OcrProviderConfig {
  key: string;
  name: string;
  enabled: boolean;
  priority: number;
  monthly_limit: number;
  api_key_set: boolean | null;
  usage_count: number;
  usage_errors: number;
  last_used: string | null;
}

export interface OcrConfig {
  enabled: boolean;
  providers: OcrProviderConfig[];
  updated_at: string | null;
  updated_by: string | null;
}

export interface ScanLogEntry {
  scan_id: string;
  user_id: string;
  created_at: string;
  status: string;
  final_provider: string | null;
  items_detected: number;
  confirmed: boolean;
  store_name: string | null;
  total_confirmed: number | null;
  destination: string | null;
  attempts: ProviderAttempt[];
}

export interface ScanStats {
  month: string;
  total_scans: number;
  confirmed: number;
  failed: number;
}

// === OCR Provider Requirements ===

export interface RequirementCheck {
  check: string;
  label: string;
  ok: boolean | null;  // null = unknown (needs test to verify)
  fix: string | null;
}

export interface ProviderRequirements {
  name: string;
  ready: boolean;
  checks: RequirementCheck[];
  setup_url: string;
  free_tier: string;
  setup_steps: string[];
}

export interface OcrRequirements {
  google_vision: ProviderRequirements;
  mindee: ProviderRequirements;
  tesseract: ProviderRequirements;
}

export interface ProviderTestResult {
  success: boolean;
  provider: string;
  duration_ms: number;
  items_found?: number;
  raw_text_preview?: string;
  confidence?: number;
  error_type?: string;
  error_message?: string;
  message: string;
}
