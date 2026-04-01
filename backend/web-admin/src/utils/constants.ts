export const PAGE_LIMIT = 50;

export const ITEM_STATUSES = ['active', 'consumed', 'expired', 'discarded'] as const;
export const REVIEW_STATUSES = ['pending_review', 'approved', 'rejected', 'needs_info'] as const;
/** @deprecated Use useLocations() hook instead for dynamic locations. Kept as fallback only. */
export const STORAGE_LOCATIONS = ['fridge', 'freezer', 'pantry', 'counter', 'other'] as const;

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
