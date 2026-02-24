import {useState, useCallback, useRef} from 'react';
import BarcodeService, {BarcodeResult, LookupResult} from '../services/barcode/BarcodeService';
import {useAuthStore} from '../store/authStore';
import {useDatabase} from './useDatabase';
import type {BarcodeProduct} from '../types';

interface UseBarcodeReturn {
  scanning: boolean;
  loading: boolean;
  product: BarcodeProduct | null;
  source: LookupResult['source'] | null;
  error: string | null;
  handleScan: (result: BarcodeResult) => Promise<void>;
  reset: () => void;
}

/**
 * Hook that manages the full barcode scan → product lookup → Stage 1 save flow.
 *
 * 1. Receives a scanned barcode from the camera
 * 2. Validates the barcode format
 * 3. Runs the 7-step lookup via BarcodeService
 * 4. Saves the result as a Stage 1 ScannedItem in WatermelonDB
 * 5. Exposes loading / product / error / source state
 */
export function useBarcode(): UseBarcodeReturn {
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [source, setSource] = useState<LookupResult['source'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const user = useAuthStore(s => s.user);
  const {scannedItem: scannedItemRepo} = useDatabase();

  const handleScan = useCallback(async (result: BarcodeResult) => {
    // Debounce: ignore duplicate consecutive scans
    if (result.value === lastScannedRef.current) return;
    lastScannedRef.current = result.value;

    if (!BarcodeService.isValidBarcode(result.value)) {
      setError('Invalid barcode format');
      return;
    }

    setScanning(false);
    setLoading(true);
    setError(null);
    setProduct(null);
    setSource(null);

    try {
      // Run the 7-step lookup workflow
      const lookupResult = await BarcodeService.lookupBarcode(
        result.value,
        user?.uid,
      );

      setProduct(lookupResult.product);
      setSource(lookupResult.source);

      // Save to Stage 1 (ScannedItem table) regardless of found status
      if (user?.uid) {
        try {
          await scannedItemRepo.insert({
            barcode: result.value,
            name: lookupResult.product.productName,
            brand: lookupResult.product.brands,
            imageUrl: lookupResult.product.imageUrl,
            lookupData: lookupResult.product.nutritionData
              ? JSON.stringify(lookupResult.product.nutritionData)
              : null,
            userId: user.uid,
          });
        } catch (dbError) {
          console.warn('[useBarcode] Failed to save Stage 1 scan:', dbError);
          // Non-blocking — don't fail the scan because of a DB write error
        }
      }
    } catch (err: any) {
      const message =
        err?.message ?? 'Unable to look up product. Check your connection.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, scannedItemRepo]);

  const reset = useCallback(() => {
    setScanning(true);
    setLoading(false);
    setProduct(null);
    setSource(null);
    setError(null);
    lastScannedRef.current = null;
  }, []);

  return {scanning, loading, product, source, error, handleScan, reset};
}
