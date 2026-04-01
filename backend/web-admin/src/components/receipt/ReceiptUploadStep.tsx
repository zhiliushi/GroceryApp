import { useState, useCallback, useRef } from 'react';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface ReceiptUploadStepProps {
  onUpload: (file: File) => void;
}

export default function ReceiptUploadStep({ onUpload }: ReceiptUploadStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback((file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) {
      return `Unsupported format: ${file.type || 'unknown'}. Use JPEG or PNG.`;
    }
    if (file.size > MAX_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`;
    }
    if (file.size < 100) {
      return 'File appears empty or too small.';
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onUpload(file);
  }, [validate, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-ga-accent bg-ga-accent/5'
            : 'border-ga-border hover:border-ga-accent/50 hover:bg-ga-bg-hover'
        }`}
      >
        <div className="text-4xl mb-3">📷</div>
        <p className="text-ga-text-primary font-medium mb-1">
          Drop receipt image here
        </p>
        <p className="text-ga-text-secondary text-sm">
          or click to browse — JPEG, PNG, max 5MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
