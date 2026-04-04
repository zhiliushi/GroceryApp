import { useState, useRef } from 'react';
import { useScanExpiryDate } from '@/api/mutations/useScanMutations';
import { toast } from 'sonner';

interface ExpiryScanButtonProps {
  onDateDetected: (isoDate: string) => void;
}

export default function ExpiryScanButton({ onDateDetected }: ExpiryScanButtonProps) {
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanMutation = useScanExpiryDate();

  const handleFile = async (file: File) => {
    setScanning(true);
    try {
      const result = await scanMutation.mutateAsync(file);
      if (result.success && result.date) {
        onDateDetected(result.date);
        toast.success(`Detected: ${result.date}`);
      } else {
        toast.error(result.message || 'No date detected');
      }
    } catch {
      toast.error('Failed to scan expiry date');
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={scanning}
        className="text-xs text-ga-accent hover:underline disabled:opacity-50"
        title="Scan expiry date from product packaging"
      >
        {scanning ? '📷 Scanning...' : '📷 Scan Expiry'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
