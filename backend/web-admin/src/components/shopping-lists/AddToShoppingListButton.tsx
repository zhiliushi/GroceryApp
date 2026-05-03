import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyShoppingLists } from '@/api/queries/useShoppingLists';
import { useAddShoppingListItem } from '@/api/mutations/useShoppingListMutations';
import type { CatalogEntry, ShoppingList } from '@/types/api';

interface Props {
  /** The catalog entry being added to a shopping list. */
  entry: CatalogEntry;
  /** Optional override class for the trigger button. */
  className?: string;
  /** Optional label override (default: "+ Add to shopping list"). */
  label?: string;
}

/**
 * Reusable button: pick a shopping list, add the catalog entry to it.
 * Used from CatalogEntryPage and (later) from MyItems / dashboard rows.
 */
export default function AddToShoppingListButton({ entry, className, label }: Props) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useMyShoppingLists();
  const addMutation = useAddShoppingListItem();

  const lists = data?.lists ?? [];

  function add(list: ShoppingList) {
    addMutation.mutate(
      {
        listId: list.id,
        payload: {
          item_name: entry.display_name,
          barcode: entry.barcode || undefined,
          source_catalog_name_norm: entry.name_norm,
          source: 'cross_page',
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ||
          'px-3 py-1.5 text-sm rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover'
        }
      >
        {label || '+ Add to shopping list'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-ga-border">
              <h3 className="text-sm font-semibold text-ga-text-primary">
                Add "{entry.display_name}" to…
              </h3>
            </div>
            <div className="px-5 py-3">
              {isLoading ? (
                <p className="text-sm text-ga-text-secondary">Loading lists…</p>
              ) : lists.length === 0 ? (
                <div className="text-sm text-ga-text-secondary space-y-2">
                  <p>You don't have any shopping lists yet.</p>
                  <Link
                    to="/shopping-lists"
                    onClick={() => setOpen(false)}
                    className="inline-block text-ga-accent hover:underline"
                  >
                    Create a list →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-1">
                  {lists.map((list) => {
                    const count = list.item_count ?? 0;
                    const atCap = count >= 50;
                    return (
                      <li key={list.id}>
                        <button
                          disabled={atCap || addMutation.isPending}
                          onClick={() => add(list)}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                        >
                          <span className="text-sm text-ga-text-primary">{list.name}</span>
                          <span className="text-xs text-ga-text-secondary">
                            {count}/50 {atCap && '(full)'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="px-5 py-3 border-t border-ga-border flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
