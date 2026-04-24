/**
 * Client-side health-score helpers — mirror the backend formula so the UI can
 * show instant visual feedback (e.g. optimistic updates after an action).
 *
 * Keep this in sync with app/services/waste_service.py:compute_health_score.
 * See docs/HEALTH_SCORE.md for the formula.
 */

import type { HealthComponents } from '@/types/api';

export function gradeFromScore(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

export function computeScore(components: HealthComponents, wasteRate: number): number {
  const activeTotal =
    components.active_healthy +
    components.active_expiring_7d +
    components.active_expiring_3d +
    components.active_expired +
    components.active_untracked;

  let activeComponent = 1.0;
  if (activeTotal > 0) {
    activeComponent =
      (components.active_healthy * 1.0 +
        components.active_expiring_7d * 0.8 +
        components.active_expiring_3d * 0.5 +
        components.active_expired * 0.0 +
        components.active_untracked * 0.6) /
      activeTotal;
  }

  const wasteComponent = 1.0 - wasteRate;
  return Math.round(100 * (0.7 * activeComponent + 0.3 * wasteComponent));
}

export function gradeColor(grade: 'green' | 'yellow' | 'red'): string {
  return grade === 'green'
    ? 'bg-green-500'
    : grade === 'yellow'
    ? 'bg-yellow-400'
    : 'bg-red-500';
}

export function gradeTextColor(grade: 'green' | 'yellow' | 'red'): string {
  return grade === 'green'
    ? 'text-green-700'
    : grade === 'yellow'
    ? 'text-yellow-700'
    : 'text-red-700';
}
