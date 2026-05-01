# Unit Type Method — canonical reference

> **Status**: This is the source of truth for how unit_type, pack
> structure, and measurement units relate. Every code site that
> touches these concepts (search `UNIT_TYPE_TOUCHPOINT` in code) must
> conform to this model. When you propose changes, pull this doc, edit
> it first, then propagate.
>
> **Adopted**: 2026-05-01 (refactor from the legacy single-`unit`
> field that mashed pack-label and base-unit together).

## Mental model — two independent axes

Every grocery item lives on two axes that don't overlap:

```
       USE-AXIS — unit_type (catalog row, semi-permanent)
       ───────────────────────────────────────────────
        count               volume              weight
        eggs, apples,       milk, juice,        sugar, flour,
        bottles, cartons    broth, oil          rice, meat
            │                  │                   │
            ▼                  ▼                   ▼
        base_unit:         base_unit:          base_unit:
        "count"            "ml" or "L"         "g" or "kg"

       BUY-AXIS — pack_label (purchase event, descriptive only)
       ──────────────────────────────────────────────────────
        loose · carton · box · pack · bottle · jar · bag ·
        can · sachet · cup · tray · …
        (free-text, doesn't participate in math, just shows in UI)
```

`unit_type` answers: *how do I measure this when I use it?*
`pack_label` answers: *how was it sold to me?*

The two are independent:
- Sugar (unit_type=weight) can be bought as `pack_label=box`,
  `pack_label=bag`, `pack_label=loose`. Always measured in g/kg.
- Milk (unit_type=volume) can be bought as `pack_label=carton`,
  `pack_label=bottle`, `pack_label=jug`. Always measured in ml/L.
- Eggs (unit_type=count) can be bought as `pack_label=loose`,
  `pack_label=carton`, `pack_label=tray`. Always counted.

## Canonical fields (per purchase event)

| Field | Type | Meaning | Example: 3 cartons of 1L milk |
|---|---|---|---|
| `pack_count` | float | How many physical containers | `3` |
| `pack_label` | string | What the container is called | `"carton"` |
| `pack_size` | float | Base units **per pack** | `1000` |
| `base_unit` | enum | Measurement unit | `"ml"` |
| `unit_type` (catalog) | enum | Use category | `"volume"` |
| **derived**: `total_base_units` | `pack_count × pack_size` | `3000` |

Storage in Firestore uses the same field names. Legacy `quantity`
field is kept as an alias for `pack_count` (read-compat).

## Storage examples

```
"6 loose eggs":
  pack_count=6, pack_label="loose", pack_size=1, base_unit="count"
  → total = 6 eggs, unit_type (catalog) = count

"1 carton of 6 eggs":
  pack_count=1, pack_label="carton", pack_size=6, base_unit="count"
  → total = 6 eggs (preserves how it was bought)

"3 cartons of 6 eggs (shared expiry, 1 event)":
  pack_count=3, pack_label="carton", pack_size=6, base_unit="count"
  → total = 18 eggs

"3 cartons of 6 eggs (separate expiry, 3 linked events)":
  3 events, each pack_count=1, pack_label="carton", pack_size=6,
  base_unit="count", multi_pack_parent_id=<shared>
  → aggregate total = 18 eggs across linked events

"500g loose flour":
  pack_count=1, pack_label="loose", pack_size=500, base_unit="g"
  → total = 500 g, unit_type = weight

"2 boxes of sugar (1 kg each)":
  pack_count=2, pack_label="box", pack_size=1, base_unit="kg"
  → total = 2 kg

"1 carton of 1L milk":
  pack_count=1, pack_label="carton", pack_size=1000, base_unit="ml"
  → total = 1000 ml, unit_type = volume

"1 bottle of water (500ml), used by the bottle":
  pack_count=1, pack_label="bottle", pack_size=1, base_unit="count"
  → total = 1 bottle. unit_type = count.
  (User chose to track by bottle, not by ml. Their kitchen, their call.)
```

## What user sees when picking unit_type

