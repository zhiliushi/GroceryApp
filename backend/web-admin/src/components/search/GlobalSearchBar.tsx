import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

interface SearchRow {
  kind: 'catalog' | 'purchase' | 'recipe';
  key: string;
  label: string;
  sublabel?: string;
  to: string;
}

/**
 * Global Cmd/Ctrl+K search. Mounted once in AppLayout.
 *
 * Desktop: collapsed to a search chip in the header; expands to a floating
 * panel on focus. Mobile: opened from the speed-dial (uiStore.globalSearchOpen).
 *
 * Results group by kind: Catalog · Active purchases · Recipes. Keyboard arrows
 * navigate; Enter opens the selected result; Escape closes.
 */
export default function GlobalSearchBar() {
  const navigate = useNavigate();
  const { globalSearchOpen, openGlobalSearch, closeGlobalSearch } = useUiStore();
  const [input, setInput] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isFetching } = useGlobalSearch(input);

  // Keyboard shortcut: Cmd/Ctrl+K toggles the search panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openGlobalSearch();
      } else if (e.key === 'Escape' && globalSearchOpen) {
        closeGlobalSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [globalSearchOpen, openGlobalSearch, closeGlobalSearch]);

  // Focus input when panel opens
  useEffect(() => {
    if (globalSearchOpen) {
      setHighlight(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setInput('');
    }
  }, [globalSearchOpen]);

  // Flatten results into a single keyboard-navigable list
  const rows: SearchRow[] = useMemo(() => {
    if (!data) return [];
    const out: SearchRow[] = [];
    for (const c of data.catalog) {
      out.push({
        kind: 'catalog',
        key: `c:${c.id}`,
        label: c.display_name,
        sublabel: `${c.total_purchases ?? 0}× bought${c.barcode ? ` · 🏷️ ${c.barcode}` : ''}`,
        to: `/catalog/${c.name_norm}`,
      });
    }
    for (const e of data.purchases_active) {
      out.push({
        kind: 'purchase',
        key: `p:${e.id}`,
        label: e.catalog_display,
        sublabel: e.expiry_date
          ? `expires ${new Date(e.expiry_date).toLocaleDateString()}`
          : e.location
          ? `📍 ${e.location}`
          : 'active',
        to: `/my-items/${e.id}`,
      });
    }
    for (const r of data.recipes) {
      out.push({
        kind: 'recipe',
        key: `r:${r.id}`,
        label: r.title,
        sublabel: r.cuisine || 'recipe',
        to: `/meals/${r.id}/edit`,
      });
    }
    return out;
  }, [data]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, rows.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter' && rows[highlight]) {
      e.preventDefault();
      pick(rows[highlight]);
    } else if (e.key === 'Escape') {
      closeGlobalSearch();
    }
  }

  function pick(row: SearchRow) {
    closeGlobalSearch();
    navigate(row.to);
  }

  // Collapsed desktop trigger — keeps the top bar clean; clicking expands.
  if (!globalSearchOpen) {
    return (
      <button
        type="button"
        onClick={openGlobalSearch}
        className="hidden md:flex fixed top-4 left-64 z-30 items-center gap-2 px-3 py-1.5 rounded-full bg-ga-bg-card border border-ga-border text-xs text-ga-text-secondary hover:bg-ga-bg-hover"
      >
        <span>🔍</span>
        <span>Search items, recipes…</span>
        <kbd className="ml-2 text-[10px] px-1 py-0.5 rounded border border-ga-border bg-ga-bg-hover">
          Ctrl K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-24"
      onClick={closeGlobalSearch}
    >
      <div
        className="w-full max-w-xl bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ga-border">
          <span className="text-ga-text-secondary">🔍</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search items, recipes, catalog…"
            className="flex-1 bg-transparent text-sm text-ga-text-primary outline-none"
          />
          {isFetching && <span className="text-xs text-ga-text-secondary">…</span>}
          <button
            type="button"
            onClick={closeGlobalSearch}
            className="text-ga-text-secondary hover:text-ga-text-primary text-sm"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {input.trim().length < 2 ? (
            <div className="p-6 text-center text-xs text-ga-text-secondary">
              Type at least 2 characters to search.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-xs text-ga-text-secondary">
              {isFetching ? 'Searching…' : 'No matches.'}
            </div>
          ) : (
            <Grouped rows={rows} highlight={highlight} onPick={pick} onHover={setHighlight} />
          )}
        </div>

        <div className="px-4 py-2 border-t border-ga-border text-[10px] text-ga-text-secondary flex items-center gap-3">
          <span>
            <kbd className="px-1 rounded bg-ga-bg-hover">↑</kbd>{' '}
            <kbd className="px-1 rounded bg-ga-bg-hover">↓</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 rounded bg-ga-bg-hover">Enter</kbd> open
          </span>
          <span>
            <kbd className="px-1 rounded bg-ga-bg-hover">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function Grouped({
  rows,
  highlight,
  onPick,
  onHover,
}: {
  rows: SearchRow[];
  highlight: number;
  onPick: (r: SearchRow) => void;
  onHover: (idx: number) => void;
}) {
  const sections: { key: SearchRow['kind']; label: string }[] = [
    { key: 'catalog', label: 'Catalog' },
    { key: 'purchase', label: 'Active purchases' },
    { key: 'recipe', label: 'Recipes' },
  ];

  return (
    <div className="divide-y divide-ga-border/50">
      {sections.map((section) => {
        const sectionRows = rows
          .map((r, idx) => ({ r, idx }))
          .filter((x) => x.r.kind === section.key);
        if (sectionRows.length === 0) return null;
        return (
          <div key={section.key} className="py-1">
            <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-ga-text-secondary">
              {section.label}
            </div>
            {sectionRows.map(({ r, idx }) => (
              <button
                key={r.key}
                type="button"
                onMouseEnter={() => onHover(idx)}
                onClick={() => onPick(r)}
                className={cn(
                  'w-full text-left px-4 py-2 flex items-center justify-between gap-3 hover:bg-ga-bg-hover',
                  idx === highlight && 'bg-ga-bg-hover',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ga-text-primary truncate">{r.label}</div>
                  {r.sublabel && (
                    <div className="text-xs text-ga-text-secondary truncate">{r.sublabel}</div>
                  )}
                </div>
                <span className="text-xs text-ga-text-secondary flex-shrink-0">↵</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
