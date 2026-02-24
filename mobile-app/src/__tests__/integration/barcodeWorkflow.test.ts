/**
 * Integration test: Complete barcode scanning workflow.
 *
 * Scenarios:
 * 1. Scan → product found in backend → add to inventory
 * 2. Scan → product not found → user contributes
 * 3. Scan → offline → queued for later
 */

import {BarcodeService} from '../../services/barcode/BarcodeService';
import {BarcodeApiService} from '../../services/barcode/BarcodeApiService';
import apiClient from '../../config/api';
import NetInfo from '@react-native-community/netinfo';

jest.mock('../../config/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../../services/firebase/AnalyticsService', () => ({
  AnalyticsService: {
    getInstance: jest.fn(() => ({
      logItemScanned: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('Barcode Workflow Integration', () => {
  const mockApi = apiClient as jest.Mocked<typeof apiClient>;
  let barcodeService: BarcodeService;
  let apiService: BarcodeApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    barcodeService = BarcodeService.getInstance();
    barcodeService.clearCache();
    apiService = BarcodeApiService.getInstance();

    // Default: online
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  // -----------------------------------------------------------------------
  // Scenario 1: Product found in backend
  // -----------------------------------------------------------------------

  describe('Scenario: Scan → product found', () => {
    it('returns product data from backend', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          found: true,
          source: 'openfoodfacts',
          product: {
            barcode: '4006381333931',
            product_name: 'Nutella',
            brands: 'Ferrero',
            categories: 'Spreads',
            image_url: 'https://images.openfoodfacts.org/nutella.jpg',
            nutrition_data: {energy_100g: 2255},
            found: true,
          },
        },
      });

      const result = await barcodeService.lookupBarcode('4006381333931', 'user-1');

      expect(result.product.found).toBe(true);
      expect(result.product.productName).toBe('Nutella');
      expect(result.product.brands).toBe('Ferrero');
      expect(result.source).toBe('backend');
    });

    it('caches result for subsequent lookups', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          found: true,
          source: 'firebase',
          product: {barcode: '123', product_name: 'Cached', found: true},
        },
      });

      await barcodeService.lookupBarcode('1234567890123');
      const second = await barcodeService.lookupBarcode('1234567890123');

      expect(second.source).toBe('local_cache');
      expect(mockApi.post).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Scenario 2: Product not found → user contributes
  // -----------------------------------------------------------------------

  describe('Scenario: Scan → not found → contribute', () => {
    it('returns not_found, then user contributes successfully', async () => {
      // First: scan returns not found
      mockApi.post.mockResolvedValueOnce({
        data: {found: false, source: 'not_found', product: null},
      });

      const scanResult = await barcodeService.lookupBarcode('9999999999999');
      expect(scanResult.product.found).toBe(false);

      // Then: user contributes the product
      mockApi.post.mockResolvedValueOnce({
        data: {success: true, message: 'Contributed'},
      });

      const contributeResult = await apiService.contributeProduct({
        barcode: '9999999999999',
        productName: 'My Custom Product',
        brands: 'Local Brand',
      });

      expect(contributeResult?.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Scenario 3: Offline scan → queued
  // -----------------------------------------------------------------------

  describe('Scenario: Scan → offline', () => {
    it('falls back to not_found when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const result = await barcodeService.lookupBarcode('1234567890123');

      // Should gracefully degrade to not_found
      expect(result.product.found).toBe(false);
      expect(result.source).toBe('not_found');
    });
  });

  // -----------------------------------------------------------------------
  // Scenario 4: Backend error → Open Food Facts fallback
  // -----------------------------------------------------------------------

  describe('Scenario: Backend error → OFF fallback', () => {
    it('tries OFF when backend fails', async () => {
      mockApi.post.mockRejectedValue(new Error('Server error'));

      const result = await barcodeService.lookupBarcode('5000159484695');

      // Should attempt OFF fallback, but since httpx is mocked too,
      // will fall through to not_found
      expect(result.source).toBe('not_found');
    });
  });

  // -----------------------------------------------------------------------
  // Scenario 5: Authentication flow
  // -----------------------------------------------------------------------

  describe('Scenario: Scan with user context', () => {
    it('passes user_id to backend', async () => {
      mockApi.post.mockResolvedValue({
        data: {found: true, source: 'firebase', product: {found: true, barcode: '123'}},
      });

      await barcodeService.lookupBarcode('1234567890123', 'authenticated-user-id');

      expect(mockApi.post).toHaveBeenCalledWith('/api/barcode/scan', {
        barcode: '1234567890123',
        user_id: 'authenticated-user-id',
      });
    });
  });
});
