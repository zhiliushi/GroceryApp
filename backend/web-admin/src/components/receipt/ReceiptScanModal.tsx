import { useState, useCallback } from 'react';
import { useScanReceipt, useConfirmReceipt } from '@/api/mutations/useOcrMutations';
import ReceiptUploadStep from './ReceiptUploadStep';
import ReceiptConfirmStep from './ReceiptConfirmStep';
import type { ReceiptScanResult, ReceiptConfirmRequest } from '@/types/api';

type Step = 'upload' | 'processing' | 'confirm' | 'error';

interface ReceiptScanModalProps {
  destination: 'inventory' | 'shopping_list' | 'price_only';
  listId?: string;
  onClose: () => void;
}

export default function ReceiptScanModal({ destination, listId, onClose }: ReceiptScanModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const scanMutation = useScanReceipt();
  const confirmMutation = useConfirmReceipt();

  const handleUpload = useCallback(async (file: File) => {
    setSelectedFile(file);
    setStep('processing');

    try {
      const result = await scanMutation.mutateAsync(file);
      setScanResult(result);
      if (result.success && result.items.length > 0) {
        setStep('confirm');
        setHasUnsaved(true);
      } else if (result.success && result.items.length === 0) {
        setStep('error'); // no items parsed — show with raw text
      } else {
        setStep('error');
      }
    } catch {
      setStep('error');
    }
  }, [scanMutation]);

  const handleConfirm = useCallback(async (data: ReceiptConfirmRequest) => {
    try {
      await confirmMutation.mutateAsync(data);
      setHasUnsaved(false);
      onClose();
    } catch {
      // Keep modal open — error shown via mutation state
    }
  }, [confirmMutation, onClose]);

  const handleRetry = useCallback(() => {
    setScanResult(null);
    setSelectedFile(null);
    setStep('upload');
    setHasUnsaved(false);
  }, []);

  const handleClose = useCallback(() => {
    if (hasUnsaved) {
      if (!window.confirm('You have unreviewed receipt items. Close anyway?')) return;
    }
    onClose();
  }, [hasUnsaved, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <h2 className="text-lg font-semibold text-ga-text-primary flex items-center gap-2">
            <span>🧾</span>
            {step === 'upload' && 'Scan Receipt'}
            {step === 'processing' && 'Processing...'}
            {step === 'confirm' && 'Review Items'}
            {step === 'error' && 'Scan Result'}
          </h2>
          <button
            onClick={handleClose}
            className="text-ga-text-secondary hover:text-ga-text-primary text-xl transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'upload' && (
            <ReceiptUploadStep onUpload={handleUpload} />
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-ga-text-secondary text-sm">
                Processing receipt{selectedFile ? ` (${(selectedFile.size / 1024).toFixed(0)}KB)` : ''}...
              </p>
              <p className="text-ga-text-secondary text-xs mt-1">
                Trying providers in priority order
              </p>
            </div>
          )}

          {step === 'confirm' && scanResult && (
            <ReceiptConfirmStep
              scanResult={scanResult}
              destination={destination}
              listId={listId}
              onConfirm={handleConfirm}
              onRetry={handleRetry}
              isConfirming={confirmMutation.isPending}
              confirmError={confirmMutation.error?.message ?? null}
            />
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              {scanResult?.success && scanResult.items.length === 0 ? (
                <>
                  <div className="text-4xl mb-3">📄</div>
                  <h3 className="text-ga-text-primary font-medium mb-2">No items detected</h3>
                  <p className="text-ga-text-secondary text-sm mb-4">
                    OCR processed the image but couldn't identify any line items.
                  </p>
                  {scanResult.raw_text && (
                    <details className="text-left bg-ga-bg-hover rounded-lg p-3 mb-4">
                      <summary className="text-xs text-ga-text-secondary cursor-pointer">
                        Raw OCR text ({scanResult.provider_used})
                      </summary>
                      <pre className="text-xs mt-2 whitespace-pre-wrap text-ga-text-primary font-mono max-h-48 overflow-y-auto">
                        {scanResult.raw_text}
                      </pre>
                    </details>
                  )}
                </>
              ) : (
                <>
                  <div className="text-4xl mb-3">❌</div>
                  <h3 className="text-ga-text-primary font-medium mb-2">Could not process receipt</h3>
                  <p className="text-ga-text-secondary text-sm mb-4">
                    {scanResult?.error === 'all_providers_failed'
                      ? 'All OCR providers failed. Try a clearer photo.'
                      : scanMutation.error?.message || 'An unexpected error occurred.'}
                  </p>
                  {scanResult?.attempts && scanResult.attempts.length > 0 && (
                    <div className="text-left bg-ga-bg-hover rounded-lg p-3 mb-4">
                      <p className="text-xs text-ga-text-secondary mb-2">Provider attempts:</p>
                      {scanResult.attempts.map((a, i) => (
                        <div key={i} className="text-xs flex items-center gap-2 py-0.5">
                          <span>{a.status === 'success' ? '✓' : a.status === 'skipped' ? '⏭' : '✗'}</span>
                          <span className="font-medium">{a.provider}</span>
                          <span className="text-ga-text-secondary">
                            {a.error_type ? `${a.error_type}: ${a.error_message}` : `${a.duration_ms}ms`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  className="bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
