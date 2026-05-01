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

  // Banner is z-40 + full-width, painting OVER the floating Add/Scan/Search
  // pills (z-30) wherever they overlap. So the banner's own content
  // doesn't need pill clearance — it owns the visible top strip when
  // visible. Content area uses normal padding.
  //
  // Color discipline: amber-900/950 text on amber-200 ground for
  // high contrast on the light theme.
  return (
    <div className="relative z-40 bg-amber-200 border-b-2 border-amber-500 px-4 py-2.5 text-sm shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <strong className="font-semibold text-amber-950">⚠ Catalog cleanup is now active.</strong>{' '}
          <span className="text-amber-900">
            Items in your catalog without a barcode have a 30-day idle counter — touch them to
            keep, or remove from the list. (Paid users exempt.)
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/catalog"
            className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 shadow-sm"
          >
            Show me
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 rounded bg-white border border-amber-400 text-amber-900 text-xs font-medium hover:bg-amber-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
