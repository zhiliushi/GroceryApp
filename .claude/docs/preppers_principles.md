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

## How to use this doc

- When adding a new prep_type or expanding the common-preserves seed:
  cite the reference (NCHFP / Ball / Katz) for the chosen
  ready_after_hours and shelf_life_days values in the seed entry's
  `description` or PR body. This builds an audit trail.
- When designing a new feature: check whether it serves archetype B or
  drifts toward archetype A. If it drifts, either re-justify or push
  back.
- When user requests something archetype-A flavored: don't reflexively
  refuse, but ask whether they want to re-position. Document any
  positioning shift in this doc with the date.
