import { useEffect, useRef, useState } from 'react';
import { useCreateStore, useStoreSearch } from '@/api/queries/useStores';
import { isQuotaExceededError } from '@/api/mutations/usePurchaseMutations';
import { cn } from '@/utils/cn';
import type { StoreCatalogEntry } from '@/types/api';

interface StoreSelectProps {
  /** Currently selected store_id (or null for unset). */
  value: string | null;
  /** Display label for the current value (passed in to avoid re-querying). */
  valueLabel?: string;
  onChange: (storeId: string | null, name: string) => void;
  /** Optional: tell the picker an upstream quota error happened so the user
   *  is prompted to remove a store instead of seeing a silent failure. */
  onQuotaExceeded?: (details: unknown) => void;
  placeholder?: string;
  /** Render the input in a smaller, denser size. */
  compact?: boolean;
}

/**
 * Combobox: type-to-search + create-on-Enter. Plan §2.2 #9.
 *
 * Behaviour:
 *  - Typing fetches `/api/stores/search?q=...`
 *  - Top match shown first; "Create new 'X'" tail option always available
 *  - Picking an existing match calls onChange(store_id, name)
 *  - Picking "Create new" POSTs to /stores → calls onChange with the new id
 *  - 30-cap quota errors bubble through onQuotaExceeded (caller renders picker)
 */
export default function StoreSelect({
  value,
  valueLabel,
  onChange,
  onQuotaExceeded,
  placeholder = 'Where did you buy?',
  compact = false,
}: StoreSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const search = useStoreSearch(query);
  const createMutation = useCreateStore();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const matches: StoreCatalogEntry[] = search.data ?? [];
  const exactMatch = matches.find(
    (m) => m.name.trim().toLowerCase() === query.trim().toLowerCase(),
  );
  const showCreate = query.trim().length > 0 && !exactMatch;

  function handlePick(store: StoreCatalogEntry) {
    onChange(store.store_id, store.name);
    setQuery('');
    setOpen(false);
  }

  function handleCreate() {
    const name = query.trim();
    if (!name) return;
    createMutation.mutate(name, {
      onSuccess: (created) => {
        onChange(created.store_id, created.name);
        setQuery('');
        setOpen(false);
      },
      onError: (err) => {
        if (isQuotaExceededError(err) && onQuotaExceeded) {
          onQuotaExceeded(err);
        }
      },
    });
  }

  const displayLabel = valueLabel || (value === 'unknown' ? 'Unknown / Other' : value || '');

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        {!open && value && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setQuery('');
            }}
            className={cn(
              'flex-1 text-left px-3 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover',
              compact ? 'py-1.5 text-xs' : 'py-2 text-sm',
            )}
          >
            🏪 {displayLabel}
          </button>
        )}
        {(open || !value) && (
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showCreate) {
                e.preventDefault();
                handleCreate();
              } else if (e.key === 'Enter' && matches[0]) {
                e.preventDefault();
                handlePick(matches[0]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            className={cn(
              'flex-1 min-w-0 px-3 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent',
              compact ? 'py-1.5 text-xs' : 'py-2 text-sm',
            )}
          />
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null, '')}
            title="Clear store"
            className="text-xs text-ga-text-secondary hover:text-ga-text-primary px-2"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-ga-bg-card border border-ga-border rounded-md shadow-lg max-h-72 overflow-y-auto">
          {matches.length === 0 && !showCreate && (
            <p className="px-3 py-2 text-xs text-ga-text-secondary">No stores yet — type a name to add one.</p>
          )}
          {matches.map((m) => (
            <button
              key={m.store_id}
              type="button"
              onClick={() => handlePick(m)}
              className="w-full text-left px-3 py-2 text-sm text-ga-text-primary hover:bg-ga-bg-hover flex items-center justify-between"
            >
              <span>
                🏪 {m.name}
                {m.store_id === 'unknown' && (
                  <span className="ml-2 text-[10px] text-ga-text-secondary">(default)</span>
                )}
              </span>
              {(m.use_count ?? 0) > 0 && (
                <span className="text-[10px] text-ga-text-secondary">
                  {m.use_count}× bought
                </span>
              )}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full text-left px-3 py-2 text-sm text-ga-accent hover:bg-ga-bg-hover border-t border-ga-border disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : `+ Create new "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
