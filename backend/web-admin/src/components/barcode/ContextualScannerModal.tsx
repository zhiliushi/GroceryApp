import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { useAuthStore } from '@/stores/authStore';
import { useConsumeByCatalog } from '@/api/mutations/usePurchaseMutations';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import ScanResultPanel, { type ScanResultAction } from './ScanResultPanel';
import { useScannerEngine } from './useScannerEngine';
import { cn } from '@/utils/cn';
import type { ScanInfo } from '@/types/api';

interface ContextualScannerModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Barcode-first scanner modal for the refactored catalog+purchases model.
 *
 *   camera/manual → detected barcode → useScanInfo → ScanResultPanel →
 *     { add_purchase | mark_used (FIFO) | name_unknown }
 *
 * Context is derived from the current route:
 *   /my-items  → primary action defaults to "mark used"
 *   default     → primary action defaults to "add new purchase"
 */
export default function ContextualScannerModal({ open, onClose }: ContextualScannerModalProps) {
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [quickAddDefaults, setQuickAddDefaults] = useState<
    { name?: string; barcode?: string } | null
  >(null);
  // Plan principle: max 1 modal deep. Instead of opening NameUnknownItemModal
  // on top of this one, we swap this modal's content to a name-entry step.
  const [namingStep, setNamingStep] = useState<{ barcode: string; suggestedName?: string } | null>(
    null,
  );
  const [nameInput, setNameInput] = useState('');

  const uid = useAuthStore((s) => s.user?.uid);
  const location = useLocation();
  const context: 'dashboard' | 'my-items' | 'shopping-lists' | 'catalog' =
    location.pathname.startsWith('/my-items')
      ? 'my-items'
      : location.pathname.startsWith('/shopping-lists')
      ? 'shopping-lists'
      : location.pathname.startsWith('/catalog')
      ? 'catalog'
      : 'dashboard';

  const scanner = useScannerEngine();
  const consumeMutation = useConsumeByCatalog();
  const stoppingRef = useRef(false);
  const scannerRef = useRef(scanner);
  scannerRef.current = scanner;

  // Fetch scan-info once we have a barcode
  const { data: info, isLoading, error } = useQuery<ScanInfo>({
    queryKey: qk.scanInfo(scannedBarcode),
    queryFn: () =>
      apiClient
        .get<ScanInfo>(API.BARCODE_SCAN_INFO(scannedBarcode), {
          params: { user_id: uid || '' },
        })
        .then((r) => r.data),
    enabled: !!scannedBarcode && open,
    staleTime: 30_000,
  });

  const handleDetected = useCallback((barcode: string) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    scannerRef.current.stopScanning();
    setScannedBarcode(barcode);
  }, []);

  // Start camera on open
  useEffect(() => {
    if (!open) return;
    stoppingRef.current = false;
    if (scanner.engine !== 'manual') {
      scanner.startScanning(handleDetected);
    }
    return () => {
      scanner.stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function rescan() {
    setScannedBarcode('');
    setManualInput('');
    stoppingRef.current = false;
    if (scanner.engine !== 'manual') {
      scanner.startScanning(handleDetected);
    }
  }

  function handleManualLookup() {
    const bc = manualInput.trim();
    if (bc.length < 4) return;
    handleDetected(bc);
  }

  function handleAction(action: ScanResultAction) {
    switch (action.kind) {
      case 'add_purchase':
        setQuickAddDefaults({
          name: action.display,
          barcode: action.barcode,
        });
        break;
      case 'mark_used':
        consumeMutation.mutate(
          { catalog_name_norm: action.nameNorm, quantity: 1 },
          { onSuccess: () => onClose() },
        );
        break;
      case 'name_unknown':
        setNamingStep({ barcode: action.barcode, suggestedName: action.suggestedName });
        setNameInput(action.suggestedName ?? '');
        break;
      case 'rescan':
        rescan();
        break;
    }
  }

  if (!open) return null;

  // When QuickAddModal is taking over, hide the scanner modal (close-but-retain-state)
  // so we never stack two modals — plan principle "max 1 deep".
  const scannerHidden = !!quickAddDefaults;

  return (
    <>
      {!scannerHidden && (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] p-4" onClick={onClose}>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-ga-border flex items-center justify-between">
            <h3 className="text-base font-semibold text-ga-text-primary">
              📷 Scan barcode
              <span className="ml-2 text-xs text-ga-text-secondary font-normal">
                context: {context}
              </span>
            </h3>
            <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-xl">
              ✕
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Inline naming step — active when user chose "name_unknown" on an
                unknown barcode. Replaces the previous NameUnknownItemModal
                (plan principle: max 1 modal deep). */}
            {namingStep && (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-ga-text-primary">
                    What do you call this?
                  </div>
                  <div className="text-xs text-ga-text-secondary mt-1">
                    Barcode <span className="font-mono text-ga-text-primary">{namingStep.barcode}</span> isn't in your catalog yet.
                    {namingStep.suggestedName && ` Global DB says "${namingStep.suggestedName}".`}
                  </div>
                </div>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. 'Milk', 'Grandma's jam'"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nameInput.trim().length > 0) {
                      setQuickAddDefaults({ name: nameInput.trim(), barcode: namingStep.barcode });
                      setNamingStep(null);
                    }
                  }}
                  className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setNamingStep(null);
                      setNameInput('');
                    }}
                    className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!nameInput.trim()) return;
                      setQuickAddDefaults({
                        name: nameInput.trim(),
                        barcode: namingStep.barcode,
                      });
                      setNamingStep(null);
                    }}
                    disabled={!nameInput.trim()}
                    className={cn(
                      'px-4 py-1.5 text-sm font-medium rounded-md',
                      nameInput.trim()
                        ? 'bg-ga-accent text-white hover:opacity-90'
                        : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
                    )}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Scanner area — hidden once we have a barcode OR naming step active */}
            {!scannedBarcode && !namingStep && (
              <>
                {scanner.engine !== 'manual' ? (
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
                    <div id="barcode-viewfinder" className="absolute inset-0" />
                    <div className="absolute inset-10 border-2 border-white/60 rounded pointer-events-none" />
                    {scanner.status === 'error' && (
                      <div className="absolute inset-0 flex items-center justify-center text-white text-sm p-4 text-center bg-black/80">
                        Camera unavailable: {scanner.error}
                      </div>
                    )}
                    {scanner.hasTorch && (
                      <button
                        onClick={() => scanner.toggleTorch()}
                        className="absolute top-2 right-2 bg-black/50 text-white text-xs rounded px-2 py-1"
                      >
                        {scanner.torchOn ? '🔦 Torch on' : '🔦 Torch off'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-ga-text-secondary italic">
                    Camera unavailable on this device — enter the barcode manually below.
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs text-ga-text-secondary">
                    Or type / paste barcode manually
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualLookup();
                      }}
                      placeholder="e.g. 9555012345678"
                      className="flex-1 px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary"
                    />
                    <button
                      onClick={handleManualLookup}
                      disabled={manualInput.length < 4}
                      className={cn(
                        'px-4 py-2 text-sm rounded',
                        manualInput.length >= 4
                          ? 'bg-ga-accent text-white'
                          : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
                      )}
                    >
                      Look up
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Result — suppressed during naming step to keep one context visible */}
            {!namingStep && scannedBarcode && isLoading && (
              <div className="text-sm text-ga-text-secondary py-8 text-center animate-pulse">
                Looking up {scannedBarcode}…
              </div>
            )}
            {!namingStep && scannedBarcode && error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm text-red-400">
                Lookup failed: {(error as Error).message}
                <button onClick={rescan} className="ml-2 underline">
                  Rescan
                </button>
              </div>
            )}
            {!namingStep && scannedBarcode && info && (
              <ScanResultPanel info={info} onAction={handleAction} onClose={onClose} context={context} />
            )}
          </div>
        </div>
      </div>
      )}

      {/* QuickAddModal renders ONLY when scanner is hidden — ensures max 1 modal deep. */}
      <QuickAddModal
        open={!!quickAddDefaults}
        onClose={() => {
          setQuickAddDefaults(null);
          onClose();
        }}
        defaults={quickAddDefaults ?? undefined}
      />
    </>
  );
}
