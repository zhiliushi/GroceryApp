import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCommonPreserves,
  usePrepBatches,
  usePrepEligibility,
  usePrepRecipes,
  usePreppersHousehold,
  usePreppersRecommendations,
  usePreppersSupply,
  useCreatePrepBatch,
  useSetPrepBatchStatus,
  useDeletePrepBatch,
  useDeletePrepRecipe,
  useUpdatePreppersHousehold,
} from '@/api/queries/usePreppers';
import { usePreppers } from '@/hooks/usePreppers';
import { batchHeadline, PREP_TYPE_ICONS, prepTypeLabel } from '@/utils/prepCountdown';
import type {
  CommonPreserve,
  PrepBatch,
  PrepEligibility,
  PrepHousehold,
  PrepRecipe,
  PrepRecommendation,
  PrepRecommendationsResponse,
  PrepSupplyEstimate,
} from '@/types/api';

/**
 * Preppers landing page — beta cut.
 *
 * Sections:
 *   1. Beta banner (eligibility score is informational only for now)
 *   2. Active batches with countdown to ready / expires + status actions
 *   3. My prep recipes (templates) with quick "Start batch" button
 *   4. Common presets (curated catalog) with "Start batch" or "Save as recipe"
 *
 * Gated by `usePreppers().enabled` — page renders an upsell stub when off.
 */
export default function PreppersPage() {
  const { enabled, userEnabled, flagEnabled } = usePreppers();

  const { data: batches, isLoading: batchesLoading } = usePrepBatches('active', enabled);
  const { data: recipes, isLoading: recipesLoading } = usePrepRecipes(enabled);
  const { data: preserves, isLoading: preservesLoading } = useCommonPreserves(enabled);
  const { data: eligibility } = usePrepEligibility(enabled);
  const { data: household } = usePreppersHousehold(enabled);
  const { data: supply } = usePreppersSupply(enabled);
  const { data: recommendations } = usePreppersRecommendations(enabled);

  if (!enabled) {
    return <NotAvailable userEnabled={userEnabled} flagEnabled={flagEnabled} />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-ga-text-primary">
          🥒 Preppers
        </h1>
        <span className="text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
          beta
        </span>
      </header>

      <BetaBanner />

      {supply && <SupplyEstimateCard supply={supply} />}

      {household && <HouseholdForm household={household} />}

      {eligibility && <EligibilityScore eligibility={eligibility} />}

      <ActiveBatches batches={batches?.batches} loading={batchesLoading} />
      {recommendations && <Recommendations data={recommendations} />}
      <MyRecipes recipes={recipes?.recipes} loading={recipesLoading} />
      <CommonPresets preserves={preserves?.items} loading={preservesLoading} />
    </div>
  );
}

function NotAvailable({ userEnabled, flagEnabled }: { userEnabled: boolean; flagEnabled: boolean }) {
  let reason = 'Not available right now.';
  if (!flagEnabled) reason = 'The preppers feature is currently off for everyone.';
  else if (!userEnabled) reason = "Your account isn't enrolled in the preppers beta yet.";
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 text-center">
      <h1 className="text-xl font-bold text-ga-text-primary mb-2">🥒 Preppers</h1>
      <p className="text-sm text-ga-text-secondary">{reason}</p>
      <p className="text-xs text-ga-text-secondary mt-4">
        Contact your admin if you think this is a mistake.
      </p>
    </div>
  );
}

