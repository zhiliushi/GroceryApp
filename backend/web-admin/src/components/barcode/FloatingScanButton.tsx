import { useLocation } from 'react-router-dom';
import ContextualScannerModal from './ContextualScannerModal';
import { useUiStore } from '@/stores/uiStore';

const HIDDEN_PATHS = ['/login', '/join'];

/**
 * Desktop-only scan button (top-right, paired with StickyAddButton).
 * Mobile access: PrimaryActionFab speed-dial → Scan.
 * Both paths open the same ContextualScannerModal via `scannerOpen` in uiStore.
 */
export default function FloatingScanButton() {
  const location = useLocation();
  const { scannerOpen, openScanner, closeScanner } = useUiStore();

  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <>
      {/* Desktop top-right scan button (next to the Add pill) */}
      <button
        onClick={openScanner}
        aria-label="Scan barcode"
        title="Scan barcode"
        className="hidden md:flex fixed top-4 right-36 z-30 items-center gap-2 px-4 py-2 rounded-full bg-ga-bg-card border border-ga-border text-ga-text-primary text-sm font-medium shadow-lg hover:bg-ga-bg-hover"
      >
        <span className="text-lg leading-none">📷</span>
        <span>Scan</span>
      </button>
      <ContextualScannerModal open={scannerOpen} onClose={closeScanner} />
    </>
  );
}
