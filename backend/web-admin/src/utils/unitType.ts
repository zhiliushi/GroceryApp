/**
 * UNIT_TYPE_TOUCHPOINT — canonical helpers.
 * Mirrors backend `app/services/unit_type_service.py`.
 * See `.claude/docs/unit-type-method.md` for the full method.
 *
 * Single source of truth for:
 *   - Valid base_units per unit_type
 *   - Default base_unit per unit_type
 *   - Suggested pack_labels per unit_type
 *   - Default pack_size by (pack_label, unit_type)
 *   - Step heuristic for the Use slider
 *   - Legacy 'container' coercion
 *   - Reading legacy event.unit / .base_unit_label as a graceful fallback
 *
 * If you change behaviour here, sync the backend module in the same PR.
 */

import type { BaseUnit, PurchaseEvent, CatalogEntry } from '@/types/api';

export type UnitType = 'count' | 'volume' | 'weight';

/** Valid base_unit values per canonical unit_type. */
export const VALID_BASE_UNITS_BY_TYPE: Record<UnitType, BaseUnit[]> = {
  count: ['count'],
  volume: ['ml', 'L'],
  weight: ['g', 'kg'],
};

export const DEFAULT_BASE_UNIT_BY_TYPE: Record<UnitType, BaseUnit> = {
  count: 'count',
  volume: 'ml',
  weight: 'g',
};

/** Pack-label dropdown suggestions. Free-text is still allowed. */
export const SUGGESTED_PACK_LABELS_BY_TYPE: Record<UnitType, string[]> = {
  count: ['loose', 'pack', 'carton', 'tray', 'box'],
  volume: ['carton', 'bottle', 'jug', 'can', 'sachet'],
  weight: ['pack', 'box', 'bag', 'jar', 'tin', 'loose'],
};

/** Default pack_size for (pack_label, unit_type) combinations. */
const DEFAULT_PACK_SIZE_BY_LABEL: Record<string, Partial<Record<UnitType, number>>> = {
  carton: { volume: 1000, count: 6 },
  bottle: { volume: 500 },
  jug: { volume: 1000 },
  can: { volume: 330, weight: 400 },
  box: { weight: 500, count: 12 },
  bag: { weight: 1000 },
  jar: { weight: 500, volume: 250 },
  sachet: { weight: 50, volume: 100 },
  tray: { count: 10 },
  pack: { count: 6 },
  loose: { count: 1, volume: 1, weight: 1 },
};

const KNOWN_PACK_LABELS = new Set([
  'loose', 'pack', 'carton', 'box', 'bag', 'bottle', 'jar', 'can',
  'sachet', 'tin', 'tub', 'tray', 'punnet', 'block', 'loaf',
  'container', 'cup', 'jug', 'packet',
]);

/** Coerce legacy 'container' to 'count'. Other values pass through. */
export function coerceLegacyUnitType(
  value: string | null | undefined,
): UnitType {
  const v = (value || '').trim().toLowerCase();
  if (v === 'volume') return 'volume';
  if (v === 'weight') return 'weight';
  return 'count'; // count, container, anything else → count
}

export function validBaseUnits(unitType: string | null | undefined): BaseUnit[] {
  return VALID_BASE_UNITS_BY_TYPE[coerceLegacyUnitType(unitType)];
}

/** All canonical base units in fixed display order. */
export const ALL_BASE_UNITS: BaseUnit[] = ['count', 'ml', 'L', 'g', 'kg'];

/**
 * Base-unit options for an INPUT dropdown — wider than `validBaseUnits`.
 *
 * When the catalog row's unit_type is known, narrow the options to that
 * type's valid subset (e.g. volume → ml/L). When unknown (no catalog
 * match yet, or row has no unit_type), return ALL canonical units so
 * the user can pick any measurement.
 *
 * Use this in QuickAddModal etc. where the user hasn't necessarily
 * picked / matched a catalog row yet. Use `validBaseUnits` only when
 * you're sure the unit_type is known and want strict filtering.
 */
export function baseUnitsForInput(
  unitType: string | null | undefined,
): BaseUnit[] {
  if (!unitType) return ALL_BASE_UNITS;
  return VALID_BASE_UNITS_BY_TYPE[coerceLegacyUnitType(unitType)];
}

export function defaultBaseUnit(unitType: string | null | undefined): BaseUnit {
  return DEFAULT_BASE_UNIT_BY_TYPE[coerceLegacyUnitType(unitType)];
}

export function suggestedPackLabels(
  unitType: string | null | undefined,
): string[] {
  return SUGGESTED_PACK_LABELS_BY_TYPE[coerceLegacyUnitType(unitType)];
}

/** Best-effort default pack_size from (label, type). undefined = no guess. */
export function defaultPackSize(
  packLabel: string | null | undefined,
  unitType: string | null | undefined,
): number | undefined {
  const label = (packLabel || '').trim().toLowerCase();
  if (!label) return undefined;
  const t = coerceLegacyUnitType(unitType);
  return DEFAULT_PACK_SIZE_BY_LABEL[label]?.[t];
}

