/**
 * Active-household store (MH-3a — no-op skeleton).
 *
 * Goal: a forward-compatible API surface for "which household is the user
 * looking at right now". Today every user has at most one household, so the
 * store always returns that single value. When MH-3b lands and a user can
 * be a member of multiple households, the read source flips to a dedicated
 * /api/me/memberships endpoint without changing this contract.
 *
 * Persistence: per-user localStorage key `ga:active_household:${uid}`. Two
 * users sharing a browser keep their own active-household choice.
 *
 * Synchronous accessor: `getActiveHouseholdId()` is exposed for non-React
 * contexts (the axios interceptor reads it before every API call).
 *
 * See `docs/PLAN_ONBOARDING_V2.md` MH-3 for the full plan.
 */
import { create } from 'zustand';
import { useAuthStore } from './authStore';

const KEY_PREFIX = 'ga:active_household:';

export interface Membership {
  household_id: string;
  household_name: string;
  role: 'owner' | 'member';
}

interface ActiveHouseholdState {
  activeId: string | null;
  memberships: Membership[];
  /** User-driven switch via the header pill. Persists. */
  setActive: (householdId: string) => void;
  /** Called by the data-fetching layer when memberships are (re)loaded. */
  setMemberships: (memberships: Membership[]) => void;
  /** Clear on signOut. */
  reset: () => void;
}

function readPersisted(uid: string): string | null {
  try {
    return window.localStorage.getItem(KEY_PREFIX + uid);
  } catch {
    return null;
  }
}

function writePersisted(uid: string, value: string | null): void {
  try {
    if (value) {
      window.localStorage.setItem(KEY_PREFIX + uid, value);
    } else {
      window.localStorage.removeItem(KEY_PREFIX + uid);
    }
  } catch {
    /* localStorage disabled — non-fatal, in-memory only */
  }
}

export const useActiveHouseholdStore = create<ActiveHouseholdState>((set) => ({
  activeId: null,
  memberships: [],

  setActive: (householdId) => {
    const uid = useAuthStore.getState().user?.uid;
    if (uid) writePersisted(uid, householdId);
    set({ activeId: householdId });
  },

  setMemberships: (memberships) => {
    const uid = useAuthStore.getState().user?.uid;
    if (!uid) {
      set({ memberships, activeId: memberships[0]?.household_id ?? null });
      return;
    }
    const persisted = readPersisted(uid);
    const valid = persisted && memberships.some((m) => m.household_id === persisted);
    set({
      memberships,
      // Persisted preference if it still maps to a current membership;
      // otherwise fall back to the first (owner-first ordering enforced by
      // the membership source — see HouseholdSwitcher's useEffect).
      activeId: valid ? persisted : memberships[0]?.household_id ?? null,
    });
  },

  reset: () => set({ activeId: null, memberships: [] }),
}));

/**
 * Hook for components: returns the active membership + list + setter.
 *
 * Today, `memberships.length` is at most 1 (derived from the user's single
 * `household_id`). MH-3b will flip the source to a /api/me/memberships
 * endpoint without changing this signature.
 */
export function useActiveHousehold() {
  const activeId = useActiveHouseholdStore((s) => s.activeId);
  const memberships = useActiveHouseholdStore((s) => s.memberships);
  const setActive = useActiveHouseholdStore((s) => s.setActive);
  const active = memberships.find((m) => m.household_id === activeId) ?? null;
  return { active, memberships, setActive };
}

/**
 * Synchronous read for non-React contexts. The axios interceptor uses this
 * to set the `X-Household` header on every outbound request.
 *
 * Returns `null` when the user has no household (e.g. on /login or before
 * the household query resolves) — interceptor treats null as "omit header".
 */
export function getActiveHouseholdId(): string | null {
  return useActiveHouseholdStore.getState().activeId;
}
