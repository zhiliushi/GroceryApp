/**
 * Item categories — canonical preset list.
 *
 * Drives the Category dropdown in QuickAddModal + the upcoming
 * "Group by category" toggle on MyItemsPage. Preset only — no free
 * text — to prevent the spelling drift that happens at 1000+ items
 * ("Dairy" / "dairy" / "Milk products" all becoming separate buckets).
 *
 * Naming convention (per founder guidance 2026-06-05):
 *   "if most people call it jam, add jam in categories without spread"
 *
 * → Use everyday colloquial names, not taxonomic ones. "Drinks" not
 *   "Beverages". "Jam" not "Spreads". "Bread & bakery" not "Baked
 *   goods". 14 categories balances discoverability vs. choice
 *   paralysis at the dropdown step.
 *
 * Storage: written to `default_category` on the catalog row when a
 * user first picks one for an item (catalog_service.upsert_entry
 * accepts the field). Subsequent purchases of the same catalog item
 * inherit it. Manual override on each add via the dropdown.
 */
export interface ItemCategory {
  /** Stable slug — what's stored in Firestore. */
  id: string;
  /** Display label — shown in the dropdown + filter chips. */
  label: string;
  /** Single emoji for visual scan. */
  emoji: string;
}

export const ITEM_CATEGORIES: ItemCategory[] = [
  { id: 'fruit_veg',      label: 'Fruit & veg',         emoji: '🍎' },
  { id: 'meat_fish',      label: 'Meat & fish',         emoji: '🥩' },
  { id: 'dairy',          label: 'Dairy',               emoji: '🥛' },
  { id: 'eggs',           label: 'Eggs',                emoji: '🥚' },
  { id: 'bread_bakery',   label: 'Bread & bakery',      emoji: '🍞' },
  { id: 'canned_packaged',label: 'Canned & packaged',   emoji: '🥫' },
  { id: 'pasta_rice',     label: 'Pasta, rice & noodles', emoji: '🍝' },
  { id: 'jam_honey',      label: 'Jam & honey',         emoji: '🍯' },
  { id: 'sauces_spices',  label: 'Sauces & spices',     emoji: '🌶️' },
  { id: 'frozen',         label: 'Frozen',              emoji: '❄️' },
  { id: 'drinks',         label: 'Drinks',              emoji: '🥤' },
  { id: 'snacks',         label: 'Snacks',              emoji: '🍫' },
  { id: 'alcohol',        label: 'Alcohol',             emoji: '🍷' },
  { id: 'other',          label: 'Other',               emoji: '❓' },
];

/** Lookup by id. Returns null for unknown / legacy free-text values
 *  so callers can decide whether to fall back to "Other" or display
 *  raw. */
export function findCategory(id: string | null | undefined): ItemCategory | null {
  if (!id) return null;
  return ITEM_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** Display helper: emoji + label, or "Uncategorized" when null. */
export function formatCategory(id: string | null | undefined): string {
  const cat = findCategory(id);
  if (!cat) return 'Uncategorized';
  return `${cat.emoji} ${cat.label}`;
}
