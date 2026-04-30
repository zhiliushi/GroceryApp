import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const DISMISS_KEY = 'catalog_cleanup_banner_dismissed_v2';

/**
 * Post-migration nudge per catalog_evolution.md §4.4. Shown once after v2
 * migration; user must explicitly dismiss. Quota enforcement doesn't kick in
 * until Phase C ships, so this is pre-warning.
 *
 * Visible only to authenticated users whose user doc has schema_version >= 2.
 */
export default function CatalogCleanupBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) {
      try {
        localStorage.setItem(DISMISS_KEY, 'true');
      } catch {
        /* ignore quota errors */
      }
    }
  }, [dismissed]);

  if (!user || (user.schema_version ?? 1) < 2 || dismissed) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/40 px-4 py-2 text-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="text-amber-300">
          <strong>Catalog cleanup is now active.</strong>{' '}
          <span className="text-amber-200/80">
            Items in your catalog without a barcode have a 30-day idle counter — touch them to
            keep, or remove from the list. (Paid users exempt.)
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/catalog"
            className="px-3 py-1 rounded bg-amber-500/20 text-amber-100 text-xs hover:bg-amber-500/30"
          >
            Show me
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1 rounded bg-ga-bg-card border border-ga-border text-ga-text-secondary text-xs hover:bg-ga-bg-hover"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
