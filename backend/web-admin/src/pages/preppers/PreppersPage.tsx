import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCommonPreserves,
  usePrepBatches,
  usePrepRecipes,
  useCreatePrepBatch,
  useSetPrepBatchStatus,
  useDeletePrepBatch,
  useDeletePrepRecipe,
} from '@/api/queries/usePreppers';
import { usePreppers } from '@/hooks/usePreppers';
import { batchHeadline, PREP_TYPE_ICONS, prepTypeLabel } from '@/utils/prepCountdown';
import type { CommonPreserve, PrepBatch, PrepRecipe } from '@/types/api';

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

      <ActiveBatches batches={batches?.batches} loading={batchesLoading} />
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

function ActiveBatches({
  batches,
  loading,
}: {
  batches?: PrepBatch[];
  loading: boolean;
}) {
  return (
    <section className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        🔥 Active batches
      </h2>
      {loading ? (
        <p className="text-xs text-ga-text-secondary">Loading…</p>
      ) : !batches || batches.length === 0 ? (
        <div className="text-center py-6 text-sm text-ga-text-secondary">
          No active batches.{' '}
          <Link to="/preppers/new" className="text-ga-accent hover:underline">
            Start one
          </Link>{' '}
          from a recipe or a common preset below.
        </div>
      ) : (
        <ul className="space-y-2">
          {batches.map((b) => (
            <BatchRow key={b.id} batch={b} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BatchRow({ batch }: { batch: PrepBatch }) {
  const setStatus = useSetPrepBatchStatus();
  const del = useDeletePrepBatch();
  const headline = batchHeadline(batch);
  const phaseColor =
    headline.phase === 'preparing' ? 'text-blue-300'
    : headline.phase === 'ready' ? (headline.urgent ? 'text-red-300' : 'text-green-300')
    : 'text-red-400';

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 bg-ga-bg-hover/40 rounded-md">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-2xl flex-shrink-0">{PREP_TYPE_ICONS[batch.prep_type] || '🥫'}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ga-text-primary truncate">{batch.name}</div>
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
