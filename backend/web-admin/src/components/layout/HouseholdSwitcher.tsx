/**
 * Active-household switcher pill (MH-3a — no-op skeleton).
 *
 * Floats top-right of the desktop layout safe-zone, between FloatingScanBtn
 * and GlobalSearchBar's lane. Hidden on mobile (mobile uses the FAB +
 * sidebar; the switcher belongs to the desktop pill row).
 *
 * Today: derives memberships from `useHousehold()` (the user's single
 * household, if any) and shows a single-row pill. The dropdown explains
 * "you belong to one household" so users discover the concept.
 *
 * MH-3b: replace the membership derivation with a dedicated
 * /api/me/memberships fetch. The dropdown becomes meaningful (multiple
 * rows, owner row first, role icons).
 *
 * Hidden when the user has no household at all — pre-onboarding users
 * shouldn't see a household pill.
 */
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useHousehold } from '@/api/queries/useHousehold';
import {
  useActiveHousehold,
  useActiveHouseholdStore,
} from '@/stores/activeHouseholdStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

export default function HouseholdSwitcher() {
  const { data, isLoading } = useHousehold();
  const setMemberships = useActiveHouseholdStore((s) => s.setMemberships);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { active, memberships, setActive } = useActiveHousehold();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Derive memberships from the legacy single household_id (today).
  // MH-3b will replace this with a dedicated /api/me/memberships fetch
  // that returns N entries.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setMemberships([]);
      return;
    }
    if (!data?.household) {
      setMemberships([]);
      return;
    }
    const isOwner = data.household.owner_uid === user.uid;
    setMemberships([
      {
        household_id: data.household.id,
        household_name: data.household.name,
        role: isOwner ? 'owner' : 'member',
      },
    ]);
  }, [isAuthenticated, user, data, setMemberships]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  // Hide entirely when there's nothing meaningful to show.
  if (isLoading || !active) return null;

  return (
    <div
      ref={wrapperRef}
      className="hidden md:block fixed top-4 right-72 z-30"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={
          memberships.length > 1
            ? `Active household: ${active.household_name}. Click to switch.`
            : `Active household: ${active.household_name}. You belong to one household — multi-household shows here when you join another.`
        }
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-ga-bg-card border border-ga-border rounded-full hover:bg-ga-bg-hover shadow-sm"
      >
        <span aria-hidden="true">{active.role === 'owner' ? '⭐' : '🏠'}</span>
        <span className="text-ga-text-primary truncate max-w-[140px]">
          {active.household_name}
        </span>
        <span className="text-ga-text-secondary text-[10px]" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-ga-bg-card border border-ga-border rounded-md shadow-lg py-1 z-40">
          {memberships.length > 1 ? (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-ga-text-secondary">
                Switch household
              </div>
              {memberships.map((m) => (
                <button
                  key={m.household_id}
                  type="button"
                  onClick={() => {
                    setActive(m.household_id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-ga-bg-hover flex items-center gap-2',
                    m.household_id === active.household_id && 'bg-ga-bg-hover',
                  )}
                >
                  <span aria-hidden="true">{m.role === 'owner' ? '⭐' : '👤'}</span>
                  <span className="flex-1 text-ga-text-primary truncate">
                    {m.household_name}
                  </span>
                  <span className="text-[10px] text-ga-text-secondary capitalize">
                    {m.role}
                  </span>
                  {m.household_id === active.household_id && (
                    <span className="text-ga-accent" aria-label="active">✓</span>
                  )}
                </button>
              ))}
            </>
          ) : (
            <div className="px-3 py-2 text-xs text-ga-text-secondary leading-snug">
              <p className="mb-1">
                <span className="text-ga-text-primary font-medium">{active.household_name}</span>
                {' '}({active.role})
              </p>
              <p>
                You belong to one household. When you join another via an invite,
                you&apos;ll be able to switch between them here.
              </p>
            </div>
          )}
          <div className="border-t border-ga-border mt-1 pt-1">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-xs text-ga-accent hover:bg-ga-bg-hover"
            >
              Manage household →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
