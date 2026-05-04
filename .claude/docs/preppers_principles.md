# Preppers feature — principles & references

**Read this BEFORE editing the preppers feature** (`/preppers`,
`prep_*_service.py`, `common_preserves_service.py`, `prep_eligibility_service.py`,
`prep_supply_service.py`, `PreppersPage.tsx`, `PrepRecipeFormPage.tsx`, the
admin toggles, and the user-manual section 11).

This doc captures the product positioning, canonical external references
the design defers to, and the prioritized gap list. Compiled
2026-05-04 after an explicit positioning decision; revisit only if the
positioning itself changes.

---

## Positioning — Archetype B (hobbyist-preserver / smart-pantry rotation)

**Decided 2026-05-04.** The "prepper" label covers two largely non-overlapping
populations. We are building for **B**, NOT A.

| Aspect | Archetype A — Survival prep / SHTF / LDS | **Archetype B — Hobbyist preserver / smart-pantry rotation (US)** |
|---|---|---|
| Mental model | Insurance against catastrophe | Better stewardship of food they already make |
| Time horizon | Months to years of caloric coverage | Days to a couple of months, with rotation |
| Critical concerns | Calories, water, categorical coverage, scenario tiers | Shelf-life accuracy, FIFO rotation, pattern-driven reorder |
| Reference frame | LDS Provident Living calculator, FEMA emergency kits | NCHFP, Ball Blue Book, Sandor Katz |
| Failure mode they fear | Running out during disruption | Kimchi turning to mush, jam molding, freezer-burned stew |

**Implications for design choices:**

- We do NOT track calories, macros, water storage, or scenario tiers (3-day
  vs 2-week vs 30-day). These are archetype-A concerns.
- We DO emphasise per-batch shelf-life accuracy, expiry-aware rotation
  ("use this jar first"), and pattern-driven reorder ("you cook nasi
  lemak 6×/month — keep more sambal in rotation").
- The original scope memo (`project_meals_tier_vision.md`) framed it
  exactly this way: *"Logic-based, NOT record-heavy. Recommends purchases
  based on frequent-meals analysis."* Stay aligned.

If a feature request feels like it belongs to archetype A, push back or
defer — we are not pivoting toward survival prep without an explicit
re-positioning decision.

## Canonical external references

When designing default values (ready_after_hours, shelf_life_days,
prep_type taxonomy, safety floors), defer to these in this priority order:

1. **NCHFP — National Center for Home Food Preservation** (University of
   Georgia). Free, peer-reviewed, US-canonical. Covers canning, drying,
   fermenting, smoking, freezing with shelf-life tables and safety
   thresholds.
   - Source: `nchfp.uga.edu`
   - Use for: shelf-life defaults on preserves, water-bath vs pressure-
     canning safety floors, drying time/temperature ranges.

2. **Ball Blue Book Guide to Preserving** — the definitive US home-canning
   reference. Sets the standard for what "ready" and "shelf-stable" mean
   for jams, jellies, pickles, sauces, fruits, vegetables.
   - Use for: jar/lid procedures, headspace, processing times, "ready vs
     opened" shelf-life pairs (defer here when a preset has both an
     unopened and opened figure).

3. **Sandor Katz — *The Art of Fermentation*** (and *Wild Fermentation*).
   The reference for lacto-fermentation timing variability — kimchi,
   sauerkraut, kombucha, miso, tempeh, sourdough. Critical insight: the
   "ready" point is a taste-judgment range, not a single number. Surface
   ranges where appropriate.
   - Use for: prep_type=ferment ready_after_hours defaults, temperature-
     dependence notes, "still-evolving" framing.

4. **USDA Complete Guide to Home Canning** — the federal complement to
   Ball/NCHFP. Useful for low-acid pressure-canning safety (beans,
   meats, vegetables) where botulism risk is real.
   - Use for: pressure-canning warnings on prep_type=can entries.

5. **Mary Bell, *The Complete Dehydrator Cookbook*** — drying reference.
   - Use for: prep_type=dry defaults.

External references we **explicitly do NOT defer to**:
- LDS Provident Living food-storage calculator (archetype A).
- FEMA / Red Cross emergency-food guidelines (archetype A).
- Doomsday-prep YouTube/blog content (selection bias toward A; less peer-
  reviewed than NCHFP/Ball).

