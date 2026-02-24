/**
 * InventoryRepository unit tests.
 *
 * Since WatermelonDB requires a real database adapter, we mock the
 * collection-level query methods and test the repository's logic layer.
 */

import {InventoryRepository} from '../InventoryRepository';

// Build a mock WatermelonDB collection
function createMockCollection() {
  const mockItems: any[] = [];

  const mockQuery = {
    fetch: jest.fn().mockResolvedValue(mockItems),
    observe: jest.fn().mockReturnValue({subscribe: jest.fn()}),
    fetchCount: jest.fn().mockResolvedValue(mockItems.length),
  };

  return {
    query: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn(),
    create: jest.fn(),
    _mockItems: mockItems,
    _mockQuery: mockQuery,
  };
}

describe('InventoryRepository', () => {
  let repo: InventoryRepository;
  let mockCollection: ReturnType<typeof createMockCollection>;

  beforeEach(() => {
    mockCollection = createMockCollection();
    // Create repository with mocked database
    repo = new InventoryRepository(mockCollection as any);
  });

  describe('getActive', () => {
    it('queries for active items only', async () => {
      const activeItems = [
        {id: '1', name: 'Milk', status: 'active'},
        {id: '2', name: 'Bread', status: 'active'},
      ];
      mockCollection._mockQuery.fetch.mockResolvedValue(activeItems);

      const result = await repo.getActive();

      expect(mockCollection.query).toHaveBeenCalled();
      expect(result).toEqual(activeItems);
    });
  });

  describe('getExpiring', () => {
    it('queries items expiring within given days', async () => {
      const expiringItems = [
        {id: '1', name: 'Yogurt', expiryDate: new Date(Date.now() + 86400000)},
      ];
      mockCollection._mockQuery.fetch.mockResolvedValue(expiringItems);

      const result = await repo.getExpiring(3);

      expect(mockCollection.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('returns item by ID', async () => {
      const item = {id: 'item-1', name: 'Milk'};
      mockCollection.find.mockResolvedValue(item);

      const result = await repo.getById('item-1');

      expect(mockCollection.find).toHaveBeenCalledWith('item-1');
      expect(result).toEqual(item);
    });

    it('returns null when item not found', async () => {
      mockCollection.find.mockRejectedValue(new Error('not found'));

      const result = await repo.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('insert', () => {
    it('creates a new inventory item', async () => {
      const newItem = {
        name: 'Milk',
        categoryId: 'cat-dairy',
        quantity: 1,
        unitId: 'unit-l',
        location: 'fridge',
        userId: 'user-1',
      };

      const createdItem = {id: 'new-1', ...newItem, status: 'active'};
      mockCollection.create.mockImplementation(async (creator: any) => {
        const record = {...createdItem};
        creator(record);
        return record;
      });

      const result = await repo.insert(newItem as any);

      expect(mockCollection.create).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });

  describe('count', () => {
    it('returns total item count', async () => {
      mockCollection._mockQuery.fetchCount.mockResolvedValue(42);

      const result = await repo.count();

      expect(result).toBe(42);
    });
  });

  describe('getConsumptionStats', () => {
    it('returns consumption statistics', async () => {
      const consumed = [
        {reason: 'used_up'},
        {reason: 'used_up'},
        {reason: 'expired'},
        {reason: 'discarded'},
      ];
      mockCollection._mockQuery.fetch.mockResolvedValue(consumed);

      const result = await repo.getConsumptionStats(30);

      expect(result).toEqual({
        total: 4,
        usedUp: 2,
        expired: 1,
        discarded: 1,
      });
    });
  });
});
