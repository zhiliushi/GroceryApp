import { useState, useCallback, useEffect, useRef } from 'react';
import { useScanBarcode } from '@/api/mutations/useBarcodeMutations';
import { useScannerEngine } from './useScannerEngine';
import ProductResultCard from './ProductResultCard';
import ContributeProductForm from './ContributeProductForm';
import type { BarcodeProduct } from '@/types/api';

type Step = 'scanning' | 'looking_up' | 'found' | 'not_found' | 'contributing' | 'error';

interface BarcodeScannerModalProps {
  onClose: () => void;
  onAddedToInventory?: () => void;
}

export default function BarcodeScannerModal({ onClose, onAddedToInventory }: BarcodeScannerModalProps) {
  const [step, setStep] = useState<Step>('scanning');
  const [product, setProduct] = useState<BarcodeProduct | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [helpHint, setHelpHint] = useState(false);
  const [addingInventory, setAddingInventory] = useState(false);

  const scanMutation = useScanBarcode();
  const scanner = useScannerEngine();
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Start scanning when modal opens
  useEffect(() => {
    if (scanner.engine !== 'manual') {
      scanner.startScanning(handleDetected);
    }
    // Show help hint after 30 seconds of no detection
    hintTimerRef.current = setTimeout(() => setHelpHint(true), 30_000);

    return () => {
      scanner.stopScanning();
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDetected = useCallback(async (barcode: string) => {
    setScannedBarcode(barcode);
    setStep('looking_up');
    setHelpHint(false);

    try {
      const result = await scanMutation.mutateAsync(barcode);
      setProduct(result);
      setStep(result.found ? 'found' : 'not_found');
    } catch {
      setStep('error');
    }
  }, [scanMutation]);

  const handleManualLookup = useCallback(() => {
    const barcode = manualInput.trim();
    if (barcode.length < 4) return;
    handleDetected(barcode);
  }, [manualInput, handleDetected]);

  const handleScanAgain = useCallback(() => {
    setProduct(null);
    setScannedBarcode('');
    setStep('scanning');
    setHelpHint(false);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHelpHint(true), 30_000);
    if (scanner.engine !== 'manual') {
      scanner.startScanning(handleDetected);
    }
  }, [scanner, handleDetected]);

  const handleAddToInventory = useCallback(async (location: string) => {
    if (!product || !product.found) return;
    setAddingInventory(true);
    try {
      const { apiClient } = await import('@/api/client');
      await apiClient.post('/api/receipt/confirm', {
        scan_id: `barcode_${Date.now()}`,
        store_name: null,
        date: null,
        destination: 'inventory',
        items: [{
          name: product.product_name || scannedBarcode,
          price: 0,
          quantity: 1,
          barcode: product.barcode,
          location,
        }],
        total: null,
      });
      onAddedToInventory?.();
      onClose();
    } catch {
      // Keep modal open on error
    } finally {
      setAddingInventory(false);
    }
  }, [product, scannedBarcode, onClose, onAddedToInventory]);

  const handleContributed = useCallback((name: string) => {
    // After contributing, show as "found" with the contributed name
    setProduct({
      barcode: scannedBarcode,
      product_name: name,
      brands: null,
      categories: null,
      image_url: null,
      nutrition_data: null,
      found: true,
      source: 'contributed',
    });
    setStep('found');
  }, [scannedBarcode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ga-text-primary">📷 Scan Barcode</h2>
            <span className="text-[10px] bg-ga-bg-hover text-ga-text-secondary rounded px-1.5 py-0.5">
              {scanner.engine}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-ga-text-secondary hover:text-ga-text-primary text-xl transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Camera viewfinder */}
          {step === 'scanning' && scanner.engine !== 'manual' && !scanner.error && (
            <div className="relative">
              <div
                id={scanner.viewfinderRef}
                className="w-full h-56 bg-black rounded-lg overflow-hidden"
              />
              {scanner.status === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="text-white text-sm animate-pulse">Starting camera...</div>
                </div>
              )}
              {scanner.status === 'scanning' && (
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <span className="bg-black/60 text-white text-xs rounded-full px-3 py-1">
                    Point camera at barcode
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Camera error */}
          {scanner.error && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">📷</div>
              <p className="text-sm text-yellow-400 mb-2">{scanner.error}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => scanner.startScanning(handleDetected)}
                  className="text-xs text-ga-accent hover:underline"
                >
                  Retry
                </button>
                {scanner.engine !== 'manual' && (
                  <button
                    onClick={scanner.switchEngine}
                    className="text-xs text-ga-accent hover:underline"
                  >
                    Try {scanner.engine === 'native' ? 'alternative scanner' : 'manual entry'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Help hint after 30s */}
          {helpHint && step === 'scanning' && (
            <div className="text-xs text-ga-text-secondary text-center bg-ga-bg-hover rounded-lg p-2">
              Having trouble? Hold the barcode closer to the camera, or use manual entry below.
            </div>
          )}

          {/* Manual entry (always visible during scanning) */}
          {(step === 'scanning' || scanner.error || scanner.engine === 'manual') && (
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">
                {scanner.engine === 'manual' ? 'Enter barcode' : 'Or enter manually'}
              </label>
              <div className="flex gap-2">
                <input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualLookup(); }}
                  placeholder="Type barcode number..."
                  className="flex-1 bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary font-mono"
                />
                <button
                  onClick={handleManualLookup}
                  disabled={manualInput.trim().length < 4}
                  className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Look up
                </button>
              </div>
            </div>
          )}

          {/* Looking up */}
          {step === 'looking_up' && (
            <div className="text-center py-6">
              <div className="animate-spin text-3xl mb-2">⏳</div>
              <p className="text-sm text-ga-text-secondary">
                Looking up <code className="font-mono">{scannedBarcode}</code>...
              </p>
            </div>
          )}

          {/* Product found */}
          {step === 'found' && product && (
            <ProductResultCard
              product={product}
              onAddToInventory={handleAddToInventory}
              onScanAgain={handleScanAgain}
              isAdding={addingInventory}
            />
          )}

          {/* Not found */}
          {step === 'not_found' && (
            <div className="space-y-3">
              <div className="bg-ga-bg-hover border border-ga-border rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">🔍</div>
                <p className="text-sm text-ga-text-primary font-medium">Not in our database</p>
                <p className="text-xs text-ga-text-secondary mt-1">
                  Barcode <code className="font-mono">{scannedBarcode}</code> wasn't found in Firebase, contributed products, or Open Food Facts.
                </p>
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setStep('contributing')}
                  className="bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Contribute Product
                </button>
                <button
                  onClick={handleScanAgain}
                  className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors"
                >
                  Scan Again
                </button>
              </div>
            </div>
          )}

          {/* Contributing */}
          {step === 'contributing' && (
            <ContributeProductForm
              barcode={scannedBarcode}
              onContributed={handleContributed}
              onCancel={() => setStep('not_found')}
            />
          )}

          {/* API error */}
          {step === 'error' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">❌</div>
              <p className="text-sm text-red-400">
                {scanMutation.error?.message || 'Failed to look up barcode'}
              </p>
              <div className="flex gap-2 justify-center mt-3">
                <button
                  onClick={() => handleDetected(scannedBarcode)}
                  className="text-sm text-ga-accent hover:underline"
                >
                  Retry
                </button>
                <button
                  onClick={handleScanAgain}
                  className="text-sm text-ga-text-secondary hover:text-ga-text-primary"
                >
                  Scan Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
