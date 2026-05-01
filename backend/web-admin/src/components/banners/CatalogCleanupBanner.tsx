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

  // Right-padding on desktop reserves space for the fixed Add/Scan pills
  // (top-right z-30 on AppLayout). Without it the banner text slid under
  // the pills and the dismiss button was unclickable. Numbers chosen to
  // clear roughly Add pill (~110px) + Scan pill (~85px) + gap = ~290px.
  return (
    <div className="relative z-40 bg-amber-500/15 border-b border-amber-500/50 px-4 py-2 text-sm md:pr-[300px]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="text-amber-100 flex-1 min-w-0">
          <strong className="font-semibold">Catalog cleanup is now active.</strong>{' '}
          <span className="text-amber-200">
            Items in your catalog without a barcode have a 30-day idle counter — touch them to
            keep, or remove from the list. (Paid users exempt.)
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/catalog"
            className="px-3 py-1 rounded bg-amber-400/30 text-amber-50 text-xs font-medium hover:bg-amber-400/40"
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
