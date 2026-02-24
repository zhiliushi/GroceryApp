export interface BarcodeProduct {
  barcode: string;
  productName: string | null;
  brands: string | null;
  categories: string | null;
  imageUrl: string | null;
  nutritionData: Record<string, number> | null;
  found: boolean;
}

/** Response from POST /api/barcode/scan */
export interface ScanResponse {
  barcode: string;
  product: BarcodeProduct | null;
  source: 'cache' | 'backend' | 'openfoodfacts' | 'not_found';
}

/** Request for POST /api/barcode/contribute */
export interface ContributeRequest {
  barcode: string;
  productName: string;
  brands?: string;
  categories?: string;
  imageUrl?: string;
}

/** Response from POST /api/barcode/contribute */
export interface ContributeResponse {
  status: string;
  barcode: string;
}

/** Category option for the contribute form. */
export interface ContributeCategory {
  id: string;
  label: string;
}

/** The contribute categories list used by the contribution modal. */
export const CONTRIBUTE_CATEGORIES: ContributeCategory[] = [
  {id: 'produce', label: 'Produce'},
  {id: 'dairy_eggs', label: 'Dairy & Eggs'},
  {id: 'meat_seafood', label: 'Meat & Seafood'},
  {id: 'bakery', label: 'Bakery'},
  {id: 'frozen_foods', label: 'Frozen Foods'},
  {id: 'pantry_staples', label: 'Pantry Staples'},
  {id: 'beverages', label: 'Beverages'},
  {id: 'snacks', label: 'Snacks'},
  {id: 'personal_care', label: 'Personal Care'},
  {id: 'household', label: 'Household'},
  {id: 'other', label: 'Other'},
];

export interface AnalyticsSyncRequest {
  user_id: string;
  analytics: Array<{
    user_id: string;
    data_type: string;
    timestamp: string;
    data: Record<string, unknown>;
  }>;
}

export interface AnalyticsSyncResponse {
  status: string;
  message: string;
  user_id: string;
}

export interface AnalyticsStatsResponse {
  user_id: string;
  period: string;
  stats: {
    total_purchases: number;
    total_expenses: number;
    inventory_items: number;
  };
}

export interface ApiError {
  detail: string;
}
