import { useState } from 'react';
import BarcodeScannerModal from './BarcodeScannerModal';

interface ScanBarcodeButtonProps {
  className?: string;
  onAddedToInventory?: () => void;
}

export default function ScanBarcodeButton({ className, onAddedToInventory }: ScanBarcodeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 border border-ga-border text-ga-text-secondary hover:text-ga-text-primary hover:bg-ga-bg-hover text-sm font-medium rounded-lg px-4 py-2 transition-colors ${className || ''}`}
      >
        <span>📷</span>
        Scan Barcode
      </button>

      {isOpen && (
        <BarcodeScannerModal
          onClose={() => setIsOpen(false)}
          onAddedToInventory={onAddedToInventory}
        />
      )}
    </>
  );
}
