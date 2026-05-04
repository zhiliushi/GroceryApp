/**
 * Countdown helpers for preppers batches.
 *
 * Each batch carries `started_at` / `ready_at` / `expires_at` (ISO 8601).
 * The UI computes "fermenting for 2d 4h" / "ready in 18h" / "expires in
 * 12d" client-side from those timestamps.
 */

import type { PrepBatch } from '@/types/api';

export type BatchPhase =
  | 'preparing'   // now < ready_at
  | 'ready'       // ready_at <= now < expires_at
  | 'expired';    // now >= expires_at

export function batchPhase(batch: PrepBatch, now = new Date()): BatchPhase {
  const ready = new Date(batch.ready_at).getTime();
  const exp = new Date(batch.expires_at).getTime();
  const t = now.getTime();
  if (t < ready) return 'preparing';
  if (t < exp) return 'ready';
  return 'expired';
}

/**
 * Render a duration as a short countdown string.
 *   90s  -> "1m"
 *   3h   -> "3h"
 *   2d4h -> "2d 4h"
 *   8d   -> "8d"
 * Negative durations render with a "ago" suffix.
 */
export function formatCountdown(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  const suffix = deltaMs < 0 ? ' ago' : '';
  const mins = Math.floor(abs / 60_000);
  if (mins < 1) return deltaMs >= 0 ? '< 1m' : 'just now';
  if (mins < 60) return `${mins}m${suffix}`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return remMins > 0 && hours < 6
      ? `${hours}h ${remMins}m${suffix}`
      : `${hours}h${suffix}`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days < 14 && remHours > 0) {
    return `${days}d ${remHours}h${suffix}`;
  }
  return `${days}d${suffix}`;
}

/**
 * Headline string for a batch row — what to show in big text.
 * Phase + countdown to the next milestone.
 *
 *   preparing → "ready in 2d 4h"
 *   ready     → "expires in 12d"
 *   expired   → "expired 3d ago"
 */
export function batchHeadline(batch: PrepBatch, now = new Date()): {
  phase: BatchPhase;
  text: string;
  /** True when within 24h of expiry (or already expired). UI tints red. */
  urgent: boolean;
} {
  const phase = batchPhase(batch, now);
  const t = now.getTime();
  if (phase === 'preparing') {
    const delta = new Date(batch.ready_at).getTime() - t;
    return { phase, text: `ready in ${formatCountdown(delta)}`, urgent: false };
  }
  if (phase === 'ready') {
    const delta = new Date(batch.expires_at).getTime() - t;
    const urgent = delta < 24 * 60 * 60 * 1000;
    return { phase, text: `expires in ${formatCountdown(delta)}`, urgent };
  }
  // expired
  const delta = new Date(batch.expires_at).getTime() - t; // negative
  return { phase, text: `expired ${formatCountdown(delta)}`, urgent: true };
}

export const PREP_TYPE_ICONS: Record<string, string> = {
  ferment: '🦠',
  cure: '🥓',
  freeze: '❄️',
  can: '🥫',
  dry: '🌿',
  pickle: '🥒',
  jam: '🍓',
  infuse: '🫒',
};

export function prepTypeLabel(prepType: string): string {
  switch (prepType) {
    case 'ferment': return 'Fermented';
    case 'cure': return 'Cured';
    case 'freeze': return 'Frozen';
    case 'can': return 'Canned';
    case 'dry': return 'Dried';
    case 'pickle': return 'Pickled';
    case 'jam': return 'Jam / preserve';
    case 'infuse': return 'Infused';
    default: return prepType;
  }
}
