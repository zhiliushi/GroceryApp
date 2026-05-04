/**
 * useRouteHistory — keeps the last N visited routes in a ring buffer.
 *
 * Captured 2026-05-04 from the customer-feedback design pass. When the
 * user submits feedback, the admin's Telegram notification + the
 * stored `context.breadcrumb_routes` get the last 5 routes the user
 * walked. Removes 90% of "where were they when this broke?" guesswork
 * during triage.
 *
 * Storage: in-memory module-scoped array. Cleared on full page reload
 * (ok — the breadcrumb is meant for *this session*, not persistent
 * history). Tracking is silent; no telemetry leaves the device until
 * the user voluntarily submits feedback.
 *
 * Tracker: `<RouteHistoryTracker />` mounted once in AppLayout. Pushes
 * the current pathname on every navigation; dedupes consecutive
 * duplicates.
 *
 * Reader: `getRouteHistory()` for non-React contexts (the feedback
 * modal pulls it on submit). Pure read; never blocks.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MAX_ROUTES = 5;
const _history: string[] = [];

function _push(path: string): void {
  if (!path) return;
  if (_history[_history.length - 1] === path) return; // dedupe consecutive
  _history.push(path);
  if (_history.length > MAX_ROUTES) _history.shift();
}

/**
 * Mount once at the AppLayout level. Pushes the current pathname into
 * the ring buffer on every navigation. No render output.
 */
export function RouteHistoryTracker() {
  const location = useLocation();
  useEffect(() => {
    _push(location.pathname);
  }, [location.pathname]);
  return null;
}

/**
 * Synchronous read for non-React contexts (FeedbackModal builds the
 * context blob from this on submit).
 *
 * Returns a fresh array copy so callers can mutate without affecting
 * the underlying buffer.
 */
export function getRouteHistory(): string[] {
  return _history.slice();
}
