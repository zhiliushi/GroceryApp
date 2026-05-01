export const PAGE_LIMIT = 50;

export const ITEM_STATUSES = ['active', 'consumed', 'expired', 'discarded'] as const;
export const REVIEW_STATUSES = ['pending_review', 'approved', 'rejected', 'needs_info'] as const;
// LOCATION_TOUCHPOINT note: there is intentionally NO STORAGE_LOCATIONS
// constant here. Locations are user-configurable and come from
// `useLocations()` (hook) on the frontend, or `/api/config/locations`
// directly. If you find yourself wanting a hardcoded list, that's a
// regression — see `.claude/docs/feature-inventory.md` "location
// touchpoints" for the rule.

export const FOODBANK_COUNTRIES = [
  { value: 'MY', label: 'Malaysia' },
  { value: 'SG', label: 'Singapore' },
  { value: 'US', label: 'United States' },
] as const;

export const isPending = (status: string) => status === 'pending_review';
export const isTerminalStatus = (status: string) =>
  ['consumed', 'expired', 'discarded'].includes(status);
export const isReviewed = (status: string) =>
  ['approved', 'rejected'].includes(status);
