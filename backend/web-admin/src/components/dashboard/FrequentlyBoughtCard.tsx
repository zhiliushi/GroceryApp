import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '@/api/queries/useCatalog';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import type { CatalogEntry } from '@/types/api';

/**
 * Top-N catalog entries sorted by total_purchases. One-tap to add a new
 * purchase of any frequently-bought item (pre-fills QuickAddModal).
 */
export default function FrequentlyBoughtCard({ limit = 5 }: { limit?: number }) {
  const { data } = useCatalog({ sort_by: 'total_purchases', limit });
  const [addTarget, setAddTarget] = useState<CatalogEntry | null>(null);

  const items = data?.items.filter((i) => i.total_purchases > 0) ?? [];

  return (
    <>
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-semibold text-ga-text-primary">Frequently bought</h4>
          <Link to="/catalog" className="text-xs text-ga-accent hover:underline">
            All →
          </Link>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-ga-text-secondary italic">No purchase history yet.</p>
        ) : (
          <ul className="space-y-1">
            {items.slice(0, limit).map((entry, i) => (
              <li key={entry.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 truncate">
                  <span className="text-ga-text-secondary font-mono w-4">{i + 1}.</span>
                  <span className="text-ga-text-primary truncate">{entry.display_name}</span>
                  <span className="text-ga-text-secondary flex-shrink-0">({entry.total_purchases}×)</span>
                </span>
                <button
                  onClick={() => setAddTarget(entry)}
                  className="text-xs px-2 py-0.5 bg-ga-accent/20 text-ga-accent rounded hover:bg-ga-accent/30 flex-shrink-0"
                >
                  + Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuickAddModal
        open={!!addTarget}
        onClose={() => setAddTarget(null)}
        defaults={addTarget ? { catalogEntry: addTarget } : undefined}
      />
    </>
  );
}