/** Slider step heuristic. Mirrors backend default_step. */
export function stepForBaseUnit(
  baseUnit: string | null | undefined,
  totalBaseUnits: number,
): { step: number; decimal: boolean } {
  const u = (baseUnit || '').toLowerCase();
  if (u === 'ml') {
    if (totalBaseUnits <= 200) return { step: 10, decimal: false };
    if (totalBaseUnits <= 2000) return { step: 50, decimal: false };
    return { step: 100, decimal: false };
  }
  if (u === 'g' || u === 'gram' || u === 'grams') {
    if (totalBaseUnits <= 500) return { step: 10, decimal: false };
    if (totalBaseUnits <= 5000) return { step: 50, decimal: false };
    return { step: 100, decimal: false };
  }
  if (u === 'l' || u === 'kg') {
    return { step: 0.1, decimal: true };
  }
  return { step: 1, decimal: false };
}

/**
 * Read the canonical pack_label off an event, falling back to legacy
 * fields. Used by display + use/move modals so old un-backfilled events
 * still render usefully until the startup backfill catches them.
 */
export function readPackLabel(
  event: Pick<PurchaseEvent, 'pack_label' | 'unit' | 'pack_size'> | null | undefined,
): string {
  if (!event) return 'loose';
  if (event.pack_label) return event.pack_label;
  const legacy = (event.unit || '').toLowerCase();
  if (KNOWN_PACK_LABELS.has(legacy)) return legacy;
  if ((event.pack_size ?? 1) > 1) return 'pack';
  return 'loose';
}

/**
 * Read the canonical base_unit off an event, falling back through:
 *   event.base_unit > event.base_unit_label > event.unit (when known)
 *   > 'count'.
 */
export function readBaseUnit(
  event:
    | Pick<PurchaseEvent, 'base_unit' | 'base_unit_label' | 'unit'>
    | null
    | undefined,
): BaseUnit {
  if (!event) return 'count';
  const candidates = [event.base_unit, event.base_unit_label, event.unit];
  for (const c of candidates) {
    if (!c) continue;
    const lower = c.toLowerCase();
    if (lower === 'ml') return 'ml';
    if (lower === 'l' || lower === 'liter' || lower === 'litre') return 'L';
    if (lower === 'g' || lower === 'gram' || lower === 'grams') return 'g';
    if (lower === 'kg') return 'kg';
    if (lower === 'count' || lower === 'pcs' || lower === 'piece') return 'count';
  }
  return 'count';
}

/**
 * Convenience: compute total base units for an event.
 * total_base_units = quantity (= pack_count) × pack_size.
 */
export function totalBaseUnits(
  event: Pick<PurchaseEvent, 'quantity' | 'pack_size'> | null | undefined,
): number {
  if (!event) return 0;
  return (event.quantity ?? 0) * Math.max(1, event.pack_size ?? 1);
}

/**
 * Format the pack-breakdown caption: "1 carton × 1000 ml" or
 * "3 cartons × 6 each" or just "6 ml" for loose.
 *
 * `unit_type` is read from the catalog row when available; pulled from
 * the event for graceful fallback.
 */
export function formatPackBreakdown(
  event:
    | Pick<PurchaseEvent, 'quantity' | 'pack_size' | 'pack_label' | 'unit' | 'base_unit' | 'base_unit_label'>
    | null
    | undefined,
): string {
  if (!event) return '';
  const packCount = event.quantity ?? 0;
  const packSize = Math.max(1, event.pack_size ?? 1);
  const baseUnit = readBaseUnit(event);
  const packLabel = readPackLabel(event);

  if (packSize <= 1) {
    return `${formatNum(packCount)} ${baseUnit}`;
  }
  const pluralLabel = packCount === 1 ? packLabel : pluralizeLabel(packLabel);
  return `${formatNum(packCount)} ${pluralLabel} × ${formatNum(packSize)} ${baseUnit} each`;
}

function pluralizeLabel(label: string): string {
  // Naive English pluralisation for the curated set above. "loose" doesn't pluralise.
  if (label === 'loose') return 'loose';
  if (label.endsWith('s') || label.endsWith('x')) return label;
  return label + 's';
}

function formatNum(n: number): string {
  if (n === Math.floor(n)) return String(n);
  return n.toFixed(1);
}

/**
 * Plain-language description of what the user is committing to when
 * picking each unit_type. Used inline in CatalogEntryPage's
 * UnitTypeEditor and in the user manual. Kept short.
 */
export const UNIT_TYPE_DESCRIPTIONS: Record<UnitType, { label: string; description: string }> = {
  count: {
    label: 'Count',
    description:
      'Whole pieces. Each piece is one unit. Use modal: integer spinner. ' +
      'Examples: eggs, apples, cans, cartons-as-units, yogurt cups.',
  },
  volume: {
    label: 'Volume',
    description:
      'Liquid measured in ml or L. Use modal: ml/L slider. ' +
      'Examples: milk, juice, cooking oil, broth.',
  },
  weight: {
    label: 'Weight',
    description:
      'Solids/granulars measured in g or kg. Use modal: g/kg slider. ' +
      'Examples: rice, flour, sugar, meat.',
  },
};

/** Convenience: get the catalog row's effective canonical unit_type. */
export function effectiveUnitType(
  entry: Pick<CatalogEntry, 'unit_type'> | null | undefined,
): UnitType {
  return coerceLegacyUnitType(entry?.unit_type);
}
