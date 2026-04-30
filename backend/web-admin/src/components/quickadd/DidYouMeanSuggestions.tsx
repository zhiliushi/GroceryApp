import { useCatalogSimilar } from '@/api/queries/useCatalogTransfer';
import type { CatalogEntry, SimilarCatalogMatch } from '@/types/api';

interface Props {
  /** The free-text the user is typing in the QuickAdd Name field. */
  query: string;
  /** Don't suggest the entry the user is already inside (when prefilled). */
  excludeNameNorm?: string;
  /** Called when the user picks "use this one" — returning the existing entry. */
  onPick: (entry: SimilarCatalogMatch) => void;
}

/**
 * "Did you mean?" suggestions (catalog_evolution.md §6.2 #1).
 *
 * Renders below the QuickAddModal name field whenever the typed query is
 * close to an existing catalog row but not an exact match. One-click "Use this"
 * sets the form to that catalog so a duplicate row isn't created.
 */
export default function DidYouMeanSuggestions({
  query,
  excludeNameNorm,
  onPick,
}: Props) {
  const { data: matches, isLoading } = useCatalogSimilar(query, excludeNameNorm);

  if (!query || query.trim().length < 2) return null;
  if (isLoading) return null;
  if (!matches || matches.length === 0) return null;

  // Skip when the top match is identical to the typed query (the catalog
  // autocomplete already covers that case).
  const top = matches[0];
  const exactMatch =
    top.display_name.trim().toLowerCase() === query.trim().toLowerCase();
  if (exactMatch) return null;

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 mt-1">
      <div className="text-[10px] text-amber-300 uppercase tracking-wide mb-1">
        Did you mean?
      </div>
      <div className="space-y-1">
        {matches.slice(0, 3).map((m) => (
          <button
            type="button"
            key={m.name_norm}
            onClick={() => onPick(m)}
            className="w-full text-left flex items-baseline justify-between text-sm hover:bg-amber-500/20 rounded px-2 py-1"
          >
            <span className="text-amber-200">
              ✓ {m.display_name}
              {m.barcode && (
                <span className="ml-2 text-[10px] text-amber-200/70 font-mono">
                  {m.barcode}
                </span>
              )}
            </span>
            <span className="text-[10px] text-amber-200/60">
              {m.total_purchases}× · sim {(m.score * 100).toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Convert a SimilarCatalogMatch into the partial CatalogEntry shape the
 *  QuickAddModal `defaults.catalogEntry` prop expects. */
export function similarMatchToEntry(m: SimilarCatalogMatch): Partial<CatalogEntry> & {
  name_norm: string;
  display_name: string;
} {
  return {
    name_norm: m.name_norm,
    display_name: m.display_name,
    barcode: m.barcode,
    total_purchases: m.total_purchases,
    active_purchases: m.active_purchases,
    last_purchased_at: m.last_purchased_at,
  };
}
