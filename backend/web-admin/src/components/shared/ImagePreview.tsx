import { useState } from 'react';
import { cn } from '@/utils/cn';

interface ImagePreviewProps {
  src: string | null | undefined;
  alt?: string;
  size?: number;
  className?: string;
  variant?: 'table' | 'form';
}

export default function ImagePreview({ src, alt = '', size = 36, className, variant = 'table' }: ImagePreviewProps) {
  const [error, setError] = useState(false);

  if (variant === 'form') {
    return (
      <div className={cn('w-[120px] h-[120px] rounded-lg border border-ga-border overflow-hidden flex items-center justify-center', className)}>
        {src && !error ? (
          <img src={src} alt={alt} onError={() => setError(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-ga-text-secondary/50">
            <span className="text-2xl">&#x1F4F7;</span>
            <span className="text-xs mt-1">No image</span>
          </div>
        )}
      </div>
    );
  }

  // Table variant
  return (
    <div
      className={cn('flex items-center justify-center flex-shrink-0 rounded-md overflow-hidden bg-ga-bg-hover', className)}
      style={{ width: size, height: size }}
    >
      {src && !error ? (
        <img src={src} alt={alt} onError={() => setError(true)} className="w-full h-full object-cover" />
      ) : (
        <span className="text-ga-text-secondary/50 text-sm">&#x1F4F7;</span>
      )}
    </div>
  );
}
