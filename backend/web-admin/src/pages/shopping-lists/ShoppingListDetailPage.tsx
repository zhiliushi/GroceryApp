import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMyShoppingListDetail } from '@/api/queries/useShoppingLists';
import {
  useAddShoppingListItem,
  useAddShoppingListPrice,
  useDeleteShoppingList,
  useDeleteShoppingListItem,
  useDeleteShoppingListPrice,
  usePromoteToAlternative,
  useRenameShoppingList,
  useTickAlternative,
  useUpdateShoppingList,
} from '@/api/mutations/useShoppingListMutations';
import { useVisibility } from '@/hooks/useVisibility';
import ScanReceiptButton from '@/components/receipt/ScanReceiptButton';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import ContextualScannerModal from '@/components/barcode/ContextualScannerModal';
import AddItemRow from './AddItemRow';
import AddPriceInlineForm from './AddPriceInlineForm';
import CheckoutFooter from './CheckoutFooter';
import { cn } from '@/utils/cn';
import type { ShoppingListItem, ShoppingListPrice } from '@/types/api';

const MAX_PRIMARIES_PER_LIST = 15;
const MAX_ALTERNATIVES_PER_PRIMARY = 3;

function itemDimensionLabel(item: ShoppingListItem): string {
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

function altDisplayLabel(alt: ShoppingListPrice): string {
  return alt.candidate_name || alt.brand || '(unnamed)';
}

function altQtyLabel(alt: ShoppingListPrice): string {
  const parts: string[] = [];
  if (alt.pack_count != null && alt.pack_size != null) {
    parts.push(`${alt.pack_count} × ${alt.pack_size}`);
  } else if (alt.pack_size != null) {
    parts.push(String(alt.pack_size));
  }
  if (alt.weight_value != null && alt.weight_unit) {
    parts.push(`${alt.weight_value}${alt.weight_unit}`);
  }
  if (alt.volume_value != null && alt.volume_unit) {
    parts.push(`${alt.volume_value}${alt.volume_unit}`);
  }
  return parts.join(' · ');
}

function unitMismatch(item: ShoppingListItem, alt: ShoppingListPrice): boolean {
  // F5: highlight unit mismatch first. Compare unit class.
  const primaryClass =
    item.weight_unit ? 'weight' :
    item.volume_unit ? 'volume' :
    item.quantity != null || item.unit ? 'count' :
    null;
  if (!primaryClass) return false;
  const altClass =
    alt.weight_unit ? 'weight' :
    alt.volume_unit ? 'volume' :
    'count';
  return primaryClass !== altClass;
}

export default function ShoppingListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useMyShoppingListDetail(listId);

  const renameMutation = useRenameShoppingList();
  const updateMutation = useUpdateShoppingList();
  const { canUseTool } = useVisibility();
  const tripNotesEnabled = canUseTool('trip_notes');
  const deleteListMutation = useDeleteShoppingList();
  const deleteItemMutation = useDeleteShoppingListItem();
  const deletePriceMutation = useDeleteShoppingListPrice();
  const addItemMutation = useAddShoppingListItem();
  const tickMutation = useTickAlternative();
  const promoteMutation = usePromoteToAlternative();
  const addAltMutation = useAddShoppingListPrice();

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  /** Per-primary collapse state. Primaries with ≥1 alt expand by default. */
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [addAltForId, setAddAltForId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  /** Scanner mode controls how the result is consumed:
   *   'add'     — top scan, adds new primary
   *   'buy'     — top "scan to buy", adds primary + promote + tick
   *   'compare' — per-primary scan, adds new alternative under scanCompareTargetId
   */
  const [scanMode, setScanMode] = useState<'add' | 'buy' | 'compare'>('add');
  const [scanCompareTargetId, setScanCompareTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (data?.list?.name && renameValue === '') {
      setRenameValue(data.list.name);
    }
  }, [data?.list?.name, renameValue]);

  // Listen for scanner-add events. The scanner fires
  // 'grocery:scan-add-to-shopping-list' regardless of mode; the page reads
  // its own scanMode state to route the result. Three flows:
  //   'add'     → add new primary
  //   'buy'     → add new primary + promote-to-alt + auto-tick
  //   'compare' → add as alternative under scanCompareTargetId
  useEffect(() => {
    if (!listId) return;
    type ScanDetail = { barcode: string; nameNorm: string; display: string };
    async function onScanAdd(e: Event) {
      const detail = (e as CustomEvent<ScanDetail>).detail;
      if (!detail?.display) return;
      try {
        if (scanMode === 'compare' && scanCompareTargetId) {
          await addAltMutation.mutateAsync({
            listId: listId!,
            itemId: scanCompareTargetId,
            payload: {
              candidate_name: detail.display,
              barcode: detail.barcode || undefined,
              source_catalog_name_norm: detail.nameNorm || undefined,
            },
          });
        } else if (scanMode === 'buy') {
          const created = await addItemMutation.mutateAsync({
            listId: listId!,
            payload: {
              item_name: detail.display,
              barcode: detail.barcode || undefined,
              source_catalog_name_norm: detail.nameNorm || undefined,
              source: 'scan',
            },
          });
          const itemId = (created as { id?: string })?.id;
          if (!itemId) return;
          const alt = await promoteMutation.mutateAsync({ listId: listId!, itemId });
          const altId = (alt as { id?: string })?.id;
          if (!altId) return;
          await tickMutation.mutateAsync({
            listId: listId!,
            itemId,
            priceId: altId,
            ticked: true,
          });
        } else {
          await addItemMutation.mutateAsync({
            listId: listId!,
            payload: {
              item_name: detail.display,
              barcode: detail.barcode || undefined,
              source_catalog_name_norm: detail.nameNorm || undefined,
              source: 'scan',
            },
          });
        }
      } catch {
        // Errors surface via toast in the underlying mutations.
      } finally {
        // Reset to default after each scan
        setScanMode('add');
        setScanCompareTargetId(null);
      }
    }
    window.addEventListener('grocery:scan-add-to-shopping-list', onScanAdd);
    return () => {
      window.removeEventListener('grocery:scan-add-to-shopping-list', onScanAdd);
    };
  }, [
    listId,
    scanMode,
    scanCompareTargetId,
    addItemMutation,
    addAltMutation,
    promoteMutation,
    tickMutation,
  ]);

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
  const atCap = itemCount >= MAX_PRIMARIES_PER_LIST;

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
    const name = item.item_name || item.itemName;
    if (!confirm(`Remove "${name}" from the list?`)) return;
    deleteItemMutation.mutate({ listId: listId!, itemId: item.id });
  }

  function toggleCollapsed(itemId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  /** Untick all currently-ticked alternatives (Cancel checkout). */
  async function handleCancelCheckout() {
    const tasks: Promise<unknown>[] = [];
    for (const item of items) {
      for (const alt of item.prices ?? []) {
        if (alt.ticked) {
          tasks.push(
            tickMutation.mutateAsync({
              listId: listId!,
              itemId: item.id,
              priceId: alt.id,
              ticked: false,
            }),
          );
        }
      }
    }
    await Promise.allSettled(tasks);
    refetch();
  }

  function handleConfirmedCheckout() {
    refetch();
  }

  function handleTopScanAdd() {
    // Top "Scan" button — adds a new primary
    setScanMode('add');
    setScanCompareTargetId(null);
    setScannerOpen(true);
  }

  function handleTopScanBuy() {
    // Top "Scan to buy" button (per A2 / G1) — adds primary + alt + tick
    setScanMode('buy');
    setScanCompareTargetId(null);
    setScannerOpen(true);
  }

  function handlePerPrimaryScanCompare(itemId: string) {
    // Per-primary 📷 — adds an alternative under that primary (per A2 / G1)
    setScanMode('compare');
    setScanCompareTargetId(itemId);
    setScannerOpen(true);
  }

  return (
    <div className="p-6 pb-32">  {/* extra bottom padding for sticky footer */}
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
            title={`Beta cap: ${MAX_PRIMARIES_PER_LIST} primaries per list`}
          >
            {itemCount}/{MAX_PRIMARIES_PER_LIST}
          </span>
        </div>
        <button
          onClick={handleDeleteList}
          className="px-3 py-1.5 text-xs border border-ga-border rounded-md text-red-400 hover:bg-red-500/10"
        >
          Delete list
        </button>
      </div>

      {/* Trip notes — plus-tier */}
      {tripNotesEnabled && (
        <div className="mb-4 rounded-lg border border-ga-border bg-ga-bg-card p-3">
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Trip notes (e.g. 'Remember to check coupons')"
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-ga-text-secondary">{notesDraft.length}/1000</span>
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

      {/* Bulk add from receipt — plus-tier */}
      <div className="mb-4">
        <ScanReceiptButton
          destination="shopping_list"
          listId={listId}
          pageKey="shopping_lists"
        />
      </div>

      {/* Add row — three entry points (manual / catalog / scan-to-list) */}
      <AddItemRow
        listId={listId}
        atCap={atCap}
        onScanClick={handleTopScanAdd}
      />

      {/* Scan to buy — sibling to the top scan; bypasses planning and goes
          straight to checkout (G1: scan-to-buy mode). */}
      <div className="mb-4">
        <button
          onClick={handleTopScanBuy}
          disabled={atCap}
          title="Scan barcode → add primary + auto-tick into checkout"
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-ga-accent text-ga-accent hover:bg-ga-accent/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          📷 Scan to buy
        </button>
      </div>

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
            const itemName = item.item_name || item.itemName || '(unnamed)';
            const dim = itemDimensionLabel(item);
            const alts = item.prices ?? [];
            const altCount = alts.length;
            const tickedCount = alts.filter((a) => a.ticked).length;
            // Auto-expand if there are alts; user can collapse manually
            const collapsed = collapsedIds.has(item.id);
            const expanded = altCount > 0 ? !collapsed : collapsed;
            // Adapt the chevron sense: "expanded" = show alts row.
            const showRows = altCount === 0 ? !collapsed : !collapsed;
            void expanded;
            const showAddAlt = addAltForId === item.id;
            const altCap = altCount >= MAX_ALTERNATIVES_PER_PRIMARY;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-ga-border bg-ga-bg-card"
              >
                {/* Primary row — NOT tickable per G12 */}
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ga-text-primary truncate flex items-center gap-2">
                      <span>{itemName}</span>
                      {altCount === 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300"
                          title="Add an alternative (or use 'Use as alternative') to checkout this item"
                        >
                          no alt
                        </span>
                      )}
                      {tickedCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
                          {tickedCount} ticked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ga-text-secondary mt-0.5">
                      {dim && <span>{dim}</span>}
                      {dim && altCount > 0 && <span> · </span>}
                      {altCount > 0 && (
                        <span>
                          {altCount}/{MAX_ALTERNATIVES_PER_PRIMARY} alternative{altCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePerPrimaryScanCompare(item.id)}
                      title="Scan barcode → add as alternative under this primary"
                      className="px-2 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-secondary hover:bg-ga-bg-hover"
                    >
                      📷
                    </button>
                    <button
                      onClick={() => setAddAltForId(item.id)}
                      disabled={altCap}
                      title={altCap ? 'Beta cap: 3 alternatives per primary' : 'Add alternative'}
                      className="px-2 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-secondary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      + Alt
                    </button>
                    {altCount === 0 && !altCap && (
                      <button
                        onClick={() =>
                          promoteMutation.mutate({ listId: listId!, itemId: item.id })
                        }
                        title="Use as alternative — quick way to buy this without comparing brands"
                        className="px-2 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
                      >
                        Use as alt
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteItem(item)}
                      title="Remove"
                      className="px-2 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      ✕
                    </button>
                    <button
                      onClick={() => toggleCollapsed(item.id)}
                      title="Toggle"
                      className="px-2 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-secondary hover:bg-ga-bg-hover"
                    >
                      {showRows ? '▴' : '▾'}
                    </button>
                  </div>
                </div>

                {showRows && (
                  <div className="border-t border-ga-border px-3 py-2 space-y-2 bg-ga-bg-primary/30">
                    {alts.length === 0 && !showAddAlt && (
                      <p className="text-xs text-ga-text-secondary">
                        No alternatives yet. Click <strong>+ Alt</strong> to add one,
                        or <strong>Use as alt</strong> to buy this primary as-is.
                      </p>
                    )}
                    {alts.length > 0 && (
                      <ul className="space-y-1">
                        {alts.map((alt) => {
                          const mismatch = unitMismatch(item, alt);
                          const noPrice = alt.price == null;
                          return (
                            <li
                              key={alt.id}
                              className={cn(
                                'flex items-center gap-2 px-2 py-1.5 rounded',
                                alt.ticked && 'bg-green-500/10',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={!!alt.ticked}
                                onChange={(e) =>
                                  tickMutation.mutate({
                                    listId: listId!,
                                    itemId: item.id,
                                    priceId: alt.id,
                                    ticked: e.target.checked,
                                  })
                                }
                                className="accent-ga-accent shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-ga-text-primary truncate">
                                  {altDisplayLabel(alt)}
                                  {alt.auto_promoted && (
                                    <span className="ml-2 text-[10px] text-ga-text-secondary italic">
                                      (auto)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-ga-text-secondary">
                                  {altQtyLabel(alt) && <span>{altQtyLabel(alt)}</span>}
                                  {altQtyLabel(alt) && alt.store_name && <span> · </span>}
                                  {alt.store_name && <span>{alt.store_name}</span>}
                                  {alt.barcode && (
                                    <span className="ml-2 font-mono text-ga-text-secondary/70">
                                      {alt.barcode}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {noPrice && (
                                  <span
                                    title="No price recorded — total estimate excludes this row"
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300"
                                  >
                                    💲 no price
                                  </span>
                                )}
                                {mismatch && (
                                  <span
                                    title="This alternative's unit doesn't match the primary's"
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400"
                                  >
                                    ⚠ unit
                                  </span>
                                )}
                                {alt.price != null && (
                                  <span className="text-sm text-ga-accent font-medium tabular-nums">
                                    {alt.currency} {Number(alt.price).toFixed(2)}
                                  </span>
                                )}
                                <button
                                  onClick={() =>
                                    deletePriceMutation.mutate({
                                      listId: listId!,
                                      itemId: item.id,
                                      priceId: alt.id,
                                    })
                                  }
                                  title="Remove alternative"
                                  className="text-ga-text-secondary hover:text-red-400 px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {showAddAlt ? (
                      <AddPriceInlineForm
                        listId={listId}
                        itemId={item.id}
                        onClose={() => setAddAltForId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setAddAltForId(item.id)}
                        disabled={altCap}
                        className="text-xs text-ga-accent hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        + Add alternative{altCap && ` (max ${MAX_ALTERNATIVES_PER_PRIMARY} — beta)`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky checkout footer */}
      <CheckoutFooter
        listId={listId}
        items={items}
        onCancel={handleCancelCheckout}
        onConfirmed={handleConfirmedCheckout}
      />

      {/* Scanner — context = shopping-lists. Routing of the scan result is
          done in this page's onScanAdd handler based on scanMode (X6). */}
      <ContextualScannerModal
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          // Defer mode reset until the scan handler completes (in finally{})
        }}
      />
    </div>
  );
}