The user picks unit_type once per catalog row — typically inferred on
first save, editable from CatalogEntryPage's "Manage this item" →
Unit type dropdown. The dropdown shows exactly three options + a
plain-language description of what each means:

```
○ Count — You count whole pieces. Each piece is one unit.
          Use modal: integer spinner.
          Examples: eggs, apples, cans, cartons-as-units, yogurt cups.

○ Volume — Liquid you measure in ml or L.
           Use modal: ml/L slider.
           Examples: milk, juice, cooking oil, broth.

○ Weight — Solids/granulars you measure in g or kg.
           Use modal: g/kg slider.
           Examples: rice, flour, sugar, meat, ground spices.
```

`container` was a fourth option in the legacy schema. It's been
**merged into `count`** because they behave identically in the use
modal (whole-piece consumption). Legacy data with
`unit_type="container"` is coerced to `"count"` on read. The pack
abstraction is preserved via `pack_label`.

## Three behavioural flows

### BUY (QuickAddModal)

The modal exposes a **Single / Bulk** segmented toggle near the
quantity area. The user's choice determines the input shape — and how
the canonical fields get populated.

**Single mode** (1 thing of size X):

```
Name:        [Milk]                    ← drives unit_type via match
Expiry:      [tomorrow]

[Single] [Bulk]                        ← segmented control, default Single

Quantity:    [1]  [L ▾]                ← qty + filtered base_unit
Location:    [Fridge]
```

Storage:
```
pack_count = qty           pack_label = "loose"
pack_size  = 1             base_unit  = unit
total_base_units = qty
```

**Bulk mode** (N packs × M items × Z each):

```
[Single] [Bulk]

[# Packs]    [Items / pack]    [Size / item]   [unit ▾]
   3              4                500            ml
                                           = 6000 ml total

Pack label (optional): [case]   ← carton / box / bag / bottle / case …
                                  Free-text + suggestions per unit_type.
                                  Optional, but enables better future
                                  insights ("threw 1 unfinished case per
                                  week" vs just "wasted 500ml").

Price / pack: [____]
Currency: [MYR]
Location:    [Fridge]
```

Storage (collapses M × Z into pack_size for simplicity — math
preserved, M / Z separation lost in storage but visible in the input):
```
pack_count   = N           pack_label = user-input or "pack"
pack_size    = M × Z       base_unit  = unit
total_base_units = N × M × Z
```

Each pack becomes its own purchase event sharing a
`multi_pack_parent_id`, so each pack can spoil independently.

**Static labels rule**: column headers (`# Packs`, `Items / pack`,
`Size / item`, `Price / pack`) are STATIC strings, not derived from
`pack_label` / `base_unit`. Past iterations rendered "# LOOSE" /
"COUNT/LOOSE" by composing the field values into headers — confused
users because pack_label is technical jargon to them.

**Quick check**: `cd backend/web-admin && npm run check:label-leaks`
greps the source for the specific patterns this rule prohibits. Wired
into `npm run build`. See `.claude/docs/project_context.md`
"UI label discipline" for the full rule + risky-name list.

**Filtering policy — soft hint, not constraint**:
- `unit_type` on the catalog row is a HINT for sensible defaults
  (slider step heuristic in MarkUsedModal, default selection in the
  base_unit dropdown), NOT a constraint on which base_units the user
  can pick. The user is free to record "1 g of milk powder" against
  a catalog row whose unit_type happens to be "volume". We trust the
  user.
- `base_unit` dropdown ALWAYS shows all 5 canonical units
  (count / ml / L / g / kg). The dropdown's default selection comes
  from `defaultBaseUnit(matched_unit_type)` (volume → ml; weight →
  g; count → count) — that's the hint.
- `pack_label` datalist suggests common labels per `unit_type`
  (volume → carton/bottle/jug; weight → box/bag/jar; count →
  loose/carton/pack/tray). User can type anything.

