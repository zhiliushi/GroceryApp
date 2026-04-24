import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const HIDDEN_PATHS = ['/login', '/join'];

/**
 * Mobile primary action FAB with speed-dial.
 *
 * Replaces the old mobile stack (StickyAddButton bottom-left + FloatingScanButton
 * bottom-right) which competed for the same thumb zone. This component is mobile-only:
 * on desktop (≥md) the layout keeps the top-right Add pill + a paired scan button.
 *
 * Tap the "+" → speed-dial expands above the button with actions. Tap an action →
 * speed-dial closes + action runs. Tap outside / Escape → speed-dial closes.
 */
export default function PrimaryActionFab() {
  const location = useLocation();
  const {
    speedDialOpen,
    toggleSpeedDial,
    closeSpeedDial,
    openQuickAdd,
    openScanner,
    openGlobalSearch,
  } = useUiStore();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!speedDialOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSpeedDial();
    };
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) closeSpeedDial();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [speedDialOpen, closeSpeedDial]);

  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <div
      ref={rootRef}
      className="md:hidden fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3"
    >
      {/* Speed-dial items — appear above the primary button */}
      {speedDialOpen && (
        <>
          <SpeedDialItem
            label="Search"
            icon="🔍"
            onClick={() => {
              openGlobalSearch();
            }}
          />
          <SpeedDialItem
            label="Scan barcode"
            icon="📷"
            onClick={() => {
              openScanner();
              closeSpeedDial();
            }}
          />
          <SpeedDialItem
            label="Add item"
            icon="+"
            onClick={() => {
              openQuickAdd();
            }}
          />
        </>
      )}

      {/* Primary FAB — "+" when closed (tap = quick-add), "×" when speed-dial open */}
      <button
        type="button"
        onClick={speedDialOpen ? closeSpeedDial : toggleSpeedDial}
        onDoubleClick={openQuickAdd}
        aria-label={speedDialOpen ? 'Close actions' : 'Open actions'}
        aria-expanded={speedDialOpen}
        className={cn(
          'w-14 h-14 rounded-full text-white shadow-lg transition-transform flex items-center justify-center text-3xl',
          speedDialOpen ? 'bg-ga-text-secondary rotate-45' : 'bg-ga-accent hover:scale-110',
        )}
      >
        +
      </button>
    </div>
  );
}

function SpeedDialItem({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 pl-3 pr-1 py-1 bg-ga-bg-card border border-ga-border rounded-full shadow-md text-sm text-ga-text-primary hover:bg-ga-bg-hover"
    >
      <span>{label}</span>
      <span className="w-10 h-10 rounded-full bg-ga-accent text-white flex items-center justify-center text-lg">
        {icon}
      </span>
    </button>
  );
}
