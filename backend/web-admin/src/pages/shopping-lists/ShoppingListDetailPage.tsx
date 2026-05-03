import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  useMyShoppingListDetail,
} from '@/api/queries/useShoppingLists';
import {
  useAddShoppingListItem,
  useDeleteShoppingList,
  useDeleteShoppingListItem,
  useDeleteShoppingListPrice,
  useRenameShoppingList,
  useUpdateShoppingList,
} from '@/api/mutations/useShoppingListMutations';
import { useVisibility } from '@/hooks/useVisibility';
import ScanReceiptButton from '@/components/receipt/ScanReceiptButton';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import ContextualScannerModal from '@/components/barcode/ContextualScannerModal';
import AddItemRow from './AddItemRow';
import AddPriceInlineForm from './AddPriceInlineForm';
import PricePickerDialog, { type BuyChoice } from './PricePickerDialog';
import { cn } from '@/utils/cn';
import type { ShoppingListItem, ShoppingListPrice } from '@/types/api';

const MAX_ITEMS_PER_LIST = 50;

function itemDimensionLabel(item: ShoppingListItem): string {
  // v2 first, then v1 legacy fallback.
  const parts: string[] = [];
  if (item.quantity != null) {
    parts.push(`${item.quantity}${item.unit ? ` ${item.unit}` : ''}`);
  }
  if (item.weight_value != null && item.weight_unit) {
    parts.push(`${item.weight_value}${item.weight_unit}`);
  }
  if (item.volume_value != null && item.volume_unit) {
    parts.push(`${item.volume_value}${item.volume_unit}`);
  }
  if (parts.length === 0 && item.unitId) {
    parts.push(item.unitId);
  }
  return parts.join(' · ');
}

function lowestPrice(prices?: ShoppingListPrice[]): ShoppingListPrice | null {
  if (!prices || prices.length === 0) return null;
  return prices.reduce((acc, p) => (p.price < acc.price ? p : acc), prices[0]);
}