## Prioritized gap list (as of 2026-05-04, after P9 ships)

What we have ✅:
- Per-batch shelf-life with three phases (preparing / ready / expired)
- Curated 30-entry common-preserves seed
- User-saved recipe templates (50/user cap, beta)
- Household composition (adults/youth/elderly + per-person daily-servings)
- Days-of-supply projection
- Eligibility/data-readiness score (≥30 days + ≥10 purchases)

**Tier 1 — required to deliver on the original scope ("logic-based,
recommendation-driven"):**

1. **FIFO "consume first" surfacing** on active batches (P10, shipping
   alongside this doc). Sort active batches by `expires_at`, tag the
   soonest with a "🔝 use first" chip. Reference: USDA explicitly
   recommends FIFO for home preserves.
2. **Frequent-meal analysis → restock recommendations.** This was the
   original differentiator. Inputs: rolling 30-day cooking history +
   active-batch breakdown. Outputs: nudges like *"you cook nasi lemak
   6×/month → consider preserving sambal in 4-jar batches."* Wait until
   eligibility score is meaningful (post-30d active accounts).
3. **Cost-per-serving rollup.** Pairs with the niche-tier "cheaper than
   Plus" pitch — "see how much you save vs store-bought." Math: link
   recipe ingredients to purchase history (already wired for cooking
   recipes via F1), divide by `servings`, compare to user-entered or
   scanned store-bought reference price.

**Tier 2 — high value, defer to P11+:**

4. **Open vs unopened state per batch.** Real bug in days-of-supply math.
   Ball Blue Book gives unopened-vs-opened pairs for most preserves
   (e.g., jam: 18mo unopened, 4-6 weeks opened refrigerated). Schema:
   `opened_at`, `shelf_life_days_after_open` (default lookup table),
   re-derive `effective_expires_at = min(expires_at, opened_at +
   after_open_days)`.
5. **Multi-horizon dates: best-by, use-by, hard-expiry.** USDA
   distinguishes "best quality" from "safe-to-eat". One number conflates
   them.
6. **Storage-condition modifier** (`fridge | cool_pantry | warm_pantry`)
   applied as a multiplier to `shelf_life_days`. Reference: Sandor Katz
   on how kimchi at 4°C vs 22°C differs by 3-4× in keep time.

**Tier 3 — nice but not where the value is for hobbyist-preservers:**

7-11. Calorie/macro tracking (archetype A); water storage (A); photo
   logging; failure-rate analytics; multi-jar tracking from one batch.

## Malaysian context — what shifts vs the US/Western reference frames

- **Tropical humidity** wrecks dry storage. Default `shelf_life_days` for
  prep_type=dry should run tighter than US guidelines. The current seed
  is roughly OK but worth a humidity-aware adjustment factor later.
- **Power-cut frequency** makes freezer-heavy strategies risky. The
  current seed treats freezer prep at 90-180 days; for KL/Selangor users
  realistic is 14-60 days. Consider a regional override.
- **Cultural rhythms (Ramadan, Hari Raya, Chinese New Year)** drive
  seasonal stockpile spikes. The frequent-meal analysis (Tier 1, item 2)
  will pick this up automatically with a 30-day rolling window.
- **Local staples already covered well in the seed**: santan/kaya, achar,
  tempoyak, tapai, sambal, ikan bilis. Notable absences worth adding
  later if user feedback asks: belacan, cincalok, jeruk-buah varieties,
  kuih-as-frozen.
- **Halal tagging is NOT in scope** (decided 2026-05-04). Bacon-cure,
  gravlax, alcohol-infused presets stay in the seed without a halal
  flag. Users self-select.

## Open / deferred decisions

- **Pricing model** (`[PRICING-TBD]`). Archetype-B positioning supports
  RM5–8/month range based on similar single-feature apps (compare:
  Pantry Check, Cookin); decide after the FIFO + recommendation engine
  is live and we can benchmark engagement.
- **Household pantry sharing** — decided 2026-05-04 to leave to user
  organisation (no aggregation across `household_id`). Users with
  multiple devices can each set their own household composition; the
  source of truth is per-user. Revisit only if shared-household
  feedback comes in.
- **Common-preserves seed expansion** — currently 30 entries. Add more
  driven by user search-failures (track searches that return no preset
  match, surface as a list for admin curation).

## Design principles

These are the durable "house rules" — load-bearing for edge-case
judgment when the spec is silent. Every preppers PR should be
reviewable against this list. Each principle has a stated reason
(so future-you can judge edge cases instead of mechanically following
the rule), code anchors (where it currently shows up), and a sharp
question to ask when changing things.

Established 2026-05-04 after P11 (recommendation engine) shipped, with
a deliberate look-back over P1–P11 to extract patterns that already
hold and codify them as discipline before they erode.

---

### P1. Archetype B alignment — hobbyist-preserver, not survival-prepper

**Rule:** Build for the cook trying to keep their kimchi from turning
to mush, NOT for the family stockpiling against catastrophe. Mental
horizon: days to a couple of months, with rotation. Reject feature
requests whose center of gravity is calorie-counting, water storage,
multi-month survival caloric coverage, or scenario-tier modeling
(72h / 2-week / 30-day kits). Re-position only with an explicit
written decision in this doc.

**Why:** Archetype A and B share surface vocabulary ("prepper", "stockpile",
"shelf life") but diverge sharply in mental model. Letting A drift in
bloats schema with cal/macro/water fields the cook never wanted, and
dilutes the marketing message. The cook who chose us for
keeping-kimchi-fresh sees calorie tracking and concludes we don't
understand them.

**Anchors:**
- [`.claude/docs/preppers_principles.md` § "Positioning — Archetype B"](#positioning--archetype-b-hobbyist-preserver--smart-pantry-rotation) (above)
- We have no `calories` field on `PrepBatch` or `CommonPreserve` — by design.
- We have no `water_storage` collection — by design.

**Question to ask before adding anything:** *Does this serve the
"don't-let-it-spoil + rotate-by-expiry + restock-by-pattern" loop, or
is it survival-prep DNA?* If the latter, document the positioning
shift first.

---

### P2. Empower the cook — never decide for them

**Rule:** Surface signal; never auto-action. Recommendations have
"Start" buttons, not auto-creation. Defaults are starting values, not
constraints. The user can always override. The user can always say no.

**Why:** The cook knows their household, their fermentation skills,
their schedule, and their taste preferences better than we ever will.
Auto-acting (e.g., auto-starting a kimchi batch because they cook nasi
lemak frequently) crosses into patronizing-app territory and breeds
distrust the moment our inference is wrong. The cost of "user has to
click Start" is essentially zero; the cost of misplaced auto-actions
is permanent product distrust.

**Anchors:**
- [`PreppersPage.tsx`](backend/web-admin/src/pages/preppers/PreppersPage.tsx)
  — Recommendations render with explicit `<button>Start batch</button>`
- The 🔝 chip on FIFO rows says "use first" not "must use now"
- [`prep_eligibility_service.py`](backend/app/services/prep_eligibility_service.py)
  — score is computed but never gates access (informational beta)
- Servings input on recipe form is editable; defaults are pre-fills

**Question to ask before adding anything:** *Does this make a decision
FOR the user, or surface signal TO them?* If the former, redesign so
the user is the decision-maker.

---

### P3. Transparency over magic — every score explains itself

**Rule:** Any algorithm-driven surface must emit human-readable
reasoning OR be deterministic enough that the user can derive the
outcome themselves. No black-box ML in beta. No scores without
units. No rankings without source attribution.

**Why:** Users build trust with a recommendation system the same way
they build trust with a friend who suggests recipes — by hearing the
reasoning. "Kimchi: matches 3 of your items (cabbage, chilli,
garlic)" is teachable; "Kimchi: 0.87" is opaque. Once a user catches
us recommending something nonsensical without explaining ourselves,
they discount everything we say afterward.

**Anchors:**
- [`prep_recommendation_service.py`](backend/app/services/prep_recommendation_service.py:147)
  — every recommendation ships with `reasoning`, `matched_ingredients`,
  `match_sources` (split into from_recipes / from_catalog)
- [`prep_supply_service.py`](backend/app/services/prep_supply_service.py:75)
  — supply estimate has 4 distinct `explanation` strings for 4 states
- [`prep_eligibility_service.py`](backend/app/services/prep_eligibility_service.py)
  — eligibility score has a textual explanation showing the gap
- Score badges on tiles show counts (`★ 3 matches`), not floats

**Question to ask before adding anything:** *If a user clicked this
and asked "why does it say that?", can I answer in one sentence
without saying "the algorithm"?* If no, redesign.

---

### P4. Defer on food safety — cite the source

**Rule:** We are not a food-safety authority. Default
`ready_after_hours` and `shelf_life_days` values are sourced from
**NCHFP** (National Center for Home Food Preservation, UGA), the
**Ball Blue Book of Preserving**, **Sandor Katz's *Art of
Fermentation***, and the **USDA Complete Guide to Home Canning**.
Inventing numbers exposes users to risk and us to liability.

**Rule (process):** When adding a new common-preserve OR changing a
default ready_after_hours / shelf_life_days, the change MUST cite
which canonical reference the figure comes from. The citation lives
either in the seed entry's `description` field (preferred) or in the
PR body. If you can't cite it, don't change it.

**Why:** Home preservation has real safety floors — pH < 4.6 for
canned goods (botulism), pressure-canning for low-acid foods,
refrigeration after opening for fermented foods, etc. Authoritative
sources have peer review, decades of data, and lab validation. We
have neither. Using their defaults is the safe default; deviating
from them requires evidence.

**Anchors:**
- [`seed_common_preserves.py`](backend/scripts/seed_common_preserves.py)
  — every entry's description references technique sources
  (water-bath, pressure-canner, refrigerated, etc.)
- [`common_preserves_service.py`](backend/app/services/common_preserves_service.py)
  `VALID_PREP_TYPES` set follows canonical method classifications

**Question to ask before adding anything:** *Where did this number
come from?* If "I made it up" or "feels right", stop and find the
authoritative reference.

---

### P5. Conservative bias when ambiguous

**Rule:** When picking between two reasonable defaults from the
canonical references, pick the SHORTER shelf-life (or LONGER
ready-after-hours). When data is missing, err toward "spoils sooner,
not later". When user override conflicts with the canonical reference,
warn but accept the override.

**Why:** Foodborne illness is asymmetric. Over-stating shelf life ≈
sickening someone. Under-stating shelf life ≈ wasting marginal food.
The two outcomes are not in the same league. Asymmetric risk →
asymmetric default.

**Anchors:**
- Seed conservatism: kimchi at 60d (peak quality, refrigerated) not
  180d (theoretical max for cold-stored fermented veg)
- Frozen stew at 90d not 180d (Malaysian power-cut risk implicit)
- Garlic-in-oil deliberately omitted from seed (botulism risk)
- [`prep_supply_service.py`](backend/app/services/prep_supply_service.py)
  uses `expires_at` directly, never extrapolates beyond it
- FIFO row tints amber within 24h of expiry; red after expiry

**Question to ask before adding anything:** *Between the two
plausible reference values, which one is the more cautious?* Pick
that, document the choice in the seed `description`.

---

### P6. User input is authoritative — defaults are seeds, not constraints

**Rule:** Every default is overridable. Servings = 4 is a starting
value, not a max. Common-preserve `default_ready_after_hours` is a
pre-fill, not a constraint. Per-person daily-servings is configurable.
Household composition is user-set. The user's lived experience trumps
our defaults.

**Why:** Climates vary (Malaysian humidity), techniques differ
(masterful vs novice fermenters), tastes diverge (some prefer kimchi
at week 1, others at month 1), batch sizes scale (one jar vs five).
A system that locks down its defaults insults the user.

**Anchors:**
- [`PrepRecipeFormPage.tsx`](backend/web-admin/src/pages/preppers/PrepRecipeFormPage.tsx)
  — every field (name, prep_type, ready_after, shelf_life, servings,
  ingredients, notes) is editable
- [`prep_recipe_service.py`](backend/app/services/prep_recipe_service.py)
  `update_recipe()` accepts partial body updates
- [`HouseholdForm`](backend/web-admin/src/pages/preppers/PreppersPage.tsx)
  — adults/youth/elderly all editable

**Question to ask before adding anything:** *Can the user override
this if they disagree with our default?* If no, we're crossing into
constraint territory — usually wrong unless safety-driven.

---

### P7. Empty states are first-class

**Rule:** Every section that displays user-derived data MUST specify
its empty state BEFORE shipping the populated state. Sparse data is
the common case for new accounts and beta users — designing the
populated state first leads to broken first-runs.

**Why:** The first impression of preppers is the empty state. If a
new user lands on a page that shows "—" everywhere with no
explanation, they bounce. Properly-handled empty states convert by
showing the user what to do next.

**Anchors:**
- Recommendations: 2 distinct empty states (no signal vs signal-but-
  no-match) with different copy in [`prep_recommendation_service.py`](backend/app/services/prep_recommendation_service.py:158)
- Active batches: empty state links to `/preppers/new` and points at
  common presets
- Supply estimate: 4 distinct explanation strings for 4 states (empty,
  no_household, no_servings, projected) in [`prep_supply_service.py`](backend/app/services/prep_supply_service.py:96)
- Eligibility score: explanation text covers all three regimes (no
  data, building up, ready)

**Question to ask before adding anything:** *What does this section
look like when the underlying data is empty? Have I designed AND
shipped that state?* If no, do it before merging.

---

### P8. Beta posture — additive schema, deferred constraints

**Rule:** During beta, schema changes must be additive — new fields
with defaults are fine, removing fields or making optional fields
required is blocked. Algorithm changes are fine. UX changes are fine.
Schema removals require explicit migration tooling, not silent
break.

**Why:** Beta users tolerate UX evolution but not data loss. A field
removed without a migration breaks every account that had data in it.
Tightening a constraint (e.g., making `servings` required) breaks old
batches saved without it.

**Anchors:**
- `preppers_household` added to user doc with defaults — old accounts
  silently default to {1, 0, 0}
- `servings` added to `PrepBatch` + `PrepRecipe` with default 4 — old
  records without servings get 4 effective via `int(body.get("servings") or 4)`
- `ingredients` added to `CommonPreserve` — old entries silently default
  to empty list
- [`feature_flags.py`](backend/app/core/feature_flags.py)
  `seed_defaults()` merges new keys into existing doc, never removes

**Question to ask before adding anything:** *If this change shipped
and a user had data in the old schema, would their data survive?* If
no, write a migration script first.

---

## Workflow conventions

Process discipline for the most-common preppers operations. Follow
these to keep the audit trail clean and avoid silent breakage.

### Adding a new prep_type

The `prep_type` enum (ferment / cure / freeze / can / dry / pickle /
jam / infuse) is a top-level taxonomy that fans out across schema +
UI + manual. Adding one requires synchronized changes:

1. **Backend**: extend `VALID_PREP_TYPES` in
   [`common_preserves_service.py`](backend/app/services/common_preserves_service.py:32)
2. **Frontend types**: add the new value to the `PrepType` union in
   [`types/api.ts`](backend/web-admin/src/types/api.ts) (look for `export type PrepType`)
3. **Frontend constants**: add an emoji + label in
   [`prepCountdown.ts`](backend/web-admin/src/utils/prepCountdown.ts)
   (`PREP_TYPE_ICONS`, `prepTypeLabel`) and the `PREP_TYPES` array in
   [`PrepRecipeFormPage.tsx`](backend/web-admin/src/pages/preppers/PrepRecipeFormPage.tsx)
4. **Seed**: add at least 2-3 entries of the new type in
   [`seed_common_preserves.py`](backend/scripts/seed_common_preserves.py)
   so the recommendation engine has signal
5. **User manual**: update section 11's "Preservation types" list

A new `prep_type` without all five touches is a mistake — the UI
will fall back to the generic 🥫 icon and the recommendation engine
won't suggest anything of that type.

### Adding a new common-preserve to the seed

Each seed entry is a 7-tuple: `(name_norm, display_name, prep_type,
ready_after_hours, shelf_life_days, description, ingredients)`. When
adding:

1. `name_norm`: ASCII-only, lowercase, underscore-separated
2. `display_name`: any UTF-8, may include parentheticals
   (`"Achar (Malaysian pickled veg)"`)
3. `prep_type`: must be in `VALID_PREP_TYPES`
4. `ready_after_hours` + `shelf_life_days`: cite the source in the
   description (per P4) — NCHFP / Ball / Katz / USDA. Pick the
   conservative figure (per P5).
5. `description`: 1-2 sentence explanation, technique cue, and any
   safety note worth surfacing
6. `ingredients`: 1-6 normalized lowercase ingredient names that
   match how a user would write them in a cooking recipe — these are
   what the recommendation engine matches against

### Changing a default ready_after_hours / shelf_life_days

This is the highest-stakes change because users with active batches
already had `ready_at` / `expires_at` computed from the OLD value.
The math is durable per-batch (we store the timestamps, not the
durations). But future batches use the new default.

1. Change the seed entry tuple
2. Cite the new source in the PR body
3. Note in the description if the change is safer (shorter shelf
   life) — no migration needed
4. If the change is more permissive (longer shelf life), add a
   migration note for users who may have already discarded based on
   the old (shorter) figure

### Changing the recommendation algorithm

The recommendation engine
([`prep_recommendation_service.py`](backend/app/services/prep_recommendation_service.py))
is currently v0 — binary overlap, count-based ranking. When evolving
toward weighted / recency-aware / ML-driven scoring:

1. Keep the `reasoning` field human-readable (per P3)
2. Don't change the API response shape — add new fields, never remove
   old ones (per P8)
3. If introducing a new factor (e.g., recency weighting), surface it
   in the `match_sources` or add a new explainer key
4. Document the algorithm change in this doc's "Open / deferred
   decisions" section with the date

### Adding a new section to /preppers page

1. Design the empty state first (per P7)
2. Wire query invalidation if the new data depends on batches /
   recipes / household (see existing `usePreppers` hooks)
3. Update user manual section 11 with the new subsection
4. If gated by an admin flag, register the flag in
   [`feature_flags.py`](backend/app/core/feature_flags.py) defaults

---

## Code-review checklist for preppers PRs

Run through this list before merging anything that touches the
preppers feature. Each item maps to a Design Principle (P1-P8) — if
the answer is "no" for any non-N/A item, fix or document the
deviation.

1. **P1 — Archetype B alignment**: Does this serve the
   keep-kimchi-fresh / rotate-by-expiry / restock-by-pattern loop?
2. **P2 — Empower, don't decide**: Does this surface signal, or
   auto-action?
3. **P3 — Transparency**: If algorithmic, can the user derive WHY
   the result is what it is?
4. **P4 — Cite the source**: For new defaults, is NCHFP / Ball /
   Katz / USDA cited in the description or PR body?
5. **P5 — Conservative bias**: When picking between values, did we
   pick the more cautious one?
6. **P6 — User input authoritative**: Are user overrides preserved?
7. **P7 — Empty states**: Are sparse-data states designed and
   shipped?
8. **P8 — Additive schema**: Are schema changes additive, with
   defaults for old records?
9. **Manual sync**: Does User Manual section 11 reflect the change?
10. **Cache invalidation**: If new mutations land, do they invalidate
    the relevant query cache (batches, supply, recommendations,
    eligibility, household) where dependencies cross?

If a deviation is intentional (e.g., a P5 violation because the
conservative value is genuinely too short for actual use), document
the reasoning in the PR body.

---

## How to use this doc

- **Before any preppers work**: read the Design Principles (P1-P8)
  section. They're terse on purpose; the reasoning paragraphs matter
  more than the rule statements.
- **When adding a new prep_type or expanding the common-preserves
  seed**: cite the canonical reference (NCHFP / Ball / Katz / USDA)
  for the chosen ready_after_hours and shelf_life_days values. The
  citation lives in the seed entry's `description` (preferred) or
  the PR body.
- **When designing a new feature**: walk the Code-review checklist
  before drafting. If a principle blocks the design, either redesign
  or document the deviation.
- **When the user requests something archetype-A flavored**: don't
  reflexively refuse — ask whether they want to re-position. Document
  any positioning shift in this doc with the date.
- **When updating this doc itself**: the principles (P1-P8) should be
  changed RARELY. The references list and gap list update over time
  as new sources / features land. The "Open / deferred decisions"
  section is the living history.
