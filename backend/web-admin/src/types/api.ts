// === Auth ===
export interface AuthUser {
  authenticated: boolean;
  uid: string;
  email: string;
  role: 'admin' | 'user';
  display_name: string;
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