**Backend write path**: `normalize_base_unit(value, unit_type)`
canonicalises the unit string (e.g. "ML" → "ml", "Grams" → "g") and
validates against the 5-unit canonical set, NOT a unit_type-filtered
subset. This was previously a strict-coerce silent rewrite ("user
picked g for a volume row → silently overwritten to ml"). Soft-coerce
now: if user picks `g` for a `unit_type=volume` row, we store `g`.

### USE (MarkUsedModal)

Always operates in **base units** — pack abstraction is invisible at
use time:

```
Mark "Milk" as used
Available: 3000 ml (3 cartons × 1000 ml each)

How many to use?
  [────●────────────────] [250] [ml]
   step adapts to base_unit:
     count → step 1 (integer spinner)
     volume → step 10/50/100 by total
     weight → step 10/50/100 by total
```

The math: `event_qty_to_use = base_units_to_use / pack_size`. The
split logic in `update_status` already handles fractional event qty;
no change to that machinery.

For multi-pack with separate expiries (linked events): consume FIFO
from the soonest-expiring linked pack first. Single-pack mode stays
the same.

### TRANSFER (MoveLocationModal)

Smart unit selection by divisibility:

```
A. pack_count > 1 — multiple containers exist:
   "How many cartons to move?"   [───●──] 1 of 3
   Move whole packs only — pack-level granularity.

B. pack_count = 1, pack_size > 1, unit_type ∈ {volume, weight}:
   "How much to move?"   [────●────] [250] [ml] of [1000]
   Base-unit slider (divisible: liquid/granular).

C. pack_count = 1, pack_size > 1, unit_type = count:
   "How many [eggs] to move?"   [──●─] 3 of 6
   Integer count slider (divisible: discrete pieces).

D. pack_count = 1, pack_size = 1:
   "Move whole [carton]" (no slider, just confirm)
   Indivisible — single pack with single content.
```

The data effect: split-on-move. Original event becomes "remaining
pack_count at origin" + "moved pack_count at destination", both linked
via `split_from_event_id`.

## What gets consumed when user picks each unit_type (UI behaviour)

| User picks `unit_type` | UnitTypeEditor option label | QuickAdd base_unit dropdown | Use modal input | Display formatting |
|---|---|---|---|---|
| `count` | "Count — whole pieces" | locked to `count` | integer spinner | "6 eggs" or "1 carton (6 eggs)" |
| `volume` | "Volume — ml or L" | `ml` or `L` | ml/L slider, step 10/50/100 | "1L milk" or "1 carton (1000 ml)" |
| `weight` | "Weight — g or kg" | `g` or `kg` | g/kg slider, step 10/50/100 | "500g sugar" or "1 box (1 kg)" |
| `container` (legacy) | (not shown — coerced to `count`) | as `count` | integer | as count |

## Touchpoints — all sites that conform to this model

Search `UNIT_TYPE_TOUCHPOINT` in code. Backend + frontend listed in
`feature-inventory.md` § "unit_type touchpoints".

## Migration approach

- Schema: add `pack_label` + `base_unit` as new fields. Don't drop
  legacy `unit` / `base_unit_label` — read code falls back gracefully.
- Backfill: idempotent script (`scripts/backfill_pack_label_base_unit.py`)
  runs once on app startup, marks each event with `_pack_label_v1=true`
  so re-runs are no-ops. Inference rules:
  - `base_unit` = `event.base_unit` ?? `event.base_unit_label` ?? (`event.unit` if ∈ {ml,L,g,kg,count}) ?? "count"
  - `pack_label` = `event.pack_label` ?? ("pack" if old `unit == "pack"` or `pack_size > 1`; else "loose")
- `unit_type="container"` → coerced to `"count"` on read AND on next
  catalog write.
- Old QuickAddModal data still readable; new writes always populate
  the canonical fields.

## Discipline rule

Every PR that changes unit_type, pack handling, or use-modal
mathematics MUST:
1. Read this doc first.
2. Update this doc if the design needs to change.
3. Touch every site tagged `UNIT_TYPE_TOUCHPOINT` so the backend,
   frontend, and migration code stay in lockstep.
4. Run the integration tests for catalog + partial-actions.