function BetaBanner() {
  return (
    <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
      <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
        <span>ⓘ What is Preppers?</span>
        <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
        <p>
          <strong className="text-ga-text-primary">Preppers</strong> tracks home
          preservation — kimchi, achar, kaya, jam, jerky, frozen meals — with
          ready-by + expires-by countdowns so nothing gets forgotten in the back
          of the fridge.
        </p>
        <p>
          A <strong>recipe</strong> is your reusable template (kimchi recipe).
          A <strong>batch</strong> is a single jar / tray you actually started
          on a given day.
        </p>
        <p className="text-amber-300/80">
          Beta: the eligibility score meter (data-readiness check) is coming
          soon. For now, all features are open to enrolled users.
        </p>
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SupplyEstimateCard({ supply }: { supply: PrepSupplyEstimate }) {
  const days = supply.days_of_supply;
  let bigText: string;
  let tone: string;
  if (days == null) {
    bigText = '—';
    tone = 'text-ga-text-secondary';
  } else if (days >= 30) {
    bigText = `${days.toFixed(1)} days`;
    tone = 'text-emerald-300';
  } else if (days >= 7) {
    bigText = `${days.toFixed(1)} days`;
    tone = 'text-amber-300';
  } else {
    bigText = `${days.toFixed(1)} days`;
    tone = 'text-red-300';
  }

  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
      <header className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-ga-text-primary flex items-center gap-2">
          🍱 Stockpile supply
        </h2>
        <span className="text-[10px] text-ga-text-secondary">
          {supply.active_batches_count} active batch
          {supply.active_batches_count !== 1 ? 'es' : ''}
        </span>
      </header>

      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div>
          <div className={`text-3xl font-bold tabular-nums ${tone}`}>
            {bigText}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-ga-text-secondary mt-0.5">
            of supply
          </div>
        </div>
        <div className="text-right text-xs text-ga-text-secondary space-y-0.5">
          <div className="tabular-nums">
            <strong className="text-ga-text-primary">{supply.total_servings}</strong>{' '}
            servings on hand
          </div>
          <div className="tabular-nums">
            <strong className="text-ga-text-primary">{supply.daily_consumption}</strong>{' '}
            servings/day for household
          </div>
        </div>
      </div>

      <p className="text-xs text-ga-text-secondary border-t border-ga-border/40 pt-2">
        {supply.explanation}
      </p>

      {supply.batches_breakdown.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-ga-text-secondary hover:text-ga-text-primary">
            Breakdown ({supply.batches_breakdown.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {supply.batches_breakdown.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 px-2 py-1 bg-ga-bg-hover/40 rounded"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="flex-shrink-0">{PREP_TYPE_ICONS[b.prep_type] || '🥫'}</span>
                  <span className="truncate text-ga-text-primary">{b.name}</span>
                </span>
                <span className="text-ga-text-secondary tabular-nums flex-shrink-0">
                  {b.servings} servings · expires in {b.days_until_expires.toFixed(1)}d
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function HouseholdForm({ household }: { household: PrepHousehold }) {
  const [adults, setAdults] = useState(household.adults);
  const [youth, setYouth] = useState(household.youth);
  const [elderly, setElderly] = useState(household.elderly);
  const mutation = useUpdatePreppersHousehold();

  // Sync local state when server data refreshes (e.g., after first load).
  useEffect(() => {
    setAdults(household.adults);
    setYouth(household.youth);
    setElderly(household.elderly);
  }, [household.adults, household.youth, household.elderly]);

  const dirty =
    adults !== household.adults ||
    youth !== household.youth ||
    elderly !== household.elderly;

  function save() {
    mutation.mutate({ adults, youth, elderly });
  }

  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <header className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-ga-text-primary flex items-center gap-2">
          👪 Household
        </h2>
        <span className="text-[10px] text-ga-text-secondary">
          {(household.adults * household.servings_per_adult +
            household.youth * household.servings_per_youth +
            household.elderly * household.servings_per_elderly).toFixed(1)}{' '}
          servings/day
        </span>
      </header>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <NumberField
          label="Adults"
          value={adults}
          onChange={setAdults}
          hint={`${household.servings_per_adult}/day each`}
        />
        <NumberField
          label="Youth"
          value={youth}
          onChange={setYouth}
          hint={`${household.servings_per_youth}/day each`}
        />
        <NumberField
          label="Elderly"
          value={elderly}
          onChange={setElderly}
          hint={`${household.servings_per_elderly}/day each`}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-ga-text-secondary italic">
          Used to project how long your stockpile lasts. Defaults: 3 servings/
          day for adults, 2.5 for youth + elderly.
        </p>
        <button
          onClick={save}
          disabled={!dirty || mutation.isPending}
          className="text-xs px-3 py-1.5 bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {mutation.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-ga-text-secondary mb-1">
        {label}
      </span>
      <input
        type="number"
        min={0}
        max={20}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary text-center"
      />
      <span className="block text-[10px] text-ga-text-secondary mt-1">{hint}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function EligibilityScore({ eligibility }: { eligibility: PrepEligibility }) {
  const pct = Math.round(eligibility.score * 100);
  const barColor = eligibility.eligible
    ? 'bg-emerald-500'
    : pct >= 50
    ? 'bg-amber-500'
    : 'bg-blue-500';
  const labelColor = eligibility.eligible
    ? 'text-emerald-300'
    : pct >= 50
    ? 'text-amber-300'
    : 'text-blue-300';

  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <header className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-ga-text-primary flex items-center gap-2">
          📊 Data readiness
          <span className="text-[10px] uppercase tracking-wider text-ga-text-secondary">
            informational
          </span>
        </h2>
        <span className={`text-sm tabular-nums font-medium ${labelColor}`}>
          {eligibility.eligible ? 'Ready ✓' : `${pct}%`}
        </span>
      </header>

      <div className="h-2 bg-ga-bg-hover rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-ga-text-secondary mb-2">
        <span>
          {eligibility.days_active} / {eligibility.days_required} days
        </span>
        <span>
          {eligibility.total_purchases} / {eligibility.min_purchases} purchases
        </span>
      </div>

      <p className="text-xs text-ga-text-secondary">{eligibility.explanation}</p>

      <p className="text-[10px] text-ga-text-secondary mt-2 italic">
        Beta: this score is informational only — all preppers features are
        unlocked. Once analytics ship, the score will gate the
        recommendation layer (basic batch tracking stays open regardless).
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ActiveBatches({
  batches,
  loading,
}: {
  batches?: PrepBatch[];
  loading: boolean;
}) {
  // Sort by soonest expiry first (FEFO — first-expiry-first-out, the
  // accurate term for what "consume first" means with preserves) and
  // tag the soonest READY batch as the rotation pick. Already-expired
  // batches go to the top regardless but don't get the chip — they need
  // a different action (consume now or discard).
  const { sorted, consumeFirstId } = (() => {
    if (!batches || batches.length === 0) {
      return { sorted: [] as PrepBatch[], consumeFirstId: null as string | null };
    }
    const arr = [...batches].sort(
      (a, b) =>
        new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime(),
    );
    let firstReadyId: string | null = null;
    if (arr.length >= 2) {
      for (const b of arr) {
        if (batchPhase(b) === 'ready') {
          firstReadyId = b.id;
          break;
        }
      }
    }
    return { sorted: arr, consumeFirstId: firstReadyId };
  })();

  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        🔥 Active batches
      </h2>
      {loading ? (
        <p className="text-xs text-ga-text-secondary">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-6 text-sm text-ga-text-secondary">
          No active batches.{' '}
          <Link to="/preppers/new" className="text-ga-accent hover:underline">
            Start one
          </Link>{' '}
          from a recipe or a common preset below.
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((b) => (
            <BatchRow
              key={b.id}
              batch={b}
              consumeFirst={b.id === consumeFirstId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function BatchRow({
  batch,
  consumeFirst,
}: {
  batch: PrepBatch;
  consumeFirst: boolean;
}) {
  const setStatus = useSetPrepBatchStatus();
  const del = useDeletePrepBatch();
  const headline = batchHeadline(batch);
  const phaseColor =
    headline.phase === 'preparing' ? 'text-blue-300'
    : headline.phase === 'ready' ? (headline.urgent ? 'text-red-300' : 'text-green-300')
    : 'text-red-400';

  const rowClass = consumeFirst
    ? 'flex items-center justify-between gap-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-md'
    : 'flex items-center justify-between gap-3 px-3 py-2 bg-ga-bg-hover/40 rounded-md';

  return (
    <li className={rowClass}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-2xl flex-shrink-0">{PREP_TYPE_ICONS[batch.prep_type] || '🥫'}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm text-ga-text-primary truncate">{batch.name}</div>
            {consumeFirst && (
              <span
                className="text-[10px] uppercase tracking-wider bg-amber-500/30 text-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0"
                title="Soonest to expire of your ready batches — use this one first to keep the rotation flowing."
              >
                🔝 use first
              </span>
            )}
          </div>
          <div className="text-[10px] text-ga-text-secondary uppercase tracking-wide">
            {prepTypeLabel(batch.prep_type)}
          </div>
        </div>
      </div>
      <div className={`text-xs tabular-nums ${phaseColor} flex-shrink-0`}>
        {headline.text}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() =>
            setStatus.mutate({ bid: batch.id, status: 'consumed' })
          }
          disabled={setStatus.isPending}
          title="Mark consumed (eaten / used up)"
          className="text-xs px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-200 rounded"
        >
          ✓
        </button>
        <button
          onClick={() =>
            setStatus.mutate({ bid: batch.id, status: 'discarded' })
          }
          disabled={setStatus.isPending}
          title="Mark discarded (spoiled / thrown out)"
          className="text-xs px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded"
        >
          ✗
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete batch "${batch.name}"? This removes the record entirely.`)) {
              del.mutate(batch.id);
            }
          }}
          title="Delete batch"
          className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
        >
          🗑
        </button>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Recommendations({ data }: { data: PrepRecommendationsResponse }) {
  const recs = data.recommendations;
  if (recs.length === 0 && data.user_signal_count === 0) {
    // No signal at all — explain how to populate it.
    return (
      <section className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-ga-text-primary mb-1 flex items-center gap-2">
          ✨ Worth keeping in rotation
        </h2>
        <p className="text-xs text-ga-text-secondary">{data.explanation}</p>
      </section>
    );
  }
  if (recs.length === 0) {
    // Has signal but no preserve matched — gentle nudge.
    return (
      <section className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-ga-text-primary mb-1 flex items-center gap-2">
          ✨ Worth keeping in rotation
        </h2>
        <p className="text-xs text-ga-text-secondary">{data.explanation}</p>
      </section>
    );
  }
  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <header className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-ga-text-primary flex items-center gap-2">
          ✨ Worth keeping in rotation
        </h2>
        <span className="text-[10px] text-ga-text-secondary">
          based on your cooking + buys
        </span>
      </header>
      <p className="text-[10px] text-ga-text-secondary italic mb-3">
        {data.explanation}
      </p>
      <ul className="space-y-2">
        {recs.map((r) => (
          <RecommendationRow key={r.preserve.name_norm} rec={r} />
        ))}
      </ul>
    </section>
  );
}

function RecommendationRow({ rec }: { rec: PrepRecommendation }) {
  const start = useCreatePrepBatch();
  const matched = rec.matched_ingredients;
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 bg-ga-bg-hover/40 rounded-md">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-2xl flex-shrink-0">
          {PREP_TYPE_ICONS[rec.preserve.prep_type] || '🥫'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm text-ga-text-primary truncate">
              {rec.preserve.display_name}
            </div>
            <span
              className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0"
              title={rec.reasoning}
            >
              ★ {rec.score} match{rec.score !== 1 ? 'es' : ''}
            </span>
          </div>
          <div className="text-[10px] text-ga-text-secondary truncate">
            matches: {matched.slice(0, 3).join(', ')}
            {matched.length > 3 ? '…' : ''}
          </div>
        </div>
      </div>
      <button
        onClick={() =>
          start.mutate({
            name: rec.preserve.display_name,
            prep_type: rec.preserve.prep_type,
            ready_after_hours: rec.preserve.default_ready_after_hours,
            shelf_life_days: rec.preserve.default_shelf_life_days,
            servings: 4,
            common_preserve_ref: rec.preserve.name_norm,
          })
        }
        disabled={start.isPending}
        className="text-xs px-3 py-1.5 bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent rounded flex-shrink-0"
      >
        Start batch
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MyRecipes({
  recipes,
  loading,
}: {
  recipes?: PrepRecipe[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg">
      <header className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-semibold text-ga-text-primary flex items-center gap-2"
        >
          <span className="text-[10px]">{open ? '▾' : '▸'}</span>
          📒 My prep recipes
          {recipes && (
            <span className="text-[10px] text-ga-text-secondary">
              ({recipes.length})
            </span>
          )}
        </button>
        <Link
          to="/preppers/new"
          className="text-xs px-3 py-1.5 bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent rounded-lg"
        >
          + Add recipe
        </Link>
      </header>
      {open && (
        <div className="px-4 pb-3">
          {loading ? (
            <p className="text-xs text-ga-text-secondary">Loading…</p>
          ) : !recipes || recipes.length === 0 ? (
            <p className="text-sm text-ga-text-secondary py-2">
              No saved recipes yet. Add one or start a batch from a common preset
              below.
            </p>
          ) : (
            <ul className="space-y-2">
              {recipes.map((r) => (
                <RecipeRow key={r.id} recipe={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function RecipeRow({ recipe }: { recipe: PrepRecipe }) {
  const navigate = useNavigate();
  const start = useCreatePrepBatch();
  const del = useDeletePrepRecipe();
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 bg-ga-bg-hover/40 rounded-md">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xl flex-shrink-0">
          {PREP_TYPE_ICONS[recipe.prep_type] || '🥫'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ga-text-primary truncate">{recipe.name}</div>
          <div className="text-[10px] text-ga-text-secondary">
            ready ~{Math.round(recipe.ready_after_hours / 24)}d · keeps ~
            {recipe.shelf_life_days}d
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() =>
            start.mutate({
              name: recipe.name,
              prep_type: recipe.prep_type,
              ready_after_hours: recipe.ready_after_hours,
              shelf_life_days: recipe.shelf_life_days,
              servings: recipe.servings || 4,
              recipe_id: recipe.id,
              ingredients_snapshot: recipe.ingredients,
              notes: recipe.notes,
            })
          }
          disabled={start.isPending}
          className="text-xs px-3 py-1.5 bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent rounded"
        >
          Start batch
        </button>
        <button
          onClick={() => navigate(`/preppers/${recipe.id}/edit`)}
          className="text-xs px-2 py-1 text-ga-text-secondary hover:text-ga-text-primary"
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete recipe "${recipe.name}"?`)) del.mutate(recipe.id);
          }}
          className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
        >
          🗑
        </button>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function CommonPresets({
  preserves,
  loading,
}: {
  preserves?: CommonPreserve[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg">
      <header className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-semibold text-ga-text-primary flex items-center gap-2"
        >
          <span className="text-[10px]">{open ? '▾' : '▸'}</span>
          📚 Common presets
          {preserves && (
            <span className="text-[10px] text-ga-text-secondary">
              ({preserves.length} curated)
            </span>
          )}
        </button>
      </header>
      {open && (
        <div className="px-4 pb-3">
          {loading ? (
            <p className="text-xs text-ga-text-secondary">Loading…</p>
          ) : !preserves || preserves.length === 0 ? (
            <p className="text-sm text-ga-text-secondary py-2">
              No presets available — admin hasn't seeded the collection yet.
            </p>
          ) : (
            <ul className="space-y-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {preserves.map((p) => (
                <PresetRow key={p.name_norm} preset={p} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function PresetRow({ preset }: { preset: CommonPreserve }) {
  const start = useCreatePrepBatch();
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 bg-ga-bg-hover/40 rounded-md">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-lg flex-shrink-0">{PREP_TYPE_ICONS[preset.prep_type] || '🥫'}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ga-text-primary truncate">{preset.display_name}</div>
          <div className="text-[10px] text-ga-text-secondary">
            ~{Math.round(preset.default_ready_after_hours / 24)}d ready · ~
            {preset.default_shelf_life_days}d shelf
          </div>
        </div>
      </div>
      <button
        onClick={() =>
          start.mutate({
            name: preset.display_name,
            prep_type: preset.prep_type,
            ready_after_hours: preset.default_ready_after_hours,
            shelf_life_days: preset.default_shelf_life_days,
            servings: 4,
            common_preserve_ref: preset.name_norm,
          })
        }
        disabled={start.isPending}
        className="text-xs px-2 py-1 bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent rounded flex-shrink-0"
      >
        Start
      </button>
    </li>
  );
}
