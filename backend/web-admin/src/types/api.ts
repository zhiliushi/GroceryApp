// === Auth ===

/** Onboarding v2 state machine (PLAN_ONBOARDING_V2.md). Source of truth for
 *  AuthGate routing decisions. Legacy fields (tier, status, etc.) preserved
 *  on the same response for backward compatibility — old code that reads
 *  status="active"/"pending" still works. */
export type AuthState =
  | 'unauthenticated'
  | 'verify_email_required'
  | 'pending_approval'
  | 'registration_required'
  | 'disabled'
  | 'registration_closed'
  | 'active';

export interface AuthUser {
  authenticated: boolean;
  /** Onboarding v2 routing field. Defaults to 'active' for older backends that
   *  don't return it (post-Phase-2 it's always present). */
  state?: AuthState;
  uid: string;
  email: string;
  role: 'admin' | 'user';
  display_name: string;
  tier: string;
  status: string;
  selected_tools: string[];
  country: string | null;
  currency: string | null;
  /** Phase B (catalog_evolution.md §5): display-currency target. Distinct from
   *  `currency` which is the legacy locale field. */
  currency_preference?: string;
  schema_version?: number;
  /** Per-user homemaker subscription gate. Combine with the global
   *  `homemaker_versioning` / `homemaker_social` feature flags via the
   *  `useHomemaker()` hook to resolve sub-feature access. */
  homemaker_enabled?: boolean;
  /** Per-user preppers subscription gate. Combine with the global
   *  `preppers_enabled` feature flag via `usePreppers()`. Defaults TRUE
   *  during beta. */
  preppers_enabled?: boolean;

  // ── Onboarding v2 additions ───────────────────────────────────────
  /** True once user has filled the registration form (name+country+currency). */
  registration_complete?: boolean;
  /** When registration_required: the household name they're about to join, if invited. */
  invitation_household_name?: string;
  /** When registration_required: the invitation code to be auto-accepted on submit. */
  invitation_code_used?: string | null;
  /** When pending_approval: epoch-ms timestamp of when they hit the queue. */
  pending_since?: number;
  /** When disabled: the admin-set reason. */
  disabled_reason?: string;
  /** When registration_closed: the human-readable cap/closure reason. */
  reason?: string;

  // ── System-wide config exposed via /api/me (always present post-Phase-2) ──
  /** Public web URL for invitation links. Empty string until admin configures it. */
  web_public_url?: string;
  /** When true, write endpoints return 503 for non-admin users; banner shows site-wide. */
  maintenance_mode?: boolean;
  /** Banner copy when maintenance_mode is true. */
  maintenance_message?: string;
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
  // Homemaker subscription gate (per-user side). The full access check
  // also requires the corresponding global feature flag (homemaker_versioning,
  // homemaker_social) to be ON. See useHomemaker() hook on the frontend
  // and `is_homemaker_enabled` on the backend.
  homemaker_enabled?: boolean;
  homemaker_changed_at?: number | null;
  homemaker_changed_by?: string | null;
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
// v1 (legacy mobile) shape preserved for the admin cross-user view.
// v2 user-side adds: weight/volume pair, prices array, added_at, source.
// Frontend code reads BOTH shapes — fall back across casing variants.
export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  /** Free-form notes for this trip / list. Plus-tier feature (`trip_notes`). */
  notes?: string | null;
  // v2 uses snake_case; v1 docs sometimes only have createdDate
  created_at?: string | number | null;
  updated_at?: string | null;
  createdDate?: number | null;
  item_count?: number;
  isCompleted?: boolean;
  schema_version?: number;
}

export interface ShoppingListPrice {
  id: string;
  /** v3: optional. Alternative may be a candidate sketch with no price yet. */
  price?: number | null;
  currency: string;
  brand?: string | null;
  store_name?: string | null;
  barcode?: string | null;
  added_at: string;
  /** v3: alternative product fields. */
  candidate_name?: string | null;
  pack_count?: number | null;
  pack_size?: number | null;
  weight_value?: number | null;
  weight_unit?: string | null;
  volume_value?: number | null;
  volume_unit?: string | null;
  source_catalog_name_norm?: string | null;
  /** v3 tick state — checkout = the subset where ticked=true. */
  ticked?: boolean;
  ticked_at?: string | null;
  /** True when this alt was created via the "Use as alternative" helper. */
  auto_promoted?: boolean;
}

