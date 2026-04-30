import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from '@/api/queries/useCatalog';
import {
  useCatalogSimilar,
  useTransferExecute,
  useTransferPreview,
} from '@/api/queries/useCatalogTransfer';
import { cn } from '@/utils/cn';
import type { CatalogEntry, SimilarCatalogMatch } from '@/types/api';

interface Props {
  open: boolean;
  source: CatalogEntry;
  onClose: () => void;
}

type Step = 'pick_dst' | 'preview' | 'confirm' | 'done';

/**
 * 3-step transfer wizard (catalog_evolution.md §6.2):
 *   1. Pick destination (similar matches first, then catalog list, with search)
 *   2. Preview (event count, unit-mismatch warning, quota release note)
 *   3. Confirm (typed phrase optional — UI gates with explicit click)
 */
export default function TransferHistoryFlow({ open, source, onClose }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('pick_dst');
  const [search, setSearch] = useState('');
  const [dst, setDst] = useState<SimilarCatalogMatch | null>(null);

  const similar = useCatalogSimilar(search, source.name_norm);
  const allCatalog = useCatalog({ q: search, limit: 30 });
  const previewMutation = useTransferPreview();
  const executeMutation = useTransferExecute();

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('pick_dst');
      setSearch('');
      setDst(null);
      previewMutation.reset();
      executeMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // Build candidate list: similar matches first (deduped against catalog rows),
  // then any catalog rows the user types ahead.
  const candidateMap = new Map<string, SimilarCatalogMatch>();
  for (const m of similar.data ?? []) {
    if (m.name_norm !== source.name_norm) candidateMap.set(m.name_norm, m);
  }
  for (const c of allCatalog.data?.items ?? []) {
    if (c.name_norm === source.name_norm) continue;
    if (!candidateMap.has(c.name_norm)) {
      candidateMap.set(c.name_norm, {
        name_norm: c.name_norm,
        display_name: c.display_name,
        barcode: c.barcode,
        catalog_mode: undefined,
        total_purchases: c.total_purchases,
        active_purchases: c.active_purchases,
        last_purchased_at: c.last_purchased_at ?? null,
        score: 0,
      });
    }
  }
  const candidates = Array.from(candidateMap.values()).sort(
    (a, b) => -(a.score - b.score),
  );

  function chooseDst(c: SimilarCatalogMatch) {
    setDst(c);
    setStep('preview');
    previewMutation.mutate({ src: source.name_norm, dst: c.name_norm });
  }

  function confirm() {
    if (!dst) return;
    executeMutation.mutate(
      { src: source.name_norm, dst: dst.name_norm },
      {
        onSuccess: () => {
          setStep('done');
          // Hop to the destination after a beat so the toast lands first.
          setTimeout(() => {
            navigate(`/catalog/${dst.name_norm}`);
            onClose();
          }, 400);
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-ga-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-ga-text-primary">
              Transfer history — Step {step === 'pick_dst' ? 1 : step === 'preview' ? 2 : 3}/3
            </h3>
            <p className="text-xs text-ga-text-secondary mt-0.5">
              From <strong>{source.display_name}</strong>
              {dst && <> → <strong>{dst.display_name}</strong></>}
            </p>
          </div>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary">
            ✕
          </button>
        </div>

        {step === 'pick_dst' && (
          <div className="px-5 py-4 space-y-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destination catalog…"
              autoFocus
              className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary"
            />
            <div className="max-h-72 overflow-y-auto -mx-5 px-5 space-y-1">
              {candidates.length === 0 ? (
                <p className="text-xs text-ga-text-secondary italic py-3 text-center">
                  No candidates. Type to search your catalog.
                </p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.name_norm}
                    onClick={() => chooseDst(c)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-ga-bg-hover"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-ga-text-primary">{c.display_name}</span>
                      {c.score > 0 && (
                        <span className="text-[10px] text-ga-text-secondary">
                          similarity {(c.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ga-text-secondary">
                      {c.total_purchases}× bought
                      {c.barcode && ` · ${c.barcode}`}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="px-5 py-4 space-y-3">
            {previewMutation.isPending && (
              <p className="text-sm text-ga-text-secondary">Computing preview…</p>
            )}
            {previewMutation.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm text-red-400">
                {(previewMutation.error as Error).message}
              </div>
            )}
            {previewMutation.data && (
              <>
                <div className="bg-ga-bg-hover/30 rounded p-3 space-y-1 text-sm">
                  <Row k="Events to move" v={previewMutation.data.event_count} />
                  <Row k="With recorded price" v={previewMutation.data.with_price_count} />
                  <Row k="Waste records" v={previewMutation.data.with_waste_count} />
                  {previewMutation.data.would_release_quota && (
                    <Row k="Frees catalog slot" v="Yes (source was user_custom)" />
                  )}
                </div>
                {previewMutation.data.base_unit_label_mismatch && (
                  <div className="bg-orange-500/10 border border-orange-500/40 rounded p-3 text-xs text-orange-400">
                    ⚠ Unit mismatch: source uses{' '}
                    <strong>{previewMutation.data.src_base_unit_label}</strong> · destination uses{' '}
                    <strong>{previewMutation.data.dst_base_unit_label}</strong>. Per-unit prices
                    will be inconsistent after the merge — continue only if intentional.
                  </div>
                )}
                <p className="text-xs text-ga-text-secondary">
                  Source row will be soft-deleted. Reversible for 7 days from Settings.
                </p>
              </>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="px-5 py-6 text-center">
            <div className="text-4xl mb-2">✓</div>
            <p className="text-sm text-ga-text-primary">Transfer complete</p>
          </div>
        )}

        <div className="px-5 py-3 border-t border-ga-border flex items-center justify-between">
          {step === 'preview' ? (
            <>
              <button
                onClick={() => {
                  setStep('pick_dst');
                  setDst(null);
                }}
                className="text-xs text-ga-text-secondary hover:underline"
              >
                ← Pick another
              </button>
              <button
                onClick={confirm}
                disabled={!previewMutation.data || executeMutation.isPending}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded',
                  previewMutation.data && !executeMutation.isPending
                    ? 'bg-ga-accent text-white hover:opacity-90'
                    : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
                )}
              >
                {executeMutation.isPending ? 'Transferring…' : 'Confirm transfer'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number | string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ga-text-secondary">{k}</span>
      <span className="text-ga-text-primary tabular-nums">{v}</span>
    </div>
  );
}
