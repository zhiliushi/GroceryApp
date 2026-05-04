import { useState, useMemo, useRef, useEffect } from 'react';
import { useCatalog } from '@/api/queries/useCatalog';
import { useCommonIngredients } from '@/api/queries/useRecipes';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/utils/cn';
import type { CatalogEntry, CommonIngredient } from '@/types/api';

interface Props {
  value: string;
  onChange: (newName: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

type Suggestion =
  | { kind: 'catalog'; entry: CatalogEntry }
  | { kind: 'common'; entry: CommonIngredient }
  | { kind: 'free_text'; text: string };

type MatchStatus =
  | { kind: 'catalog'; displayName: string }
  | { kind: 'common'; displayName: string }
  | { kind: 'free_text' }
  | { kind: 'empty' };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Recipe-form ingredient autocomplete. Combines the user's personal catalog
 * (priced products) with the curated common-ingredients seed (generic
 * recipe building blocks like "egg", "santan", "kicap manis"). Inline
 * match-status below the row tells the cook whether the typed name will
 * resolve at save-time and to what.
 *
 * NOTE: this only drives the *display* / hint. The authoritative auto-match
 * still runs server-side at save time (Phase 0). The component just makes
 * the future resolution visible while the cook is typing.
 */
export default function IngredientAutocomplete({
  value,
  onChange,
  placeholder = 'Ingredient name',
  autoFocus = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebouncedValue(value, 200);

  const { data: catalogData } = useCatalog({ q: debounced, limit: 8 });
  const { data: commonData } = useCommonIngredients();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const blurTimer = useRef<number | null>(null);

  // Close the dropdown when the user clicks anywhere outside this wrapper.
  // Without this, clicking another input still inside the form leaves the
  // previous row's dropdown open long enough to intercept pointer events.
  useEffect(() => {
    if (!focused) return;
    function onDocPointerDown(ev: MouseEvent) {
      const target = ev.target as Node | null;
      if (target && wrapperRef.current && !wrapperRef.current.contains(target)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, [focused]);

  // Resolve match status — client-side mirror of Phase-0 server logic.
  // Server is the source of truth at save time; this is just a hint.
  const matchStatus = useMemo<MatchStatus>(() => {
    const q = norm(value);
    if (!q) return { kind: 'empty' };

    const catalogHit = catalogData?.items.find(
      (e) => norm(e.display_name) === q || e.name_norm === q,
    );
    if (catalogHit) return { kind: 'catalog', displayName: catalogHit.display_name };

    const commonHit = commonData?.items.find(
      (e) =>
        norm(e.display_name) === q ||
        e.name_norm === q ||
        (e.aliases || []).some((a) => norm(a) === q),
    );
    if (commonHit) return { kind: 'common', displayName: commonHit.display_name };

    return { kind: 'free_text' };
  }, [value, catalogData, commonData]);

  // Build sectioned suggestions. Each section is independently top-5
  // sorted; combined into a flat list for keyboard traversal.
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = norm(value);
    if (!q) return [];

    const catalogMatches: Suggestion[] = (catalogData?.items || [])
      .slice()
      .sort((a, b) => {
        const aN = norm(a.display_name);
        const bN = norm(b.display_name);
        const aExact = aN === q;
        const bExact = bN === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = aN.startsWith(q);
        const bStarts = bN.startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return b.total_purchases - a.total_purchases;
      })
      .slice(0, 5)
      .map((entry) => ({ kind: 'catalog' as const, entry }));

    const commonMatches: Suggestion[] = (commonData?.items || [])
      .filter((e) => {
        const dn = norm(e.display_name);
        const nn = e.name_norm;
        const aliasHit = (e.aliases || []).some((a) => norm(a).includes(q));
        return dn.includes(q) || nn.includes(q) || aliasHit;
      })
      .slice()
      .sort((a, b) => {
        const aN = norm(a.display_name);
        const bN = norm(b.display_name);
        const aExact = aN === q;
        const bExact = bN === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = aN.startsWith(q);
        const bStarts = bN.startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return aN.localeCompare(bN);
      })
      .slice(0, 5)
      .map((entry) => ({ kind: 'common' as const, entry }));

    // Filter out duplicates: if catalog has same name_norm as a common entry,
    // catalog wins (the user's priced product is more specific).
    const catalogNorms = new Set(catalogMatches.map((s) =>
      s.kind === 'catalog' ? s.entry.name_norm : '',
    ));
    const commonDeduped = commonMatches.filter(
      (s) => s.kind !== 'common' || !catalogNorms.has(s.entry.name_norm),
    );

    const out: Suggestion[] = [...catalogMatches, ...commonDeduped];

    // Always offer "use as free text" when nothing matches exactly.
    const hasExact = out.some((s) => {
      const dn =
        s.kind === 'catalog' ? norm(s.entry.display_name) :
        s.kind === 'common' ? norm(s.entry.display_name) : '';
      return dn === q;
    });
    if (!hasExact) {
      out.push({ kind: 'free_text', text: value.trim() });
    }
    return out;
  }, [value, catalogData, commonData]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlight(0);
  }, [suggestions.length]);

  const showList = focused && suggestions.length > 0;

  function commit(s: Suggestion) {
    if (s.kind === 'catalog') onChange(s.entry.display_name);
    else if (s.kind === 'common') onChange(s.entry.display_name);
    else onChange(s.text);
    setFocused(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = suggestions[highlight];
      if (s) commit(s);
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  // Section split for rendering — preserve order
  const catalogSection = suggestions.filter((s) => s.kind === 'catalog');
  const commonSection = suggestions.filter((s) => s.kind === 'common');
  const freeText = suggestions.find((s) => s.kind === 'free_text') as
    | Extract<Suggestion, { kind: 'free_text' }>
    | undefined;

  // Index helpers for highlight
  function indexOfSuggestion(s: Suggestion): number {
    return suggestions.indexOf(s);
  }

  return (
    <div ref={wrapperRef} className="flex-1 min-w-0 relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (blurTimer.current) {
            window.clearTimeout(blurTimer.current);
            blurTimer.current = null;
          }
          setFocused(true);
        }}
        onBlur={() => {
          // delay so click on a list item lands first
          blurTimer.current = window.setTimeout(() => setFocused(false), 130);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        className="flex-1 w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-1.5 text-sm text-ga-text-primary"
      />

      {/* Inline match-status hint — visible whenever there's a typed value */}
      {matchStatus.kind !== 'empty' && (
        <MatchHint status={matchStatus} />
      )}

      {showList && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full min-w-[18rem] bg-ga-bg-card border border-ga-border rounded-lg shadow-lg max-h-72 overflow-auto text-sm"
        >
          {catalogSection.length > 0 && (
            <li className="px-3 py-1 text-[10px] uppercase tracking-wide text-ga-text-secondary bg-ga-bg-hover/40">
              Your catalog
            </li>
          )}
          {catalogSection.map((s) => {
            if (s.kind !== 'catalog') return null;
            const idx = indexOfSuggestion(s);
            return (
              <li
                key={`cat-${s.entry.id}`}
                role="option"
                aria-selected={idx === highlight}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(s)}
                className={cn(
                  'px-3 py-1.5 cursor-pointer flex items-center justify-between',
                  idx === highlight ? 'bg-ga-bg-hover' : 'hover:bg-ga-bg-hover',
                )}
              >
                <span className="text-ga-text-primary truncate">
                  ✓ {s.entry.display_name}
                </span>
                <span className="text-[10px] text-ga-text-secondary flex-shrink-0 ml-2">
                  {s.entry.total_purchases}× bought
                </span>
              </li>
            );
          })}

          {commonSection.length > 0 && (
            <li className="px-3 py-1 text-[10px] uppercase tracking-wide text-ga-text-secondary bg-ga-bg-hover/40 border-t border-ga-border/40">
              Common ingredients
            </li>
          )}
          {commonSection.map((s) => {
            if (s.kind !== 'common') return null;
            const idx = indexOfSuggestion(s);
            return (
              <li
                key={`com-${s.entry.name_norm}`}
                role="option"
                aria-selected={idx === highlight}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(s)}
                className={cn(
                  'px-3 py-1.5 cursor-pointer flex items-center justify-between',
                  idx === highlight ? 'bg-ga-bg-hover' : 'hover:bg-ga-bg-hover',
                )}
              >
                <span className="text-ga-text-primary truncate">
                  ◉ {s.entry.display_name}
                </span>
                {s.entry.default_category && (
                  <span className="text-[10px] text-ga-text-secondary flex-shrink-0 ml-2">
                    {s.entry.default_category}
                  </span>
                )}
              </li>
            );
          })}

          {freeText && (
            <li
              role="option"
              aria-selected={indexOfSuggestion(freeText) === highlight}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlight(indexOfSuggestion(freeText))}
              onClick={() => commit(freeText)}
              className={cn(
                'px-3 py-1.5 cursor-pointer text-ga-text-secondary italic border-t border-ga-border/40',
                indexOfSuggestion(freeText) === highlight
                  ? 'bg-ga-bg-hover'
                  : 'hover:bg-ga-bg-hover',
              )}
            >
              ⊘ Use as free text: "{freeText.text}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function MatchHint({ status }: { status: MatchStatus }) {
  if (status.kind === 'empty') return null;
  if (status.kind === 'catalog') {
    return (
      <div className="text-[10px] text-green-400 mt-0.5 truncate">
        ✓ catalog: {status.displayName}
      </div>
    );
  }
  if (status.kind === 'common') {
    return (
      <div className="text-[10px] text-blue-400 mt-0.5 truncate">
        ◉ common: {status.displayName}
      </div>
    );
  }
  return (
    <div className="text-[10px] text-ga-text-secondary mt-0.5 italic">
      ⊘ free text
    </div>
  );
}