export interface ShoppingListItem {
  id: string;
  // v2 (snake_case) fields
  item_name?: string;
  name_norm?: string;
  quantity?: number | null;
  unit?: string | null;
  weight_value?: number | null;
  weight_unit?: string | null;
  volume_value?: number | null;
  volume_unit?: string | null;
  notes?: string | null;
  barcode?: string | null;
  source_catalog_name_norm?: string | null;
  prices?: ShoppingListPrice[];
  added_at?: string;
  source?: string;
  schema_version?: number;
  // v1 (legacy mobile camelCase) — kept so the admin cross-user view
  // can render legacy docs without rewriting them.
  itemName?: string;
  unitId?: string | null;
  categoryId?: string | null;
  isPurchased?: boolean;
  brand?: string | null;
  price?: number | null;
}

export interface ShoppingListsResponse {
  count: number;
  lists: ShoppingList[];
}

export interface ShoppingListDetailResponse {
  list: ShoppingList;
  items: ShoppingListItem[];
}

export interface AddShoppingListItemPayload {
  item_name: string;
  quantity?: number;
  unit?: string;
  weight_value?: number;
  weight_unit?: string;
  volume_value?: number;
  volume_unit?: string;
  notes?: string;
  barcode?: string;
  source_catalog_name_norm?: string;
  source?: 'manual' | 'catalog' | 'scan' | 'cross_page' | 'receipt';
}

export interface AddShoppingListPricePayload {
  /** v3: optional — user can list a candidate without a price; the no-price
   *  tag in UI flags missing data. */
  price?: number;
  currency?: string;
  brand?: string;
  store_name?: string;
  barcode?: string;
  candidate_name?: string;
  pack_count?: number;
  pack_size?: number;
  weight_value?: number;
  weight_unit?: string;
  volume_value?: number;
  volume_unit?: string;
  source_catalog_name_norm?: string;
}

/** v3 checkout commit payload. */
export interface CheckoutPayload {
  store_id?: string;
  date?: string;
  default_location?: string;
}

