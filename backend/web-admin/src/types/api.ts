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

// === Smart Camera Scan ===

export interface LabelScanResult {
  success: boolean;
  provider: string;
  fields_extracted: number;
  parsed: {
    name: string | null;
    brand: string | null;
    weight: number | null;
    weight_unit: string | null;
    expiry_date: string | null;
    barcode: string | null;
    raw_text: string;
  };
  inventory: { barcode: string; items: InventoryItem[]; total_in_stock: number } | null;
  message: string;
}

export interface ExpiryScanResult {
  success: boolean;
  date: string | null;
  raw_text: string;
  message: string;
}

export interface ShelfAuditMatch {
  text: string;
  item_id?: string;
  item_name?: string;
  item_location?: string;
  item_quantity?: number;
  item_user_id?: string;
  is_expired?: boolean;
  is_expiring?: boolean;
}

export interface ShelfAuditResult {
  success: boolean;
  results: {
    matched: ShelfAuditMatch[];
    unknown: { text: string }[];
    ignored: { text: string; reason: string }[];
    summary: { matched_count: number; unknown_count: number; ignored_count: number };
  };
  raw_text: string;
  message: string;
}

export interface UsageHistoryEntry {
  action: string;
  date: number | null;
  quantity: number | null;
  location: string | null;
  reason: string | null;
  source: string;
  member_name: string | null;
  member_icon: string | null;
  item_id: string;
  user_id: string;
}

export interface ItemOverview {
  barcode: string;
  product: Product | null;
  completeness: { score: number; missing: string[] };
  current_stock: { items: InventoryItem[]; total_in_stock: number };
  usage_history: UsageHistoryEntry[];
  waste_stats: {
    total_items: number;
    used: number;
    wasted: number;
    expired: number;
    discarded: number;
    waste_pct: number;
    avg_days_in_inventory: number | null;
    suggestion: string | null;
  } | null;
}

// === Recipes / Meals ===

export interface RecipeIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  servings: number;
  prep_time_min: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface IngredientMatch {
  name: string;
  quantity: number | null;
  unit: string | null;
  matched: boolean;
  inventory_item_id?: string;
  inventory_item_name?: string;
  inventory_quantity?: number;
  inventory_location?: string;
  inventory_user_id?: string;
  expiring?: boolean;
  expiry_text?: string | null;
}

export interface RecipeMatchResult extends Recipe {
  match_score: number;
  matched_count: number;
  total_ingredients: number;
  expiring_match_count: number;
  ingredient_matches: IngredientMatch[];
  missing_ingredients: string[];
}

export interface RecipesResponse {
  recipes: Recipe[];
  count: number;
  limit: number;
}

export interface SuggestionsResponse {
  suggestions: RecipeMatchResult[];
  count: number;
}

