import { useState, useRef } from 'react';
import { useScanShelfAudit } from '@/api/mutations/useScanMutations';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import type { ShelfAuditResult } from '@/types/api';

interface ShelfAuditModalProps {
  onClose: () => void;
}

export default function ShelfAuditModal({ onClose }: ShelfAuditModalProps) {
  const [result, setResult] = useState<ShelfAuditResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanMutation = useScanShelfAudit();

  const handleFile = async (file: File) => {
    try {
      const res = await scanMutation.mutateAsync(file);
      setResult(res);
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <h2 className="text-lg font-semibold text-ga-text-primary">📷 Shelf Audit</h2>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Upload */}
          {!result && (
            <div>
              <p className="text-xs text-ga-text-secondary mb-3">
                Take a photo of your fridge shelf or pantry. The app reads product labels and matches them against your inventory.
              </p>
              <div
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-ga-border hover:border-ga-accent/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                <div className="text-3xl mb-2">{scanMutation.isPending ? '⏳' : '📷'}</div>
                <p className="text-sm text-ga-text-primary">{scanMutation.isPending ? 'Analyzing shelf...' : 'Tap to take shelf photo'}</p>
              </div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>
          )}

          {/* Results */}
          {result && (
            <>
              <div className={cn('rounded-lg px-3 py-2 text-sm',
                result.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
              )}>
                {result.message}
              </div>

              {/* Matched */}
              {result.results.matched.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-green-400 uppercase mb-1.5">
                    ✅ Found in Inventory ({result.results.matched.length})
                  </h3>
                  <div className="space-y-1">
                    {result.results.matched.map((m, i) => (
                      <div key={i} className={cn('flex items-center gap-2 text-xs px-2 py-1.5 rounded',
                        m.is_expired ? 'bg-red-500/5' : m.is_expiring ? 'bg-orange-500/5' : 'bg-green-500/5'
                      )}>
                        <span>{m.is_expired ? '🔴' : m.is_expiring ? '⚠️' : '✅'}</span>
                        <span className="text-ga-text-primary font-medium flex-1">"{m.text}"</span>
                        <span className="text-ga-text-secondary">→ {m.item_name} ({m.item_location})</span>
                        {m.item_id && (
                          <Link to={`/inventory/${m.item_user_id}/${m.item_id}`} onClick={onClose}
                            className="text-ga-accent hover:underline">View</Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown */}
              {result.results.unknown.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-yellow-400 uppercase mb-1.5">
                    ❓ Not in Inventory ({result.results.unknown.length})
                  </h3>
                  <div className="space-y-1">
                    {result.results.unknown.map((u, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-2 py-1.5 bg-yellow-500/5 rounded">
                        <span>❓</span>
                        <span className="text-ga-text-primary flex-1">"{u.text}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ignored */}
              {result.results.ignored.length > 0 && (
                <details className="text-xs">
                  <summary className="text-ga-text-secondary cursor-pointer">
                    {result.results.ignored.length} text regions ignored (generic text)
                  </summary>
                  <div className="mt-1 space-y-0.5">
                    {result.results.ignored.map((ig, i) => (
                      <div key={i} className="text-ga-text-secondary/50 px-2">"{ig.text}" — {ig.reason}</div>
                    ))}
                  </div>
                </details>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setResult(null)}
                  className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2">
                  Scan Another Shelf
                </button>
                <button onClick={onClose}
                  className="text-sm text-ga-text-secondary hover:text-ga-text-primary">
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
