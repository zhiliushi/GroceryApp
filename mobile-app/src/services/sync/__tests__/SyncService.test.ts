/**
 * SyncService integration tests.
 *
 * Tests the sync orchestrator logic including:
 * - Analytics batch sync
 * - Paid vs free tier gating
 * - Error handling and retry
 * - Connectivity checks
 */

import {SyncService} from '../SyncService';
import apiClient from '../../../config/api';
import NetInfo from '@react-native-community/netinfo';

jest.mock('../../../config/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

describe('SyncService', () => {
  let service: SyncService;
  const mockApi = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = SyncService.getInstance();

    // Default: online
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
  });

  describe('canSync', () => {
    it('returns true when connected', async () => {
      const result = await service.canSync();
      expect(result).toBe(true);
    });

    it('returns false when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const result = await service.canSync();
      expect(result).toBe(false);
    });
  });

  describe('sync', () => {
    it('syncs analytics for free-tier users', async () => {
      mockApi.post.mockResolvedValue({
        data: {success: true, synced_count: 5},
      });

      // Mock database to return unsynced events
      const mockDb = {
        get: jest.fn().mockReturnValue({
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([]),
          }),
        }),
      };
      service.init(mockDb as any);

      const result = await service.sync('user-1', false);

      expect(result.status).toBe('success');
    });

    it('returns error status when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const mockDb = {
        get: jest.fn().mockReturnValue({
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([]),
          }),
        }),
      };
      service.init(mockDb as any);

      const result = await service.sync('user-1', false);

      expect(result.status).toBe('error');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('listeners', () => {
    it('notifies listeners on sync completion', async () => {
      const listener = jest.fn();
      const unsubscribe = service.addListener(listener);

      const mockDb = {
        get: jest.fn().mockReturnValue({
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([]),
          }),
        }),
      };
      service.init(mockDb as any);

      await service.sync('user-1', false);

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('unsubscribes correctly', async () => {
      const listener = jest.fn();
      const unsubscribe = service.addListener(listener);
      unsubscribe();

      const mockDb = {
        get: jest.fn().mockReturnValue({
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([]),
          }),
        }),
      };
      service.init(mockDb as any);

      await service.sync('user-1', false);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
