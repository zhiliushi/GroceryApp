import { useState, useEffect } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/utils/cn';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebouncedValue(localValue, debounceMs);

  useEffect(() => {
    onChange(debouncedValue);
  }, [debouncedValue, onChange]);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className={cn('bg-ga-bg-card border border-ga-border rounded-lg px-4 py-2', className)}>
      <div className="flex items-center gap-2">
        <span className="text-ga-text-secondary text-sm">&#x1F50D;</span>
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onChange(localValue);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-ga-text-primary placeholder:text-gray-600 outline-none"
        />
        {localValue && (
          <button
            onClick={() => {
              setLocalValue('');
              onChange('');
            }}
            className="text-ga-text-secondary hover:text-ga-text-primary text-xs transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
