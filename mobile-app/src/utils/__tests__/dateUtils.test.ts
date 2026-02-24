import {formatDate, formatDateShort, timeAgo, daysUntil, isFuture, expiryStatus} from '../dateUtils';

describe('dateUtils', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  describe('formatDate', () => {
    it('formats timestamp as "MMM d, yyyy"', () => {
      // Jan 15, 2026
      const ts = new Date(2026, 0, 15).getTime();
      expect(formatDate(ts)).toBe('Jan 15, 2026');
    });

    it('handles different months', () => {
      const ts = new Date(2026, 11, 25).getTime();
      expect(formatDate(ts)).toBe('Dec 25, 2026');
    });
  });

  describe('formatDateShort', () => {
    it('formats timestamp as "MM/dd/yy"', () => {
      const ts = new Date(2026, 0, 15).getTime();
      expect(formatDateShort(ts)).toBe('01/15/26');
    });

    it('pads single-digit months and days', () => {
      const ts = new Date(2026, 2, 5).getTime();
      expect(formatDateShort(ts)).toBe('03/05/26');
    });
  });

  describe('timeAgo', () => {
    it('returns relative time string with suffix', () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const result = timeAgo(oneHourAgo);
      expect(result).toContain('ago');
    });

    it('handles recent timestamps', () => {
      const result = timeAgo(Date.now() - 30 * 1000);
      expect(result).toContain('less than a minute ago');
    });
  });

  describe('daysUntil', () => {
    it('returns positive days for future dates', () => {
      const future = Date.now() + 5 * DAY_MS;
      expect(daysUntil(future)).toBeGreaterThanOrEqual(4);
      expect(daysUntil(future)).toBeLessThanOrEqual(5);
    });

    it('returns negative days for past dates', () => {
      const past = Date.now() - 3 * DAY_MS;
      expect(daysUntil(past)).toBeLessThanOrEqual(-2);
    });

    it('returns 0 for today', () => {
      expect(daysUntil(Date.now())).toBe(0);
    });
  });

  describe('isFuture', () => {
    it('returns true for future timestamps', () => {
      expect(isFuture(Date.now() + DAY_MS)).toBe(true);
    });

    it('returns false for past timestamps', () => {
      expect(isFuture(Date.now() - DAY_MS)).toBe(false);
    });
  });

  describe('expiryStatus', () => {
    it('returns "unknown" for null', () => {
      expect(expiryStatus(null)).toBe('unknown');
    });

    it('returns "unknown" for undefined', () => {
      expect(expiryStatus(undefined)).toBe('unknown');
    });

    it('returns "expired" for past dates', () => {
      expect(expiryStatus(Date.now() - DAY_MS)).toBe('expired');
    });

    it('returns "expiring" for dates within 3 days', () => {
      expect(expiryStatus(Date.now() + 2 * DAY_MS)).toBe('expiring');
    });

    it('returns "expiring" for dates exactly 3 days away', () => {
      expect(expiryStatus(Date.now() + 3 * DAY_MS)).toBe('expiring');
    });

    it('returns "fresh" for dates more than 3 days away', () => {
      expect(expiryStatus(Date.now() + 10 * DAY_MS)).toBe('fresh');
    });
  });
});
