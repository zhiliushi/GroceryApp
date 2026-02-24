import {Camera, CodeScanner, Code} from 'react-native-vision-camera';
import {BARCODE_FORMATS} from '../../config/constants';
import BarcodeApiService from './BarcodeApiService';
import OpenFoodFactsService from '../openFoodFacts/OpenFoodFactsService';
import AnalyticsService from '../firebase/AnalyticsService';
import type {BarcodeProduct} from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BarcodeResult = {
  value: string;
  format: string;
};

export interface LookupResult {
  product: BarcodeProduct;
  source: 'local_cache' | 'backend' | 'openfoodfacts' | 'not_found';
}

// ---------------------------------------------------------------------------
// Local in-memory cache
// ---------------------------------------------------------------------------

interface CachedLookup {
  product: BarcodeProduct;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1_000; // 10 minutes
const lookupCache = new Map<string, CachedLookup>();

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class BarcodeService {
  // -------------------------------------------------------------------------
  // Camera permissions
  // -------------------------------------------------------------------------

  async requestPermission(): Promise<boolean> {
    const status = await Camera.requestCameraPermission();
    return status === 'granted';
  }

  async hasPermission(): Promise<boolean> {
    const status = await Camera.getCameraPermissionStatus();
    return status === 'granted';
  }

  async getPermissionStatus(): Promise<string> {
    return Camera.getCameraPermissionStatus();
  }

  // -------------------------------------------------------------------------
  // Code scanner factory
  // -------------------------------------------------------------------------

  createCodeScanner(onScanned: (result: BarcodeResult) => void): CodeScanner {
    return {
      codeTypes: [...BARCODE_FORMATS],
      onCodeScanned: (codes: Code[]) => {
        if (codes.length > 0) {
          const first = codes[0];
          onScanned({value: first.value ?? '', format: first.type});
        }
      },
    };
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  isValidBarcode(value: string): boolean {
    return /^\d{8,14}$/.test(value);
  }

  // -------------------------------------------------------------------------
  // 7-step barcode lookup workflow
  // -------------------------------------------------------------------------

  /**
   * Full barcode lookup pipeline:
   *
   * 1. Check local in-memory cache
   * 2. Query backend API (handles server-side cache + Firebase)
   * 3. Query Open Food Facts directly (offline-first fallback)
   * 4. If all sources fail → mark as not found
   * 5. Cache the result locally
   * 6. Log analytics event
   * 7. Return the result for Stage 1 save (caller handles DB insert)
   */
  async lookupBarcode(barcode: string, userId?: string): Promise<LookupResult> {
    // Step 1: Check local cache
    const cached = this.getFromCache(barcode);
    if (cached) {
      await AnalyticsService.logItemScanned(barcode, cached.found);
      return {product: cached, source: 'local_cache'};
    }

    // Step 2: Try backend API
    try {
      const backendResult = await BarcodeApiService.scanBarcode(barcode, userId);
      this.addToCache(barcode, backendResult);
      await AnalyticsService.logItemScanned(barcode, backendResult.found);
      return {product: backendResult, source: 'backend'};
    } catch {
      // Backend failed — continue to fallback
    }

    // Step 3: Try Open Food Facts directly
    try {
      const offProduct = await OpenFoodFactsService.getProduct(barcode);
      if (offProduct) {
        const product: BarcodeProduct = {
          barcode,
          productName: offProduct.product_name ?? null,
          brands: offProduct.brands ?? null,
          categories: offProduct.categories ?? null,
          imageUrl: offProduct.image_url ?? null,
          nutritionData: offProduct.nutriments ?? null,
          found: true,
        };
        this.addToCache(barcode, product);
        await AnalyticsService.logItemScanned(barcode, true);
        return {product, source: 'openfoodfacts'};
      }
    } catch {
      // OFF also failed — fall through to not-found
    }

    // Step 4: Not found in any source
    const notFound: BarcodeProduct = {
      barcode,
      productName: null,
      brands: null,
      categories: null,
      imageUrl: null,
      nutritionData: null,
      found: false,
    };

    // Step 5: Cache the not-found result (prevents repeated lookups)
    this.addToCache(barcode, notFound);

    // Step 6: Log analytics
    await AnalyticsService.logItemScanned(barcode, false);

    // Step 7: Return for caller to handle Stage 1 save
    return {product: notFound, source: 'not_found'};
  }

  // -------------------------------------------------------------------------
  // Cache helpers
  // -------------------------------------------------------------------------

  private getFromCache(barcode: string): BarcodeProduct | null {
    const entry = lookupCache.get(barcode);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      lookupCache.delete(barcode);
      return null;
    }

    return entry.product;
  }

  private addToCache(barcode: string, product: BarcodeProduct): void {
    lookupCache.set(barcode, {product, timestamp: Date.now()});
  }

  /** Clear the entire lookup cache. */
  clearCache(): void {
    lookupCache.clear();
  }
}

export default new BarcodeService();
