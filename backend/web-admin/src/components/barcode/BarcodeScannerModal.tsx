import { useState, useCallback, useEffect, useRef } from 'react';
import { useScanBarcode, useAddToInventory } from '@/api/mutations/useBarcodeMutations';
import { useAuthStore } from '@/stores/authStore';
import { useScannerEngine } from './useScannerEngine';
import ProductResultCard from './ProductResultCard';
import ContributeProductForm from './ContributeProductForm';
import { toast } from 'sonner';
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
  const [imageScanning, setImageScanning] = useState(false);

  const scanMutation = useScanBarcode();
  const addMutation = useAddToInventory();
  const scanner = useScannerEngine();
  const uid = useAuthStore((s) => s.user?.uid);

  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Refs to avoid stale closures in scanner callback
  const scanMutationRef = useRef(scanMutation);
  scanMutationRef.current = scanMutation;
  const scannerRef = useRef(scanner);
  scannerRef.current = scanner;
  const stoppingRef = useRef(false);

  const handleDetected = useCallback(async (barcode: string) => {
    // Prevent double-detection race
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    // Stop camera immediately
    scannerRef.current.stopScanning();

    setScannedBarcode(barcode);
    setStep('looking_up');
    setHelpHint(false);

    try {
      const result = await scanMutationRef.current.mutateAsync(barcode);
      setProduct(result);
      setStep(result.found ? 'found' : 'not_found');
    } catch {
      setStep('error');
    }
  }, []); // stable — no deps, uses refs

  // Start scanning when modal opens (once)
  useEffect(() => {
    if (scanner.engine !== 'manual') {
      scanner.startScanning(handleDetected);
    }
    hintTimerRef.current = setTimeout(() => setHelpHint(true), 30_000);

    return () => {
      scanner.stopScanning();
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualLookup = useCallback(() => {
    const barcode = manualInput.trim();
    if (barcode.length < 4) return;
    handleDetected(barcode);
  }, [manualInput, handleDetected]);

  // Scan barcode from uploaded image
  const handleImageFile = useCallback(async (file: File) => {
    setImageScanning(true);
    try {
      const bitmap = await createImageBitmap(file);

      // Try native BarcodeDetector first
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        const results = await detector.detect(bitmap);
        if (results.length > 0) {
          handleDetected(results[0].rawValue);
          return;
        }
      }

      // Fallback: html5-qrcode scanFile
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode('__barcode-image-scan');
        const result = await scanner.scanFileV2(file, /* showImage */ false);
        if (result?.decodedText) {
          handleDetected(result.decodedText);
          return;
        }
      } catch { /* scanFileV2 throws on no barcode found */ }

      toast.error('No barcode found in image. Try a clearer photo or enter manually.');
    } catch {
      toast.error('Could not read image');
    } finally {
      setImageScanning(false);
    }
  }, [handleDetected]);

  const handleScanAgain = useCallback(() => {
    setProduct(null);
    setScannedBarcode('');
    setStep('scanning');
    setHelpHint(false);
    stoppingRef.current = false;
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHelpHint(true), 30_000);
    if (scanner.engine !== 'manual') {
      scanner.startScanning(handleDetected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanner.engine]);

  const handleAddToInventory = useCallback(async (location: string) => {
    if (!product || !product.found || !uid) return;
    try {
      await addMutation.mutateAsync({
        barcode: product.barcode,
        userId: uid,
        name: product.product_name || scannedBarcode,
        location,
      });
      onAddedToInventory?.();
      onClose();
    } catch {
      // onError toast already shown by mutation
    }
  }, [product, scannedBarcode, uid, addMutation, onClose, onAddedToInventory]);

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
                  onClick={() => { stoppingRef.current = false; scanner.startScanning(handleDetected); }}
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

          {/* Image upload + Manual entry (visible during scanning) */}
          {(step === 'scanning' || scanner.error || scanner.engine === 'manual') && (
            <div className="space-y-3">
              {/* Upload image */}
              <div className="flex gap-2">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageScanning}
                  className="flex-1 border border-dashed border-ga-border hover:border-ga-accent/50 text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-3 py-2 transition-colors"
                >
                  {imageScanning ? '⏳ Scanning image...' : '📁 Upload barcode image'}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }}
                />
              </div>
              {/* Hidden div for html5-qrcode scanFileV2 */}
              <div id="__barcode-image-scan" className="hidden" />
              {/* Manual entry */}
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
              isAdding={addMutation.isPending}
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
                  onClick={() => { stoppingRef.current = false; handleDetected(scannedBarcode); }}
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
