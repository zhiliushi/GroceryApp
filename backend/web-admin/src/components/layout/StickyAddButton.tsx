import { useLocation } from 'react-router-dom';
import { useUiStore } from '@/stores/uiStore';

const HIDDEN_PATHS = ['/login', '/join'];

/**
 * Desktop top-right Add pill. Mobile version lives in PrimaryActionFab
 * (speed-dial) to avoid collision with Scan + hamburger at the same thumb zone.
 */
export default function StickyAddButton() {
  const location = useLocation();
  const openQuickAdd = useUiStore((s) => s.openQuickAdd);

  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <button
      onClick={openQuickAdd}
      aria-label="Add item"
      className="hidden md:flex fixed top-4 right-4 z-30 items-center gap-2 px-4 py-2 rounded-full bg-ga-accent text-white text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
    >
      <span className="text-lg leading-none">+</span>
      <span>Add item</span>
    </button>
  );
}
