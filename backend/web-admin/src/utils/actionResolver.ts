/**
 * State-driven UI action resolver (refactor Phase 4).
 *
 * Pure functions that take a data entity (catalog entry / purchase event /
 * shopping list) and return the list of actions that should be visible given
 * the current state + required-field completeness. See docs/STATE_DRIVEN_UI.md.
 *
 * Principle: no hardcoded button visibility in components. Components render
 * actions derived from these resolvers; changing state rerenders correct actions.
 */

import type {
  CatalogEntry,
  PurchaseEvent,
  PurchaseStatus,
} from '@/types/api';

export type ActionId =
  | 'mark_used'
  | 'mark_thrown'
  | 'give_away'
  | 'set_expiry'
  | 'edit'
  | 'move_location'
  | 'delete'
  | 'view_history'
  | 'set_location'
  | 'merge_into'
  | 'unlink_barcode'
  | 'edit_name'
  | 'new_purchase';

export type ActionSeverity = 'primary' | 'secondary' | 'tertiary' | 'danger';

export interface Action {
  id: ActionId;
  label: string;
  severity: ActionSeverity;
  disabled?: boolean;
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Purchase event
// ---------------------------------------------------------------------------

export type PurchaseEventStateKey =
  | 'draft'                     // no expiry, no location, active
  | 'active_no_expiry'          // active + no expiry set
  | 'active_fresh'              // active + expiry > 7d away
  | 'active_expiring_soon'      // active + expiry 4-7d
  | 'active_expiring_urgent'    // active + expiry <= 3d
  | 'active_expired'            // active + expiry in past
  | 'terminal';                 // used / thrown / transferred

export function getPurchaseEventState(event: PurchaseEvent, now: Date = new Date()): PurchaseEventStateKey {
  if (event.status !== 'active') return 'terminal';
  if (!event.expiry_date) {
    if (!event.location) return 'draft';
    return 'active_no_expiry';
  }
  // Use calendar-day diff (not ms-floor) — plan edge case #12
  const expiry = new Date(event.expiry_date);
  const daysTo = calendarDaysBetween(now, expiry);
  if (daysTo < 0) return 'active_expired';
  if (daysTo <= 3) return 'active_expiring_urgent';
  if (daysTo <= 7) return 'active_expiring_soon';
  return 'active_fresh';
}

export function getPurchaseEventActions(event: PurchaseEvent, now?: Date): Action[] {
  const state = getPurchaseEventState(event, now);
  switch (state) {
    case 'draft':
      return [
        { id: 'set_expiry', label: 'Set expiry', severity: 'primary' },
        { id: 'set_location', label: 'Set location', severity: 'secondary' },
        { id: 'delete', label: 'Delete', severity: 'danger' },
      ];
    case 'active_no_expiry':
      return [
        { id: 'set_expiry', label: 'Set expiry', severity: 'primary' },
        { id: 'mark_used', label: 'Used', severity: 'secondary' },
        { id: 'delete', label: 'Delete', severity: 'danger' },
      ];
    case 'active_fresh':
      return [
        { id: 'mark_used', label: 'Used', severity: 'primary' },
        { id: 'give_away', label: 'Give away', severity: 'secondary' },
        { id: 'move_location', label: 'Move', severity: 'tertiary' },
      ];
    case 'active_expiring_soon':
      return [
        { id: 'mark_used', label: 'Used', severity: 'primary' },
        { id: 'give_away', label: 'Give away', severity: 'secondary' },
        { id: 'mark_thrown', label: 'Throw', severity: 'tertiary' },
      ];
    case 'active_expiring_urgent':
      return [
        { id: 'mark_used', label: 'Used now', severity: 'primary' },
        { id: 'give_away', label: 'Give away', severity: 'secondary' },
        { id: 'mark_thrown', label: 'Throw', severity: 'danger' },
      ];
    case 'active_expired':
      return [
        { id: 'mark_thrown', label: 'Throw (expired)', severity: 'danger' },
        { id: 'mark_used', label: 'Used (still good)', severity: 'secondary' },
      ];
    case 'terminal':
      return [{ id: 'view_history', label: 'View history', severity: 'tertiary' }];
  }
}

// ---------------------------------------------------------------------------
// Catalog entry
// ---------------------------------------------------------------------------

export type CatalogEntryStateKey =
  | 'empty'                 // no purchases ever
  | 'historical'            // has purchases but none active
  | 'active'                // has active purchases
  | 'linked_barcode';       // has barcode (regardless of stock)

export function getCatalogEntryState(entry: CatalogEntry): CatalogEntryStateKey {
  if (entry.barcode) return 'linked_barcode';
  if (entry.active_purchases > 0) return 'active';
  if (entry.total_purchases > 0) return 'historical';
  return 'empty';
}

export function getCatalogEntryActions(entry: CatalogEntry): Action[] {
  const state = getCatalogEntryState(entry);
  const actions: Action[] = [
    { id: 'new_purchase', label: '+ New purchase', severity: 'primary' },
    { id: 'edit_name', label: 'Edit name', severity: 'secondary' },
  ];
  if (state === 'linked_barcode') {
    actions.push({ id: 'unlink_barcode', label: 'Unlink barcode', severity: 'tertiary' });
  }
  actions.push({ id: 'merge_into', label: 'Merge with another', severity: 'tertiary' });
  const canDelete = entry.active_purchases === 0;
  actions.push({
    id: 'delete',
    label: 'Delete catalog',
    severity: 'danger',
    disabled: !canDelete,
    disabledReason: canDelete
      ? undefined
      : `Has ${entry.active_purchases} active purchase(s). Resolve them first.`,
  });
  return actions;
}

// ---------------------------------------------------------------------------
// Expiry chip — status colour helpers
// ---------------------------------------------------------------------------

export type ExpiryChipTone = 'ok' | 'warn' | 'urgent' | 'expired' | 'unknown';

export interface ExpiryChipMeta {
  tone: ExpiryChipTone;
  daysTo: number | null;
  label: string;
  icon: string;
}

/**
 * Compute calendar days between two dates, ignoring time-of-day.
 *
 * Plan edge case #12: server stores expiry as end-of-day UTC (`23:59:59Z`).
 * Using `ms-diff / msPerDay` with floor/round has boundary bugs near midnight —
 * a user in UTC+8 can see "Today" when they mean "Tomorrow" because the diff
 * crosses a UTC boundary different from the local boundary.
 *
 * Fix: snap both dates to UTC-midnight (Date.UTC) and compare calendar days.
 * This gives stable day-diffs across timezones. Plan ideal was server-side
 * date-only storage — tracked in ROADMAP (edge case follow-up).
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUTC = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((toUTC - fromUTC) / (24 * 60 * 60 * 1000));
}

export function getExpiryChipMeta(expiryDate: string | null, now: Date = new Date()): ExpiryChipMeta {
  if (!expiryDate) {
    return { tone: 'unknown', daysTo: null, label: 'No expiry', icon: '❔' };
  }
  const expiry = new Date(expiryDate);
  const daysTo = calendarDaysBetween(now, expiry);
  if (daysTo < 0) return { tone: 'expired', daysTo, label: 'Expired', icon: '🔴' };
  if (daysTo === 0) return { tone: 'urgent', daysTo, label: 'Today', icon: '🔴' };
  if (daysTo === 1) return { tone: 'urgent', daysTo, label: 'Tomorrow', icon: '🟠' };
  if (daysTo <= 3) return { tone: 'urgent', daysTo, label: `${daysTo} days`, icon: '🟠' };
  if (daysTo <= 7) return { tone: 'warn', daysTo, label: `${daysTo} days`, icon: '🟡' };
  return { tone: 'ok', daysTo, label: `${daysTo} days`, icon: '🟢' };
}

// ---------------------------------------------------------------------------
// Status display (consumed/thrown/transferred)
// ---------------------------------------------------------------------------

export function getStatusBadge(status: PurchaseStatus): { label: string; color: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'bg-green-100 text-green-800' };
    case 'used':
      return { label: 'Used', color: 'bg-blue-100 text-blue-800' };
    case 'thrown':
      return { label: 'Thrown', color: 'bg-red-100 text-red-800' };
    case 'transferred':
      return { label: 'Given away', color: 'bg-purple-100 text-purple-800' };
  }
}
