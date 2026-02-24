import {BarcodeService} from '../BarcodeService';
import {BarcodeApiService} from '../BarcodeApiService';

// Mock the API service
jest.mock('../BarcodeApiService');

// Mock the analytics service
jest.mock('../../firebase/AnalyticsService', () => ({
  AnalyticsService: {
    getInstance: jest.fn(() => ({
      logItemScanned: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock Vision Camera
jest.mock('react-native-vision-camera', () => ({
  Camera: {
    getCameraPermissionStatus: jest.fn().mockResolvedValue('granted'),
    requestCameraPermission: jest.fn().mockResolvedValue('granted'),
  },
}));

describe('BarcodeService', () => {
  let service: BarcodeService;
  let mockApiService: jest.Mocked<BarcodeApiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = BarcodeService.getInstance();
    service.clearCache();

    mockApiService = BarcodeApiService.getInstance() as jest.Mocked<BarcodeApiService>;
  });

  describe('isValidBarcode', () => {
    it('accepts valid EAN-13 barcodes', () => {
      expect(service.isValidBarcode('1234567890123')).toBe(true);
    });

    it('accepts valid EAN-8 barcodes', () => {
      expect(service.isValidBarcode('12345678')).toBe(true);
    });

    it('rejects barcodes with letters', () => {
      expect(service.isValidBarcode('123abc')).toBe(false);
    });

    it('rejects too-short barcodes', () => {
      expect(service.isValidBarcode('12345')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(service.isValidBarcode('')).toBe(false);
    });
  });

  describe('lookupBarcode', () => {
    const mockProduct = {
      barcode: '1234567890123',
      productName: 'Test Product',
      brands: 'Brand',
      categories: 'Snacks',
      imageUrl: 'https://example.com/img.jpg',
      nutritionData: null,
      found: true,
    };

    it('returns cached result on second lookup', async () => {
      mockApiService.scanBarcode = jest.fn().mockResolvedValue(mockProduct);

      const result1 = await service.lookupBarcode('1234567890123');
      const result2 = await service.lookupBarcode('1234567890123');

      expect(result1.source).toBe('backend');
      expect(result2.source).toBe('local_cache');
      expect(mockApiService.scanBarcode).toHaveBeenCalledTimes(1);
    });

    it('queries backend API first', async () => {
      mockApiService.scanBarcode = jest.fn().mockResolvedValue(mockProduct);

      const result = await service.lookupBarcode('1234567890123');

      expect(result.product.found).toBe(true);
      expect(result.product.productName).toBe('Test Product');
      expect(result.source).toBe('backend');
    });

    it('returns not_found when all sources fail', async () => {
      mockApiService.scanBarcode = jest.fn().mockRejectedValue(new Error('offline'));

      const result = await service.lookupBarcode('9999999999999');

      expect(result.product.found).toBe(false);
      expect(result.source).toBe('not_found');
    });

    it('clears cache correctly', async () => {
      mockApiService.scanBarcode = jest.fn().mockResolvedValue(mockProduct);

      await service.lookupBarcode('1234567890123');
      service.clearCache();
      await service.lookupBarcode('1234567890123');

      expect(mockApiService.scanBarcode).toHaveBeenCalledTimes(2);
    });
  });

  describe('permissions', () => {
    it('checks camera permission status', async () => {
      const {Camera} = require('react-native-vision-camera');
      Camera.getCameraPermissionStatus.mockResolvedValue('granted');

      const result = await service.hasPermission();
      expect(result).toBe(true);
    });

    it('requests camera permission', async () => {
      const {Camera} = require('react-native-vision-camera');
      Camera.requestCameraPermission.mockResolvedValue('granted');

      const result = await service.requestPermission();
      expect(result).toBe(true);
    });

    it('returns false when permission denied', async () => {
      const {Camera} = require('react-native-vision-camera');
      Camera.requestCameraPermission.mockResolvedValue('denied');

      const result = await service.requestPermission();
      expect(result).toBe(false);
    });
  });
});
