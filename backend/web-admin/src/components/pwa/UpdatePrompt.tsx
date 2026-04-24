import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { cn } from '@/utils/cn';

/**
 * Service-worker update prompt.
 *
 * vite-plugin-pwa with `registerType: 'autoUpdate'` installs the new SW
 * automatically on reload. This toast gives the user a nudge so they don't
 * sit on a stale build indefinitely. Dismissing just closes the toast —
 * the next reload picks up the waiting worker regardless.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[pwa] service worker registered:', swUrl);
      }
    },
    onRegisterError(err) {
      // eslint-disable-next-line no-console
      console.warn('[pwa] SW registration failed:', err);
    },
  });

  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    if (needRefresh) setDismissedThisSession(false);
  }, [needRefresh]);

  if (!needRefresh || dismissedThisSession) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed z-40 bottom-24 right-6 md:bottom-6 md:right-6',
        'max-w-xs bg-ga-bg-card border border-ga-accent/40 rounded-lg shadow-lg p-3',
        'flex items-start gap-2',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ga-text-primary">
          Update available
        </div>
        <div className="text-xs text-ga-text-secondary mt-0.5">
          A newer version is ready. Reload to update.
        </div>
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="px-2 py-1 text-xs rounded bg-ga-accent text-white hover:opacity-90"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissedThisSession(true);
            setNeedRefresh(false);
          }}
          className="px-2 py-1 text-xs text-ga-text-secondary hover:text-ga-text-primary"
        >
          Later
        </button>
      </div>
    </div>
  );
}
