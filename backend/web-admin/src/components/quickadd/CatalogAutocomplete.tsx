import { useState, useMemo } from 'react';
import { useCatalog } from '@/api/queries/useCatalog';
import { cn } from '@/utils/cn';
import type { CatalogEntry } from '@/types/api';

interface CatalogAutocompleteProps {
  value: string;
  onChange: (displayName: string, matchedEntry?: CatalogEntry) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Fuzzy autocomplete over the user's personal catalog + (future) global products.
 * Typing a name → matches `name_norm` prefix in the user's catalog.
 * If a match exists, parent gets the CatalogEntry; if not, parent gets just the typed name.
 */
export default function CatalogAutocomplete({
  value,
  onChange,
  placeholder = 'What did you buy?',
  autoFocus = false,
}: CatalogAutocompleteProps) {
  const [focused, setFocused] = useState(false);
  const { data } = useCatalog({ q: value, limit: 10 });

  const suggestions = useMemo(() => {
    if (!data || !value.trim()) return [];
    const q = value.trim().toLowerCase();
    // Client-side sort: exact display_name match first, then starts-with, then contains
    return data.items
      .slice()
      .sort((a, b) => {
        const aExact = a.display_name.toLowerCase() === q;
        const bExact = b.display_name.toLowerCase() === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = a.display_name.toLowerCase().startsWith(q);
        const bStarts = b.display_name.toLowerCase().startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return b.total_purchases - a.total_purchases;
      })
      .slice(0, 5);
  }, [data, value]);

  const showList = focused && suggestions.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)} // allow click-through
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
      />
      {showList && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full bg-ga-bg-card border border-ga-border rounded-md shadow-lg max-h-56 overflow-auto"
        >
          {suggestions.map((entry) => (
            <li
              key={entry.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}  // prevent blur before click
              onClick={() => onChange(entry.display_name, entry)}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer hover:bg-ga-bg-hover flex items-center justify-between',
              )}
            >
              <div>
                <div className="text-ga-text-primary">{entry.display_name}</div>
                <div className="text-xs text-ga-text-secondary">
                  {entry.total_purchases}× bought
                  {entry.barcode && ` · 🏷️ ${entry.barcode}`}
                </div>
              </div>
              {entry.active_purchases > 0 && (
                <span className="text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5">
                  {entry.active_purchases} active
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