export default function ShoppingListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useMyShoppingListDetail(listId);

  const renameMutation = useRenameShoppingList();
  const updateMutation = useUpdateShoppingList();
  const { canUseTool } = useVisibility();
  const tripNotesEnabled = canUseTool('trip_notes');
  const deleteListMutation = useDeleteShoppingList();
  const deleteItemMutation = useDeleteShoppingListItem();
  const deletePriceMutation = useDeleteShoppingListPrice();
  const addItemMutation = useAddShoppingListItem();

  // Local UI state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addPriceForId, setAddPriceForId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Buy flow state
  const [buyTarget, setBuyTarget] = useState<ShoppingListItem | null>(null);
  const [pricePickerForItem, setPricePickerForItem] = useState<ShoppingListItem | null>(null);
  const [quickAddDefaults, setQuickAddDefaults] = useState<{
    name?: string;
    barcode?: string;
  } | null>(null);

  useEffect(() => {
    if (data?.list?.name && renameValue === '') {
      setRenameValue(data.list.name);
    }
  }, [data?.list?.name, renameValue]);

  // Listen for scanner-add events while this page is mounted. The scanner
  // dispatches `grocery:scan-add-to-shopping-list` with the scanned barcode
  // + matched display name; we POST it to the current list.
  useEffect(() => {
    if (!listId) return;
    function onScanAdd(e: Event) {
      const detail = (e as CustomEvent<{ barcode: string; nameNorm: string; display: string }>).detail;
      if (!detail?.display) return;
      addItemMutation.mutate({
        listId: listId!,
        payload: {
          item_name: detail.display,
          barcode: detail.barcode || undefined,
          source_catalog_name_norm: detail.nameNorm || undefined,
          source: 'scan',
        },
      });
    }
    window.addEventListener('grocery:scan-add-to-shopping-list', onScanAdd);
    return () => window.removeEventListener('grocery:scan-add-to-shopping-list', onScanAdd);
  }, [listId, addItemMutation]);

  const items = useMemo(() => data?.items ?? [], [data]);

  if (isLoading) return <LoadingSpinner text="Loading list…" />;
  if (!data || !listId) {
    return (
      <div className="p-6 text-ga-text-secondary">
        Shopping list not found.{' '}
        <Link to="/shopping-lists" className="text-ga-accent hover:underline">
          ← Back to lists
        </Link>
      </div>
    );
  }

  const list = data.list;
  const itemCount = items.length;
  const atCap = itemCount >= MAX_ITEMS_PER_LIST;

  function startRename() {
    setRenameValue(list.name);
    setRenaming(true);
  }

  function commitRename() {
    const name = renameValue.trim();
    if (!name || name === list.name) {
      setRenaming(false);
      return;
    }
    renameMutation.mutate({ listId: listId!, name }, { onSuccess: () => setRenaming(false) });
  }

  function handleDeleteList() {
    if (!confirm(`Delete the list "${list.name}"? Items will be removed.`)) return;
    deleteListMutation.mutate(listId!, {
      onSuccess: () => navigate('/shopping-lists'),
    });
  }

  function handleDeleteItem(item: ShoppingListItem) {
    if (!confirm(`Remove "${item.item_name || item.itemName}" from the list?`)) return;
    deleteItemMutation.mutate({ listId: listId!, itemId: item.id });
  }

  function startBuy(item: ShoppingListItem) {
    const prices = item.prices || [];
    setBuyTarget(item);
    if (prices.length > 1) {
      setPricePickerForItem(item);
    } else {
      const single = prices[0];
      setQuickAddDefaults({
        name: item.item_name || item.itemName || '',
        barcode: single?.barcode || item.barcode || undefined,
      });
    }
  }

  function handlePricePicked(choice: BuyChoice) {
    setPricePickerForItem(null);
    if (!buyTarget) return;
    if (choice.kind === 'rescan') {
      setQuickAddDefaults(null);
      setScannerOpen(true);
      return;
    }
    if (choice.kind === 'manual') {
      setQuickAddDefaults({
        name: buyTarget.item_name || buyTarget.itemName || '',
      });
      return;
    }
    // 'price' choice
    setQuickAddDefaults({
      name: buyTarget.item_name || buyTarget.itemName || '',
      barcode: choice.price.barcode || buyTarget.barcode || undefined,
    });
  }

  function handleQuickAddSaved() {
    // Successful purchase — remove the item from the list.
    if (buyTarget) {
      deleteItemMutation.mutate({ listId: listId!, itemId: buyTarget.id });
    }
    setBuyTarget(null);
    setQuickAddDefaults(null);
  }

  function handleQuickAddClose() {
    setQuickAddDefaults(null);
    setBuyTarget(null);
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-3">
        <Link to="/shopping-lists" className="text-ga-accent hover:underline text-sm">
          ← Shopping Lists
        </Link>
      </div>

      {/* Header — name, item count, delete */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setRenameValue(list.name);
                  setRenaming(false);
                }
              }}
              maxLength={80}
              className="text-xl font-semibold bg-ga-bg-card border border-ga-border rounded px-2 py-1 text-ga-text-primary focus:outline-none focus:border-ga-accent"
            />
          ) : (
            <h1
              onClick={startRename}
              className="text-xl font-semibold text-ga-text-primary truncate cursor-pointer hover:underline"
              title="Click to rename"
            >
              {list.name}
            </h1>
          )}
          <span
            className={cn(
              'shrink-0 text-xs font-medium rounded-full px-2 py-0.5',
              atCap
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-ga-accent/20 text-ga-accent',
            )}
          >
            {itemCount}/{MAX_ITEMS_PER_LIST}
          </span>
        </div>
        <button
          onClick={handleDeleteList}
          className="px-3 py-1.5 text-xs border border-ga-border rounded-md text-red-400 hover:bg-red-500/10"
        >
          Delete list
        </button>
      </div>

      {/* Trip notes — plus-tier (gated by `trip_notes` tool) */}
      {tripNotesEnabled && (
        <div className="mb-4 rounded-lg border border-ga-border bg-ga-bg-card p-3">
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Trip notes (e.g. 'Remember to check coupons; Mum wants the small carton')"
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-ga-text-secondary">
                  {notesDraft.length}/1000
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesDraft(list.notes || '');
                    }}
                    className="px-3 py-1 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      updateMutation.mutate(
                        { listId: listId!, patch: { notes: notesDraft } },
                        { onSuccess: () => setEditingNotes(false) },
                      );
                    }}
                    disabled={updateMutation.isPending}
                    className="px-3 py-1 text-xs font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving…' : 'Save notes'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                setNotesDraft(list.notes || '');
                setEditingNotes(true);
              }}
              className="flex items-start gap-2 cursor-pointer hover:bg-ga-bg-hover -m-3 p-3 rounded-lg"
              title="Click to edit"
            >
              <span className="text-base shrink-0">📝</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-ga-text-secondary mb-0.5">Trip notes</div>
                {list.notes ? (
                  <p className="text-sm text-ga-text-primary whitespace-pre-wrap">{list.notes}</p>
                ) : (
                  <p className="text-sm text-ga-text-secondary italic">
                    Click to add notes for this trip…
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk add from receipt — plus-tier; ScanReceiptButton handles its
          own tier check + upgrade banner so we don't need to gate here. */}
      <div className="mb-4">
        <ScanReceiptButton
          destination="shopping_list"
          listId={listId}
          pageKey="shopping_lists"
        />
      </div>

      {/* Add row — three entry points */}
      <AddItemRow
        listId={listId}
        atCap={atCap}
        onScanClick={() => setScannerOpen(true)}
      />

      {/* Items */}
      {items.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Nothing on the list yet"
          subtitle="Add manually, browse catalog, or scan."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const showAddPrice = addPriceForId === item.id;
            const itemName = item.item_name || item.itemName || '(unnamed)';
            const dim = itemDimensionLabel(item);
            const lo = lowestPrice(item.prices);
            const priceCount = (item.prices ?? []).length;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-ga-border bg-ga-bg-card"
              >
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ga-text-primary truncate">
                      {itemName}
                    </div>
                    <div className="text-xs text-ga-text-secondary mt-0.5">
                      {dim && <span>{dim}</span>}
                      {dim && lo && <span> · </span>}
                      {lo && (
                        <span>
                          best: <span className="text-ga-accent">{lo.currency} {lo.price.toFixed(2)}</span>
                          {lo.brand && ` (${lo.brand})`}
                        </span>
                      )}
                      {priceCount > 0 && (
                        <span className="ml-2 text-ga-text-secondary/70">
                          · {priceCount} price{priceCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startBuy(item)}
                      title="Buy this item"
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white"
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      title="Remove"
                      className="px-2 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      title="Toggle price comparison"
                      className="px-2 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-secondary hover:bg-ga-bg-hover"
                    >
                      {expanded ? '▴' : '▾'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-ga-border px-3 py-2 space-y-2 bg-ga-bg-primary/30">
                    {(item.prices ?? []).length === 0 && !showAddPrice && (
                      <p className="text-xs text-ga-text-secondary">No price comparisons yet.</p>
                    )}
                    {(item.prices ?? []).length > 0 && (
                      <table className="w-full text-xs">
                        <thead className="text-ga-text-secondary">
                          <tr>
                            <th className="text-left font-normal py-1">Brand</th>
                            <th className="text-left font-normal py-1">Store</th>
                            <th className="text-right font-normal py-1">Price</th>
                            <th className="text-left font-normal py-1 pl-2">Barcode</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {[...(item.prices ?? [])]
                            .sort((a, b) => a.price - b.price)
                            .map((p) => (
                              <tr key={p.id} className="border-t border-ga-border/60">
                                <td className="py-1.5 text-ga-text-primary">
                                  {p.brand || '—'}
                                </td>
                                <td className="py-1.5 text-ga-text-secondary">
                                  {p.store_name || '—'}
                                </td>
                                <td className="py-1.5 text-right text-ga-accent font-medium">
                                  {p.currency} {p.price.toFixed(2)}
                                </td>
                                <td className="py-1.5 pl-2 font-mono text-ga-text-secondary">
                                  {p.barcode || '—'}
                                </td>
                                <td className="py-1.5 text-right">
                                  <button
                                    onClick={() =>
                                      deletePriceMutation.mutate({
                                        listId: listId!,
                                        itemId: item.id,
                                        priceId: p.id,
                                      })
                                    }
                                    title="Remove price"
                                    className="text-ga-text-secondary hover:text-red-400 px-1"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                    {showAddPrice ? (
                      <AddPriceInlineForm
                        listId={listId}
                        itemId={item.id}
                        onClose={() => setAddPriceForId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setAddPriceForId(item.id)}
                        disabled={(item.prices ?? []).length >= 10}
                        className="text-xs text-ga-accent hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        + Add price comparison{(item.prices ?? []).length >= 10 && ' (max 10)'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scanner — uses the existing 'shopping-lists' context branch */}
      <ContextualScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />

      {/* Buy flow — price picker (only when >1 prices) */}
      {pricePickerForItem && (
        <PricePickerDialog
          itemName={pricePickerForItem.item_name || pricePickerForItem.itemName || ''}
          prices={pricePickerForItem.prices || []}
          onPick={handlePricePicked}
          onCancel={() => {
            setPricePickerForItem(null);
            setBuyTarget(null);
          }}
        />
      )}

      {/* Buy flow — QuickAddModal with prefilled defaults */}
      <QuickAddModal
        open={quickAddDefaults !== null}
        onClose={handleQuickAddClose}
        defaults={quickAddDefaults || undefined}
        onSaved={handleQuickAddSaved}
      />
    </div>
  );
}
