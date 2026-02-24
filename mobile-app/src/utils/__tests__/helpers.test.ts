import {
  isFeatureAvailable,
  capitalise,
  truncate,
  formatPrice,
  generateId,
  toTimestamp,
  fromTimestamp,
  groupBy,
  groupByCategoryId,
  groupByLocation,
  sortByExpiry,
} from '../helpers';

describe('helpers', () => {
  // -----------------------------------------------------------------------
  // Feature gating
  // -----------------------------------------------------------------------

  describe('isFeatureAvailable', () => {
    it('returns true for all features on paid tier', () => {
      expect(isFeatureAvailable('CLOUD_SYNC', 'paid')).toBe(true);
      expect(isFeatureAvailable('AI_SHOPPING_LIST', 'paid')).toBe(true);
    });

    it('returns false for paid features on free tier', () => {
      expect(isFeatureAvailable('CLOUD_SYNC', 'free')).toBe(false);
      expect(isFeatureAvailable('AI_SHOPPING_LIST', 'free')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // String helpers
  // -----------------------------------------------------------------------

  describe('capitalise', () => {
    it('capitalises first character', () => {
      expect(capitalise('hello')).toBe('Hello');
    });

    it('handles already capitalised strings', () => {
      expect(capitalise('Hello')).toBe('Hello');
    });

    it('handles single character', () => {
      expect(capitalise('a')).toBe('A');
    });

    it('handles empty string', () => {
      expect(capitalise('')).toBe('');
    });
  });

  describe('truncate', () => {
    it('returns string unchanged when shorter than maxLength', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('truncates and adds ellipsis when longer', () => {
      const result = truncate('This is a very long string', 10);
      expect(result).toHaveLength(10);
      expect(result).toContain('\u2026');
    });

    it('returns string unchanged when exactly maxLength', () => {
      expect(truncate('exact', 5)).toBe('exact');
    });
  });

  describe('formatPrice', () => {
    it('formats as USD by default', () => {
      expect(formatPrice(9.99)).toBe('$9.99');
    });

    it('returns em dash for null', () => {
      expect(formatPrice(null)).toBe('—');
    });

    it('returns em dash for undefined', () => {
      expect(formatPrice(undefined)).toBe('—');
    });

    it('formats zero', () => {
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('formats with two decimal places', () => {
      expect(formatPrice(10)).toBe('$10.00');
    });
  });

  // -----------------------------------------------------------------------
  // ID generation
  // -----------------------------------------------------------------------

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('contains a dash separator', () => {
      expect(generateId()).toContain('-');
    });
  });

  // -----------------------------------------------------------------------
  // Timestamp conversion
  // -----------------------------------------------------------------------

  describe('toTimestamp', () => {
    it('converts Date to number', () => {
      const date = new Date(2026, 0, 1);
      expect(toTimestamp(date)).toBe(date.getTime());
    });

    it('converts ISO string to number', () => {
      const iso = '2026-01-01T00:00:00.000Z';
      expect(toTimestamp(iso)).toBe(new Date(iso).getTime());
    });

    it('returns null for null', () => {
      expect(toTimestamp(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(toTimestamp(undefined)).toBeNull();
    });
  });

  describe('fromTimestamp', () => {
    it('converts number to Date', () => {
      const ts = Date.now();
      const result = fromTimestamp(ts);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(ts);
    });

    it('returns null for null', () => {
      expect(fromTimestamp(null)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Grouping & sorting
  // -----------------------------------------------------------------------

  describe('groupBy', () => {
    it('groups items by key function', () => {
      const items = [
        {name: 'Milk', type: 'dairy'},
        {name: 'Cheese', type: 'dairy'},
        {name: 'Apple', type: 'fruit'},
      ];
      const result = groupBy(items, i => i.type);
      expect(result.dairy).toHaveLength(2);
      expect(result.fruit).toHaveLength(1);
    });

    it('handles empty array', () => {
      expect(groupBy([], () => 'key')).toEqual({});
    });
  });

  describe('groupByCategoryId', () => {
    it('groups items by categoryId', () => {
      const items = [
        {categoryId: 'A', name: '1'},
        {categoryId: 'B', name: '2'},
        {categoryId: 'A', name: '3'},
      ];
      const result = groupByCategoryId(items);
      expect(result['A']).toHaveLength(2);
      expect(result['B']).toHaveLength(1);
    });
  });

  describe('groupByLocation', () => {
    it('groups items by location', () => {
      const items = [
        {location: 'fridge', name: '1'},
        {location: 'pantry', name: '2'},
        {location: 'fridge', name: '3'},
      ];
      const result = groupByLocation(items);
      expect(result.fridge).toHaveLength(2);
      expect(result.pantry).toHaveLength(1);
    });
  });

  describe('sortByExpiry', () => {
    it('sorts soonest expiry first', () => {
      const now = Date.now();
      const items = [
        {name: 'Late', expiryDate: new Date(now + 10000)},
        {name: 'Soon', expiryDate: new Date(now + 1000)},
        {name: 'Mid', expiryDate: new Date(now + 5000)},
      ];
      const sorted = sortByExpiry(items);
      expect(sorted[0].name).toBe('Soon');
      expect(sorted[1].name).toBe('Mid');
      expect(sorted[2].name).toBe('Late');
    });

    it('puts items without expiry date at end', () => {
      const now = Date.now();
      const items = [
        {name: 'No Expiry', expiryDate: null},
        {name: 'Has Expiry', expiryDate: new Date(now + 1000)},
      ];
      const sorted = sortByExpiry(items);
      expect(sorted[0].name).toBe('Has Expiry');
      expect(sorted[1].name).toBe('No Expiry');
    });

    it('does not mutate original array', () => {
      const items = [{name: 'A', expiryDate: null}];
      const sorted = sortByExpiry(items);
      expect(sorted).not.toBe(items);
    });
  });
});