/** v3 checkout response. */
export interface CheckoutResult {
  trip_id: string;
  date: string;
  default_location: string | null;
  purchases_created: { id: string; name: string }[];
  items_removed: string[];
  total_purchases: number;
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

export interface RecipeIngredientComment {
  id: string;
  by_uid: string;
  by_name: string;
  text: string;
  created_at: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  /** Phase-0 auto-match (write-time). Set when an ingredient name resolved
   *  to the user's `catalog_entries` (point-in-time link). */
  catalog_name_norm?: string;
  /** Phase-0 auto-match. Set when the name resolved to the curated
   *  global `common_ingredients` collection. */
  common_name_norm?: string;
  /** Phase-0 auto-match — origin tag for debugging / UI hints. */
  match_source?: 'user_catalog' | 'user_catalog_fuzzy' | 'common' | 'common_fuzzy' | 'free_text';
  /** H3 social layer (homemaker.social). Uids who starred this ingredient. */
  stars?: string[];
  /** H3 social layer. Append-only thread of comments. */
  comments?: RecipeIngredientComment[];
  /** H3 social layer. Uid of pinner; absent = unpinned. */
  pin_by?: string;
  pin_at?: string;
}

export interface RecipeRevision {
  id: string;
  snapshot_ingredients: RecipeIngredient[];
  /** H4 — captured by `recipe_finance_service.estimate_recipe_cost` at
   *  revision-time. Null when finance lookup failed (non-fatal) or when
   *  the revision predates the H4 wiring. Shape mirrors `RecipeCostEstimate`. */
  snapshot_finance: null | RecipeCostEstimate;
  edited_at: string;
  edited_by: string;
  note: string | null;
}

export interface RevisionsListResponse {
  revisions: RecipeRevision[];
}

/**
 * A single curated common-ingredient entry (e.g. "egg", "santan", "kicap manis").
 * The full list is ~134 entries; the type-ahead loads it once per session.
 */
export interface CommonIngredient {
  name_norm: string;
  display_name: string;
  default_category?: string;
  aliases?: string[];
}

export interface CommonIngredientsResponse {
  items: CommonIngredient[];
  count: number;
}

// ── Preppers feature ───────────────────────────────────────────────────────

/**
 * Preservation type. Drives how the UI groups + filters batches and
 * what defaults the batch form pre-fills.
 */
export type PrepType =
  | 'ferment'   // kimchi, sauerkraut, kombucha, miso, tempeh
  | 'cure'      // bacon, gravlax, salt-cured fish
  | 'freeze'    // batch-cooked stews, freezer meals
  | 'can'       // canned tomatoes, pressure-canned beans
  | 'dry'       // dried herbs, jerky, sun-dried tomatoes
  | 'pickle'    // quick-pickle in vinegar
  | 'jam'       // jam, marmalade, kaya, sambal
  | 'infuse';   // infused oils, vinegars

export type PrepBatchStatus = 'active' | 'consumed' | 'discarded';

/**
 * Curated preserve template (cross-user, read-only for clients). Mirrors
 * the common-ingredients pattern; ~25-30 entries covering Malaysian and
 * global preserves with sensible default ready-after / shelf-life values.
 */
export interface CommonPreserve {
  name_norm: string;
  display_name: string;
  prep_type: PrepType;
  default_ready_after_hours: number;
  default_shelf_life_days: number;
  description?: string;
  ingredients?: string[];
}

export interface CommonPreservesResponse {
  items: CommonPreserve[];
  count: number;
}

/**
 * User-saved preservation template. Distinct from a cooking recipe; spawns
 * batches via the start-batch flow. Soft-capped at 50 per user for first
 * cut.
 */
export interface PrepRecipe {
  id: string;
  name: string;
  prep_type: PrepType;
  ready_after_hours: number;
  shelf_life_days: number;
  /** Estimated servings the batch yields. Powers the supply-estimate. */
  servings: number;
  ingredients: Array<{ name: string; quantity?: number | null; unit?: string | null }>;
  notes: string;
  /** name_norm of the common-preserve this was cloned from, if any. */
  common_preserve_ref?: string | null;
}

export interface PrepRecipesResponse {
  recipes: PrepRecipe[];
  count: number;
  limit: number;
}

/**
 * Active or completed preservation instance. `started_at` / `ready_at` /
 * `expires_at` are ISO-8601 strings; the UI computes countdowns
 * client-side.
 */
export interface PrepBatch {
  id: string;
  name: string;
  prep_type: PrepType;
  ready_after_hours: number;
  shelf_life_days: number;
  /** Estimated servings the batch yields. Powers the supply-estimate. */
  servings: number;
  started_at: string;
  ready_at: string;
  expires_at: string;
  status: PrepBatchStatus;
  consumed_at: string | null;
  discarded_at: string | null;
  recipe_id?: string | null;
  common_preserve_ref?: string | null;
  ingredients_snapshot: Array<{ name: string; quantity?: number | null; unit?: string | null }>;
  notes: string;
}

export interface PrepBatchesResponse {
  batches: PrepBatch[];
  count: number;
}

/**
 * Household composition used by the preppers supply estimate. Per-person
 * daily servings are configurable; defaults are 3.0 / 2.5 / 2.5.
 */
export interface PrepHousehold {
  adults: number;
  youth: number;
  elderly: number;
  servings_per_adult: number;
  servings_per_youth: number;
  servings_per_elderly: number;
  updated_at?: number | null;
}

/**
 * Days-of-supply projection. `days_of_supply` is null when daily
 * consumption is 0 (no household set) OR no batches have servings counts.
 */
export interface PrepSupplyEstimate {
  days_of_supply: number | null;
  total_servings: number;
  daily_consumption: number;
  household: PrepHousehold;
  active_batches_count: number;
  batches_breakdown: Array<{
    id: string;
    name: string;
    prep_type: PrepType;
    servings: number;
    status: PrepBatchStatus;
    days_until_ready: number;
    days_until_expires: number;
  }>;
  empty: boolean;
  explanation: string;
}

/**
 * Data-readiness check for the preppers feature. Informational during
 * beta — not gated. Shows the user how close they are to having enough
 * data for the analytics layer to be useful.
 */
export interface PrepEligibility {
  eligible: boolean;
  /** 0..1 — average of days_signal and purchases_signal. */
  score: number;
  days_active: number;
  days_required: number;
  first_active_at: string | null;
  total_purchases: number;
  min_purchases: number;
  explanation: string;
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

/**
 * F1 base recipe finance — per-ingredient last-paid pricing from the user's
 * recent buy history. Available to ALL users; not homemaker-gated.
 *
 * `total_cost` is null when no ingredient has been priced yet.
 * `total_is_partial` flags when some lines were priced and others weren't —
 * the UI shows "≈ RM 12 (4 of 6 priced)" for transparency.
 */
export interface RecipeCostLine {
  name: string;
  catalog_name_norm: string | null;
  common_name_norm: string | null;
  match_source: string;
  /** Last paid price in display currency, or null if user hasn't bought it. */
  last_paid: number | null;
  /** ISO 8601 of the source purchase, or null when last_paid is null. */
  date_bought: string | null;
  /** Reserved for homemaker enhancement — weight × unit_price math. */
  pack_size?: number | null;
  base_unit?: string | null;
}

export interface RecipeCostEstimate {
  currency: string;
  total_cost: number | null;
  total_is_partial: boolean;
  priced_count: number;
  total_count: number;
  lines: RecipeCostLine[];
  disclaimer: string;
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
// Updated 2026-05 (validation-stage): new canonical enum.
// Legacy 'bad' is read-compat only; backend coerces to 'unexpected_event'.
// Waste filter (waste_service): only `expired` + `unexpected_event` count.
export type ConsumeReason = 'used_up' | 'expired' | 'unexpected_event' | 'gift';

// Expanded from cash|card. "Free-text payment method" is on the future
// hooks list — see `.claude/docs/feature-inventory.md`.
export type PaymentMethod = 'cash' | 'ewallet' | 'debit_card' | 'credit_card';

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
  /** UNIT_TYPE_TOUCHPOINT — classifies the item so the Use modal picks
   *  the right input shape. Canonical values: count / volume / weight.
   *  Legacy 'container' is read-compat only; the backend coerces to
   *  'count' on next write. See `.claude/docs/unit-type-method.md`. */
  unit_type?: 'count' | 'volume' | 'weight' | 'container' | null;
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
  location: string | null;          // free-text; registered or ad-hoc
  state?: string | null;            // optional region (validation-stage hook for location search)
  country?: string | null;          // optional country
  status: PurchaseStatus;
  consumed_date: string | null;
  consumed_reason: ConsumeReason | null;
  consumed_reason_text?: string | null;  // optional free-text complement
  transferred_to: string | null;
  reminder_stage: number;
  last_reminded_at: string | null;
  household_id: string | null;
  source_ref: string | null;
  expiry_past?: boolean;
  created_at?: string;
  updated_at?: string;
  source?: string;
  /** Set on terminal events created via partial-action split. Points to the original purchase event. */
  split_from_event_id?: string;
  /** Timestamp when the partial split happened. */
  split_at?: string;
  // === v2 fields (catalog_evolution.md Phase A schema, Phase B write-path) ===
  amount?: number | null;
  display_amount?: number | null;
  display_currency?: string | null;
  fx_rate_at_save?: number | null;
  fx_rate_date?: string | null;
  pack_size?: number;
  base_unit_label?: string;
  // UNIT_TYPE_TOUCHPOINT — canonical fields per
  // .claude/docs/unit-type-method.md. Backend writes both; reads should
  // prefer these over the legacy `unit` / `base_unit_label` mash.
  pack_label?: string;        // descriptive container name (carton/box/loose/…)
  base_unit?: string;         // measurement unit (count/ml/L/g/kg)
  store_id?: string;
  multi_pack_parent_id?: string | null;
  contributes_to_logical_count?: boolean;
  unit_price?: number | null;
  schema_version?: number;
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
  quantity?: number;                // = pack_count (legacy alias)
  unit?: string;                    // legacy mixed field (use pack_label + base_unit instead)
  // UNIT_TYPE_TOUCHPOINT — canonical fields. See unit-type-method.md.
  pack_label?: string;              // carton / box / loose / pack / …
  pack_size?: number;               // base units per pack
  base_unit?: BaseUnit;             // measurement unit
  expiry_raw?: string;              // "tomorrow", "next week", ISO, "no expiry"
  expiry_date?: string;             // ISO overrides expiry_raw
  price?: number;
  currency?: string;
  payment_method?: PaymentMethod;
  date_bought?: string;
  location?: string;                // free-text; registered or ad-hoc
  /** Optional regional metadata. Free-tier capped at 30 distinct values
   *  each via quota_service. Hook for later location-search work. */
  state?: string;
  country?: string;
  /** Phase D: store_id to charge this purchase against. Defaults server-side to "unknown". */
  store_id?: string | null;
}

/**
 * UNIT_TYPE_TOUCHPOINT — canonical base-unit values.
 * Source of truth: backend `unit_type_service.VALID_BASE_UNITS_BY_TYPE`.
 *
 * Per-unit_type permitted subsets:
 *   count  → 'count'
 *   volume → 'ml' | 'L'
 *   weight → 'g' | 'kg'
 */
export type BaseUnit = 'count' | 'ml' | 'L' | 'g' | 'kg';

export interface PurchaseUpdateRequest {
  quantity?: number;
  unit?: string;
  expiry_raw?: string;
  expiry_date?: string;
  price?: number;
  payment_method?: PaymentMethod;
  location?: string;
  state?: string;
  country?: string;
}

export interface PurchaseStatusUpdateRequest {
  status: Exclude<PurchaseStatus, 'active'>;
  reason?: ConsumeReason;
  /** Optional free-text complement to the canonical reason — e.g.
   *  "fed to dog", "kid spilled", "found mouldy". */
  reason_text?: string;
  transferred_to?: string;
  /**
   * Optional partial portion. When 0 < quantity < event.quantity, the server
   * splits the event: a new terminal event is created with this portion
   * (and `split_from_event_id` lineage), and the original event is decremented
   * but stays active. Omit or pass full quantity for whole-event transition.
   */
  quantity?: number;
}

export interface PurchaseMoveRequest {
  location: string;
  /**
   * Optional partial portion. When 0 < quantity < event.quantity, the server
   * splits the event into a new active event at the target location (with
   * `split_from_event_id` lineage); the original stays at the original
   * location, decremented. Omit or pass full quantity for whole-event move.
   */
  quantity?: number;
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

export type SpendingPeriod = 'week' | 'month' | 'last_month' | 'year' | 'all';

export interface WasteSummary {
  period: SpendingPeriod;
  from_date: string;
  to_date: string;
  /** ISO currency code amounts have been converted to (user's current preference). */
  display_currency?: string;
  thrown_count: number;
  thrown_value: number;
  top_wasted: WasteSummaryItem[];
}

export interface SpendingTopItem {
  id: string;
  catalog_name_norm: string | null;
  display_name: string;
  /** Amount in display_currency. */
  amount: number;
  quantity: number;
  date_bought?: string;
}

export interface SpendingSummary {
  period: SpendingPeriod;
  from_date: string;
  to_date: string;
  /** ISO currency code amounts have been converted to (user's current preference). */
  display_currency?: string;
  cash_total: number;
  card_total: number;
  /** Price-bearing events without a payment_method tag. Counts toward grand_total. */
  other_total?: number;
  grand_total: number;
  /** Events with no price recorded at all. */
  untracked_count: number;
  /** Top-5 most expensive purchase events in the period, descending. */
  top_items?: SpendingTopItem[];
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
  // Homemaker module — global kill-switches; per-user access also requires
  // user.homemaker_enabled. Gate resolution lives in useHomemaker() hook.
  homemaker_versioning: boolean;
  homemaker_social: boolean;
  // Preppers module — beta. Single global flag (paired with per-user
  // `user.preppers_enabled`). Resolution lives in usePreppers() hook.
  preppers_enabled: boolean;
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

// === Catalog counter diagnostics (Phase F of catalog_evolution.md) ===

export interface CatalogCounterRow {
  name_norm: string;
  display_name: string;
  barcode: string | null;
  stored_total_purchases: number;
  stored_active_purchases: number;
  recomputed_total_event_count: number;
  recomputed_logical_purchase_count: number;
  recomputed_active: number;
  delta_total: number;
  delta_active: number;
  inflation: number;
  split_event_count: number;
  status_counts: Record<string, number>;
  first_event_at: string | null;
  last_event_at: string | null;
}

export interface CatalogCounterOrphanEvent {
  catalog_name_norm: string;
  event_id: string;
  catalog_display: string | null;
  barcode: string | null;
  status: string | null;
  date_bought: string | null;
}

export interface CatalogCounterDiagnostics {
  user_id: string;
  computed_at: string;
  total_catalog_rows: number;
  total_events: number;
  divergent_count: number;
  inflated_count: number;
  orphan_event_count: number;
  rows: CatalogCounterRow[];
  top_divergent: CatalogCounterRow[];
  top_inflated: CatalogCounterRow[];
  orphan_events: CatalogCounterOrphanEvent[];
}

// === Migration v2 dry-run (Phase 0 of catalog_evolution.md) ===

export interface MigrationDryRunCatalogPrediction {
  name_norm: string;
  display_name: string | null;
  barcode: string | null;
  predicted_catalog_mode: 'global_linked' | 'user_custom';
  predicted_canonical_name: string | null;
  predicted_idle_expires_at: string | null;
  schema_version_target: number;
  ambiguity_flags: string[];
}

export interface MigrationDryRunEventPrediction {
  event_id: string;
  catalog_name_norm: string | null;
  catalog_display: string | null;
  predicted_pack_size: number;
  predicted_base_unit_label: string;
  base_unit_inferred: boolean;
  predicted_currency: string;
  predicted_display_amount: number | null;
  predicted_display_currency: string;
  predicted_fx_rate_at_save: number | null;
  predicted_unit_price: number | null;
  predicted_store_id: string;
  predicted_contributes_to_logical_count: boolean;
  schema_version_target: number;
  ambiguity_flags: string[];
}

export interface MigrationDryRunUserSection {
  predicted_is_paid: boolean;
  predicted_currency_preference: string;
  predicted_catalog_quota_used: number;
  predicted_catalog_quota_limit: number;
  predicted_store_quota_used: number;
  predicted_store_quota_limit: number;
  predicted_schema_version: number;
  quota_at_or_above_limit: boolean;
}

export interface MigrationDryRunStoresSection {
  will_create_unknown_store: boolean;
  auto_created_store_doc: {
    store_id: string;
    name: string;
    auto_created: boolean;
    use_count: number;
  } | null;
}

export interface MigrationDryRunReport {
  user_id: string;
  computed_at: string;
  schema_version_target: number;
  is_paid: boolean;
  user_tier: string | null;
  catalog: {
    total: number;
    predicted_global_linked: number;
    predicted_user_custom_with_barcode: number;
    predicted_user_custom_no_barcode: number;
    ambiguous: MigrationDryRunCatalogPrediction[];
    ambiguous_count: number;
    ambiguous_pct: number;
  };
  events: {
    total: number;
    pack_size_default_count: number;
    base_unit_inferred_count: number;
    base_unit_default_count: number;
    currency_set_count: number;
    currency_default_count: number;
    currencies_seen: Record<string, number>;
    multi_currency_user: boolean;
    no_price_count: number;
    no_quantity_count: number;
    split_event_count: number;
    logical_event_count: number;
    ambiguous: MigrationDryRunEventPrediction[];
    ambiguous_count: number;
    ambiguous_pct: number;
  };
  user: MigrationDryRunUserSection;
  stores: MigrationDryRunStoresSection;
  totals: {
    total_writes_predicted: number;
    total_ambiguous_pct: number;
    pass_threshold_pct: number;
    pass_threshold_met: boolean;
  };
  sample_diffs: {
    catalog: MigrationDryRunCatalogPrediction | null;
    event: MigrationDryRunEventPrediction | null;
  };
  events_sample: MigrationDryRunEventPrediction[];
}

export interface MigrationDryRunPerUserSummary {
  user_id: string;
  user_tier?: string | null;
  is_paid?: boolean;
  catalog_total?: number;
  catalog_global_linked?: number;
  catalog_user_custom?: number;
  catalog_ambiguous_count?: number;
  events_total?: number;
  events_ambiguous_count?: number;
  events_split?: number;
  events_logical?: number;
  multi_currency?: boolean;
  quota_at_or_above_limit?: boolean;
  ambiguous_pct?: number;
  pass_threshold_met?: boolean;
  error?: string;
}

export interface MigrationDryRunAllUsers {
  computed_at: string;
  schema_version_target: number;
  user_count: number;
  aggregate: {
    catalog_total: number;
    catalog_global_linked: number;
    catalog_user_custom: number;
    catalog_ambiguous: number;
    events_total: number;
    events_ambiguous: number;
    events_split: number;
    events_logical: number;
    base_unit_inferred: number;
    base_unit_default: number;
    multi_currency_users: number;
    over_quota_users: number;
    overall_ambiguous_pct: number;
    pass_threshold_pct: number;
    pass_threshold_met: boolean;
  };
  per_user: MigrationDryRunPerUserSummary[];
}

// === Catalog similarity + transfer (Phase G of catalog_evolution.md) ===

export interface SimilarCatalogMatch {
  name_norm: string;
  display_name: string;
  barcode: string | null;
  catalog_mode?: 'global_linked' | 'user_custom';
  total_purchases: number;
  active_purchases: number;
  last_purchased_at: string | null;
  score: number;
}

export interface DuplicatePairSummary {
  name_norm: string;
  display_name: string;
  barcode: string | null;
  catalog_mode?: 'global_linked' | 'user_custom';
  total_purchases: number;
  active_purchases: number;
  last_purchased_at: string | null;
}

export interface DuplicatePair {
  a: DuplicatePairSummary;
  b: DuplicatePairSummary;
  score: number;
  why: 'shared_barcode' | 'name_similarity';
}

export interface TransferPreview {
  src: DuplicatePairSummary;
  dst: DuplicatePairSummary;
  event_count: number;
  with_price_count: number;
  with_waste_count: number;
  base_unit_label_mismatch: boolean;
  src_base_unit_label: string | null;
  dst_base_unit_label: string | null;
  would_release_quota: boolean;
}

export interface TransferExecuteResult {
  transfer_id: string;
  from_catalog_id: string;
  to_catalog_id: string;
  transferred_event_count: number;
  reversal_token: string;
  reversal_expires_at: string;
}

export interface TransferLogEntry {
  transfer_id: string;
  from_catalog_id: string;
  from_display_name: string | null;
  to_catalog_id: string;
  to_display_name: string | null;
  transferred_event_count: number;
  transferred_at: string | null;
  reversal_expires_at: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  reversed_event_count?: number;
  actor_uid?: string;
  reversal_window_open: boolean;
}

// === Catalog overview (Phase E of catalog_evolution.md) ===

export interface CatalogOverviewCounters {
  logical_purchase_count: number;
  total_event_count: number;
  active_count: number;
}

export interface CatalogOverviewLifetime {
  total_qty: number;
  active_qty: number;
  used_qty: number;
  thrown_qty: number;
  given_qty: number;
  transferred_qty: number;
}

export interface CatalogOverviewWasteRate {
  waste_pct: number;
  used_pct: number;
  thrown_pct: number;
  given_pct: number;
  active_pct: number;
}

export interface CatalogOverviewTimelineEntry {
  date: string | null;
  event_id: string;
  action: string;
  location: string | null;
  quantity: number | null;
  status: string | null;
  split_from_event_id: string | null;
}

export interface CatalogOverviewLineageEvent {
  id: string;
  date_bought: string | null;
  quantity: number | null;
  status: string | null;
  location: string | null;
  expiry_date: string | null;
  consumed_reason: string | null;
  split_from_event_id: string | null;
  store_id: string | null;
}

export interface CatalogOverviewLineageNode extends CatalogOverviewLineageEvent {
  children: CatalogOverviewLineageEvent[];
}

export interface CatalogOverviewPriceSample {
  event_id: string;
  date: string | null;
  amount: number | null;
  currency: string | null;
  display_amount: number | null;
  display_currency: string | null;
  unit_price: number | null;
  quantity: number | null;
  pack_size: number | null;
}

export interface CatalogOverviewPriceHistory {
  store_id: string;
  store_name: string;
  samples: CatalogOverviewPriceSample[];
  mean_unit_price: number | null;
  min_unit_price: number | null;
  max_unit_price: number | null;
  latest_unit_price: number | null;
  sample_count: number;
}

export interface CatalogOverviewCurrentLocation {
  location: string;
  /** Sum of event.quantity — the "batch count" view (e.g. 4 packs). */
  active_qty: number;
  /** Sum of event.quantity × event.pack_size — the user's natural unit
   *  (e.g. 24 eggs). Display layer should lead with this. */
  active_base_units: number;
  active_event_count: number;
  /** Distinct pack_size values seen — for "6 eggs/pack" vs "mixed". */
  pack_sizes: number[];
  mixed_pack_sizes: boolean;
  /** Natural-unit label ("egg", "ml", "g", "unit"). */
  base_unit_label: string;
  soonest_expiry: string | null;
  /** Event_id of the most-urgent active batch in this location. The frontend's
   *  per-location Move + Use buttons target this event. */
  most_urgent_event_id: string | null;
  most_urgent_event_qty: number | null;
  most_urgent_event_pack_size: number | null;
}

export interface CatalogOverviewCadence {
  logical_buy_count: number;
  avg_days_between_buys: number | null;
  last_buy_at: string | null;
  days_since_last_buy: number | null;
  /** Negative = overdue, positive = days remaining, null = insufficient data. */
  predicted_next_buy_in_days: number | null;
  avg_days_buy_to_use: number | null;
  use_event_count: number;
}

export interface CatalogOverviewWasteCost {
  display_currency: string | null;
  spent_total: number;
  used_total: number;
  thrown_total: number;
  given_total: number;
  /** thrown_total / spent_total — independent from waste_rate.thrown_pct (qty-based). */
  waste_pct_by_value: number;
}

export interface CatalogOverview {
  entry: CatalogEntry & {
    catalog_mode?: 'global_linked' | 'user_custom';
    canonical_name?: string;
    idle_expires_at?: string | null;
  };
  counters: CatalogOverviewCounters;
  lifetime_breakdown: CatalogOverviewLifetime;
  waste_rate: CatalogOverviewWasteRate;
  movement_timeline: CatalogOverviewTimelineEntry[];
  split_lineage: CatalogOverviewLineageNode[];
  price_history_per_store: CatalogOverviewPriceHistory[];
  current_locations: CatalogOverviewCurrentLocation[];
  cadence: CatalogOverviewCadence;
  waste_cost: CatalogOverviewWasteCost;
  computed_at: string;
}

// === Store catalog (Phase D of catalog_evolution.md) ===

export interface StoreCatalogEntry {
  store_id: string;
  name: string;
  auto_created?: boolean;
  created_at?: string;
  last_used_at?: string;
  use_count?: number;
}

export interface StoreQuotaStatus {
  used: number;
  limit: number;
  available: number;
  at_or_above_limit: boolean;
}

// === Migration v2 audit log (Phase A of catalog_evolution.md) ===

export interface MigrationV2PerUserStats {
  user_id: string;
  catalog_rows_processed: number;
  catalog_rows_global_linked: number;
  catalog_rows_user_custom: number;
  catalog_rows_skipped: number;
  events_processed: number;
  events_with_unit_label_inferred: number;
  events_with_unit_label_default: number;
  events_skipped: number;
  user_doc_updated: boolean;
  user_doc_skipped: boolean;
  store_unknown_created: boolean;
  errors: { doc_path: string; message: string }[];
}

export interface MigrationV2RunSummary {
  run_id: string;
  started_at: string;
  completed_at: string | null;
  schema_version_target: number;
  actor_uid: string;
  user_count: number;
  users_completed: number;
  users_with_errors: number;
  catalog_rows_processed: number;
  catalog_rows_global_linked: number;
  catalog_rows_user_custom: number;
  catalog_rows_skipped: number;
  events_processed: number;
  events_with_unit_label_inferred: number;
  events_with_unit_label_default: number;
  events_skipped: number;
  user_docs_updated: number;
  user_docs_skipped: number;
  stores_created: number;
  errors: { user_id: string; doc_path: string; message: string }[];
  status: 'running' | 'complete' | 'complete_with_errors' | 'failed';
  per_user_count?: number;
}

export interface MigrationV2RunDetail extends MigrationV2RunSummary {
  per_user: MigrationV2PerUserStats[];
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
