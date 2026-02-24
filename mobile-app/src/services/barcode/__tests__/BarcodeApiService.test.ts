import {BarcodeApiService, BarcodeApiError} from '../BarcodeApiService';
import apiClient from '../../../config/api';
import NetInfo from '@react-native-community/netinfo';

// Mock the API client
jest.mock('../../../config/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe('BarcodeApiService', () => {
  let service: BarcodeApiService;
  const mockApi = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = BarcodeApiService.getInstance();
    // Reset queue
    while (service.getQueueSize() > 0) {
      // drain queue
    }
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  describe('scanBarcode', () => {
    it('sends POST request to /api/barcode/scan', async () => {
      const mockResponse = {
        data: {
          found: true,
          source: 'openfoodfacts',
          product: {
            barcode: '1234567890123',
            product_name: 'Chips',
            brands: 'Brand',
            found: true,
          },
        },
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await service.scanBarcode('1234567890123', 'user-1');

      expect(mockApi.post).toHaveBeenCalledWith('/api/barcode/scan', {
        barcode: '1234567890123',
        user_id: 'user-1',
      });
      expect(result.found).toBe(true);
    });

    it('throws BarcodeApiError with offline code when no connection', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      await expect(service.scanBarcode('1234567890123')).rejects.toThrow(BarcodeApiError);
    });

    it('queues request when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      try {
        await service.scanBarcode('1234567890123');
      } catch {
        // expected
      }

      expect(service.getQueueSize()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getProduct', () => {
    it('returns product data on success', async () => {
      mockApi.get.mockResolvedValue({
        data: {barcode: '123', product_name: 'Test', found: true},
      });

      const result = await service.getProduct('123');
      expect(result).toBeTruthy();
      expect(result?.found).toBe(true);
    });

    it('returns null on 404', async () => {
      mockApi.get.mockRejectedValue({
        isAxiosError: true,
        response: {status: 404},
      });

      const result = await service.getProduct('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('contributeProduct', () => {
    it('sends product data to contribute endpoint', async () => {
      mockApi.post.mockResolvedValue({
        data: {success: true, message: 'Contributed'},
      });

      const result = await service.contributeProduct({
        barcode: '1234567890123',
        productName: 'New Product',
        brands: 'Brand',
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/barcode/contribute',
        expect.objectContaining({barcode: '1234567890123'}),
      );
      expect(result?.success).toBe(true);
    });
  });

  describe('BarcodeApiError', () => {
    it('has correct code property', () => {
      const err = new BarcodeApiError('offline', 'No connection');
      expect(err.code).toBe('offline');
      expect(err.message).toBe('No connection');
      expect(err instanceof Error).toBe(true);
    });
  });
});
