import { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';

/**
 * Mobile "Add to Home Screen" prompt.
 *
 * Only renders on mobile viewports (<640px) when all of:
 *   - `beforeinstallprompt` fired (Chrome/Edge/Android; Safari doesn't fire it)
 *   - User hasn't dismissed within the last 30 days
 *   - App isn't already running in standalone mode
 *
 * On Safari iOS we rely on the user finding Share → Add to Home Screen;
 * showing a static hint there is out of scope for this pass.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MOBILE_QUERY = '(max-width: 639px)';

export default function InstallPrompt() {
  const { pwaInstallDismissedAt, dismissPwaInstall } = useUiStore();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const cleanup = () => window.removeEventListener('beforeinstallprompt', handler);

    // Clear the handle when the app gets installed so we don't re-prompt.
    const installedHandler = () => setDeferred(null);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      cleanup();
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  // Skip if already running as an installed PWA.
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  const withinCooldown =
    pwaInstallDismissedAt !== null &&
    Date.now() - pwaInstallDismissedAt < COOLDOWN_MS;

  if (!deferred || !isMobile || isStandalone || withinCooldown) return null;

  const onInstall = async () => {
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'dismissed') dismissPwaInstall();
    } catch {
      // Prompt was consumed or rejected — clear our handle either way.
    } finally {
      setDeferred(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install GroceryApp"
      className="fixed z-30 bottom-24 left-4 right-4 md:hidden
                 bg-ga-bg-card border border-ga-border rounded-lg shadow-lg p-3
                 flex items-start gap-3"
    >
      <span className="text-2xl" aria-hidden>🛒</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ga-text-primary">
          Install GroceryApp
        </div>
        <div className="text-xs text-ga-text-secondary mt-0.5">
          Add to your home screen for a full-screen experience and offline access.
        </div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onInstall}
          className="px-2 py-1 text-xs rounded bg-ga-accent text-white hover:opacity-90"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => {
            dismissPwaInstall();
            setDeferred(null);
          }}
          className="px-2 py-1 text-xs text-ga-text-secondary hover:text-ga-text-primary"
        >
          Later
        </button>
      </div>
    </div>
  );
}