export interface RecipeScanResult {
  success: boolean;
  provider_used?: string;
  raw_text: string;
  parsed: {
    name: string;
    ingredients: (RecipeIngredient & { matched: boolean; inventory_item_name?: string; inventory_location?: string; inventory_quantity?: number })[];
    steps: string[];
  };
  message?: string;
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

// === OCR Test Scanner ===

export interface OcrTestBox {
  id: string;
  text: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  word_count: number;
}

export interface OcrTestScanResult {
  success: boolean;
  image_width: number;
  image_height: number;
  boxes: OcrTestBox[];
  raw_text: string;
  duration_ms: number;
  lang: string;
  error?: string;
}

export interface OcrPreviewResult {
  word_count: number;
  avg_confidence: number;
  quality: 'good' | 'fair' | 'poor' | 'empty';
  preview_text: string;
  duration_ms: number;
}

// === Map & Stores ===

export interface ManualStore {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
  opening_hours: string;
  notes: string;
  created_at?: string;
}

export interface MapConfig {
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  updated_by?: string;
  updated_at?: string;
}

export interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

// ============================================================================
// Phase 2 Refactor — new catalog + purchases + waste + reminders types
// ============================================================================

export type PurchaseStatus = 'active' | 'used' | 'thrown' | 'transferred';
export type ConsumeReason = 'used_up' | 'expired' | 'bad' | 'gift';
export type PaymentMethod = 'cash' | 'card';

export interface CatalogEntry {
  id: string;
  user_id: string;
  name_norm: string;
  display_name: string;
  aliases: string[];
  barcode: string | null;
  country_code: string | null;
  default_location: string | null;
  default_category: string | null;
  image_url: string | null;
  total_purchases: number;
  active_purchases: number;
  last_purchased_at: string | null;
  needs_review: boolean;
  created_at?: string;
  updated_at?: string;
  history?: PurchaseEvent[];
}

export interface CatalogListResponse {
  count: number;
  items: CatalogEntry[];
  next_cursor?: string | null;
}

export interface PurchaseEvent {
  id: string;
  catalog_name_norm: string;
  catalog_display: string;
  barcode: string | null;
  country_code: string | null;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;
  expiry_source: 'user' | 'nlp' | 'ocr' | 'none' | null;
  expiry_raw: string | null;
  price: number | null;
  currency: string | null;
  payment_method: PaymentMethod | null;
  date_bought: string;
  location: string | null;
  status: PurchaseStatus;
  consumed_date: string | null;
  consumed_reason: ConsumeReason | null;
  transferred_to: string | null;
  reminder_stage: number;
  last_reminded_at: string | null;
  household_id: string | null;
  source_ref: string | null;
  expiry_past?: boolean;
  created_at?: string;
  updated_at?: string;
  source?: string;
}

export interface PurchaseListResponse {
  count: number;
  items: PurchaseEvent[];
  next_cursor?: string | null;
}

// Federated search (GlobalSearchBar / Cmd+K)
export interface SearchRecipeResult {
  id: string;
  title: string;
  cuisine?: string | null;
  image_url?: string | null;
}

export interface SearchResults {
  query: string;
  catalog: CatalogEntry[];
  purchases_active: PurchaseEvent[];
  recipes: SearchRecipeResult[];
}

export interface PurchaseCreateRequest {
  name?: string;                    // one of name OR catalog_name_norm
  catalog_name_norm?: string;
  barcode?: string | null;
  quantity?: number;
  unit?: string;
  expiry_raw?: string;              // "tomorrow", "next week", ISO, "no expiry"
  expiry_date?: string;             // ISO overrides expiry_raw
  price?: number;
  currency?: string;
  payment_method?: PaymentMethod;
  date_bought?: string;
  location?: string;
}

export interface PurchaseUpdateRequest {
  quantity?: number;
  unit?: string;
  expiry_raw?: string;
  expiry_date?: string;
  price?: number;
  payment_method?: PaymentMethod;
  location?: string;
}

export interface PurchaseStatusUpdateRequest {
  status: Exclude<PurchaseStatus, 'active'>;
  reason?: ConsumeReason;
  transferred_to?: string;
}

// === Countries ===

export interface GS1PrefixRange {
  start: string;
  end: string;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  currency_symbol: string;
  gs1_prefix_ranges: GS1PrefixRange[];
  flag_emoji: string;
  locale: string;
  enabled: boolean;
}

export interface CountryListResponse {
  countries: Country[];
}

// === Reminders ===

export interface Reminder {
  id: string;
  purchase_event_id: string;
  catalog_name_norm: string;
  display_name: string;
  stage: number;                    // 7 | 14 | 21
  message: string;
  created_at: string;
  dismissed_at: string | null;
  acted_at: string | null;
  action_taken: 'used' | 'thrown' | 'snooze' | 'still_have' | null;
}

export interface ReminderListResponse {
  count: number;
  reminders: Reminder[];
}

export type ReminderDismissAction = 'used' | 'thrown' | 'still_have' | 'snooze';

export interface ReminderDismissRequest {
  action: ReminderDismissAction;
  reason?: string;
}

// === Waste + Health Score ===

export interface HealthComponents {
  active_healthy: number;
  active_expiring_7d: number;
  active_expiring_3d: number;
  active_expired: number;
  active_untracked: number;
  thrown_this_month: number;
  used_this_month: number;
}

export interface HealthScore {
  score: number;                    // 0..100
  grade: 'green' | 'yellow' | 'red';
  components: HealthComponents;
  waste_rate_month: number;         // 0..1
  computed_at: string;
}

export interface HealthHistorySnapshot {
  date: string;                     // YYYY-MM-DD
  score: number;                    // 0..100
  grade: 'green' | 'yellow' | 'red';
}

export interface HealthHistoryResponse {
  days: number;
  snapshots: HealthHistorySnapshot[];
}

export interface WasteSummaryItem {
  catalog_name_norm: string;
  display_name: string;
  count: number;
  total_value: number;
}

export interface WasteSummary {
  period: 'week' | 'month' | 'year' | 'all';
  from_date: string;
  to_date: string;
  thrown_count: number;
  thrown_value: number;
  top_wasted: WasteSummaryItem[];
}

export interface SpendingSummary {
  period: 'week' | 'month' | 'year' | 'all';
  from_date: string;
  to_date: string;
  cash_total: number;
  card_total: number;
  grand_total: number;
  untracked_count: number;
}

export interface FinancialSummaryRow {
  catalog_name_norm: string;
  display_name: string;
  total_purchases: number;
  total_spent: number;
  active_count: number;
  used_count: number;
  thrown_count: number;
  thrown_value: number;
  waste_pct: number;       // 0..1 — thrown_count / total_purchases
  waste_value_pct: number; // 0..1 — thrown_value / total_spent
}

export interface FinancialSummary {
  period: 'week' | 'month' | 'year' | 'all';
  from_date: string;
  to_date: string;
  grand_total_spent: number;
  grand_total_wasted: number;
  grand_waste_pct: number; // 0..1
  rows: FinancialSummaryRow[];
}

// === Feature Flags ===

export interface NudgeThresholds {
  expiry: number;
  price: number;
  volume: number;
}

export interface FeatureFlags {
  // OCR
  ocr_enabled: boolean;
  receipt_scan: boolean;
  smart_camera: boolean;
  recipe_ocr: boolean;
  shelf_audit: boolean;
  // Product features
  progressive_nudges: boolean;
  financial_tracking: boolean;
  insights: boolean;
  nl_expiry_parser: boolean;
  // Background jobs
  barcode_country_autodetect: boolean;
  catalog_cleanup: boolean;
  reminder_scan: boolean;
  milestone_analytics: boolean;
  // Legacy routing
  legacy_endpoints_use_new_model: boolean;
  // Thresholds
  nudge_thresholds: NudgeThresholds;
  [key: string]: boolean | NudgeThresholds | unknown;
}

export interface FeatureFlagsResponse {
  flags: FeatureFlags;
}

// === Scan-info (unified barcode scan result) ===

export interface ScanInfoUserHistory {
  count_purchased: number;
  active_stock: number;
  last_bought: string | null;
  avg_price: number | null;
  waste_rate: number;               // 0..1
  active_items: PurchaseEvent[];
}

export interface SuggestedAction {
  action: string;
  label: string;
}

export interface ScanInfo {
  barcode: string;
  country_code: string | null;
  /** True for in-store / variable-weight prefixes (02xx, 200-299) — barcode
   *  is NOT globally unique; force per-user-only naming, no OFF contribution. */
  is_in_store_label: boolean;
  user_catalog_match: CatalogEntry | null;
  global_product: Record<string, unknown> | null;
  user_history: ScanInfoUserHistory;
  suggested_actions: SuggestedAction[];
}

// === Admin Catalog Analysis ===

export interface CatalogAnalysisBarcodeToNames {
  barcode: string;
  country_code: string | null;
  user_count: number;
  consistent: boolean;              // all users agree on the name
  names: Array<{ name: string; count: number }>;
}

export interface CatalogAnalysisNoBarcodeName {
  name_norm: string;
  display_names: Array<{ name: string; count: number }>;
  user_count: number;
  total_purchases: number;
}

export interface CatalogAnalysisCleanupEntry {
  catalog_id: string;
  user_id: string;
  name_norm: string;
  display_name: string;
  last_purchased_at: string | null;
  total_purchases: number;
}

export interface CatalogAnalysis {
  barcode_to_names: CatalogAnalysisBarcodeToNames[];
  no_barcode_names: CatalogAnalysisNoBarcodeName[];
  cleanup_preview: CatalogAnalysisCleanupEntry[];
  computed_at?: string;
  schema_version?: number;
}

// === Insights (milestones) ===

export interface TopPurchasedItem {
  name: string;
  name_norm: string;
  count: number;
}

export interface WasteBreakdownItem {
  name: string;
  name_norm: string;
  count: number;
  value: number;
}

export interface AvoidListItem {
  name: string;
  name_norm: string;
  waste_rate: number;
  thrown: number;
  total: number;
}

export interface InsightSpending {
  cash: number;
  card: number;
  total: number;
}

export interface InsightShoppingFrequency {
  avg_days_between: number | null;
  peak_day: string | null;
}

export interface Insight {
  id: string;
  kind?: 'milestone' | 'tip' | 'alert';
  milestone?: number;
  total_purchases_at_trigger?: number;
  status?: 'pending_analysis' | 'ready';
  title: string;
  description?: string;
  created_at?: string;
  dismissed_at?: string | null;
  // Rich milestone content (populated when kind === 'milestone' and status === 'ready')
  top_purchased?: TopPurchasedItem[];
  waste_breakdown?: WasteBreakdownItem[];
  spending?: InsightSpending;
  shopping_frequency?: InsightShoppingFrequency;
  avoid_list?: AvoidListItem[];
}
