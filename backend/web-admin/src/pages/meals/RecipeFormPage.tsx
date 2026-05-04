import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useCreateRecipe, useUpdateRecipe, useScanRecipeImage } from '@/api/mutations/useRecipeMutations';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { useHomemaker } from '@/hooks/useHomemaker';
import RecipeHistoryModal from '@/components/meals/RecipeHistoryModal';
import RecipeCostCard from '@/components/meals/RecipeCostCard';
import IngredientSocialRow from '@/components/meals/IngredientSocialRow';
import IngredientAutocomplete from '@/components/meals/IngredientAutocomplete';
import type { Recipe, RecipeIngredient } from '@/types/api';

interface FormIngredient extends RecipeIngredient {
  _key: number;
}

let nextKey = 0;

export default function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();
  const scanMutation = useScanRecipeImage();
  const { data: flags } = useFeatureFlags();
  const recipeOcrEnabled = flags ? flags.recipe_ocr !== false : false;
  const homemaker = useHomemaker();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load existing recipe for edit
  const { data: existing } = useQuery({
    queryKey: ['recipes', id],
    queryFn: () => apiClient.get<Recipe>(API.MEALS_RECIPE(id!)).then((r) => r.data),
    enabled: isEdit,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState(2);
  const [prepTime, setPrepTime] = useState(10);
  const [ingredients, setIngredients] = useState<FormIngredient[]>([]);
  const [steps, setSteps] = useState<{ key: number; text: string }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [scannedBanner, setScannedBanner] = useState(false);

  // Populate form in edit mode
  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      setDescription(existing.description || '');
      setServings(existing.servings || 2);
      setPrepTime(existing.prep_time_min || 10);
      setIngredients((existing.ingredients || []).map((i) => ({ ...i, _key: nextKey++ })));
      setSteps((existing.steps || []).map((s) => ({ key: nextKey++, text: s })));
      setTags(existing.tags || []);
    }
  }, [existing]);

  const addIngredient = useCallback(() => {
    setIngredients((prev) => [...prev, { name: '', quantity: null, unit: null, category: '', _key: nextKey++ }]);
  }, []);

  const removeIngredient = useCallback((key: number) => {
    setIngredients((prev) => prev.filter((i) => i._key !== key));
  }, []);

  const updateIngredient = useCallback((key: number, field: string, value: unknown) => {
    setIngredients((prev) => prev.map((i) => i._key === key ? { ...i, [field]: value } : i));
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, { key: nextKey++, text: '' }]);
  }, []);

  const removeStep = useCallback((key: number) => {
    setSteps((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const addTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleScan = useCallback(async (file: File) => {
    const result = await scanMutation.mutateAsync(file);
    if (result.success && result.parsed) {
      setName(result.parsed.name || name);
      setIngredients(result.parsed.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category || '',
        _key: nextKey++,
      })));
      setSteps(result.parsed.steps.map((s) => ({ key: nextKey++, text: s })));
      setScannedBanner(true);
    }
  }, [name, scanMutation]);

  const handleSubmit = () => {
    const data = {
      name: name.trim(),
      description: description.trim(),
      servings,
      prep_time_min: prepTime,
      ingredients: ingredients.filter((i) => i.name.trim()).map(({ _key, ...rest }) => rest),
      steps: steps.filter((s) => s.text.trim()).map((s) => s.text.trim()),
      tags,
    };

    if (isEdit) {
      updateMutation.mutate({ id: id!, data }, { onSuccess: () => navigate('/meals') });
    } else {
      createMutation.mutate(data, { onSuccess: () => navigate('/meals') });
    }
  };

  const canSave = name.trim().length >= 2 && ingredients.some((i) => i.name.trim());
  const isPending = createMutation.isPending || updateMutation.isPending;

  // H3 social — render-only sort: pinned first, then by star count desc,
  // then by original array index. The underlying `ingredients` state stays
  // in author-given order so Save preserves what was typed; we only reorder
  // visually. Each entry carries `originalIdx` so the social mutations
  // address the right backend slot regardless of render position.
  const sortedIngredients = useMemo(() => {
    const indexed = ingredients.map((ing, originalIdx) => ({ ing, originalIdx }));
    return [...indexed].sort((a, b) => {
      const aPinned = !!a.ing.pin_by;
      const bPinned = !!b.ing.pin_by;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      const aStars = (a.ing.stars ?? []).length;
      const bStars = (b.ing.stars ?? []).length;
      if (aStars !== bStars) return bStars - aStars;
      return a.originalIdx - b.originalIdx;
    });
  }, [ingredients]);

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb + History (homemaker.versioning, edit mode only) */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-sm">
          <Link to="/meals" className="text-ga-accent hover:underline">← Meals</Link>
          <span className="text-ga-text-secondary mx-2">/</span>
          <span className="text-ga-text-primary">{isEdit ? 'Edit Recipe' : 'Add Recipe'}</span>
        </div>
        {isEdit && homemaker.versioning && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="text-xs px-3 py-1 rounded border border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            title="View revision history (homemaker)"
          >
            🕘 History
          </button>
        )}
      </div>

      {scannedBanner && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2 mb-4 text-sm text-blue-400">
          📷 Scanned recipe — review and edit before saving
        </div>
      )}

      <details className="bg-ga-bg-card border border-ga-border rounded-lg group mb-4">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
          <span>ⓘ How does the recipe form work?</span>
          <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
          <p>
            <span className="text-ga-text-primary font-medium">Photo scan</span>{' '}
            (when available) reads a recipe photo and pre-fills the name, ingredients
            and steps. Always review before saving — OCR isn&apos;t perfect.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Ingredient names</span>{' '}
            try to auto-link to either your personal catalog (so the cost estimate uses
            your last-paid prices) or the common-ingredient list (egg, santan, kicap manis,
            etc.). The match status appears below each ingredient as you type.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Quantity + unit</span>{' '}
            are optional but useful — they let the cook flow on the Meals page do partial
            splits (e.g. recipe needs 2 eggs out of a 12-pack) instead of consuming the
            whole purchase.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Cost estimate</span>{' '}
            appears below the form once the recipe is saved (edit mode only). Each line
            shows the last-paid price from your buy history; missing-history items are
            marked clearly so the total can be read as a partial estimate.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Tags</span> help group
            recipes for later (e.g. <em>breakfast</em>, <em>30-min</em>). Press Enter
            to add. Click <em>×</em> to remove.
          </p>
        </div>
      </details>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 space-y-4">
        {/* Scan button — hidden when recipe_ocr flag is off */}
        {!isEdit && recipeOcrEnabled && (
          <div className="flex items-center gap-2">
            <label
              className="bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent text-sm font-medium rounded-lg px-4 py-2 cursor-pointer transition-colors"
              title="Upload a JPG or PNG photo of a recipe. The app extracts the name, ingredients, and steps for you to review."
            >
              📷 Scan Recipe Photo
              <input type="file" accept="image/jpeg,image/png" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScan(f); }} />
            </label>
            {scanMutation.isPending && <span className="text-xs text-ga-text-secondary animate-pulse">Processing image...</span>}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Recipe Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100}
            placeholder="e.g. French Toast"
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        </div>

        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500}
            placeholder="Quick breakfast with expiring bread"
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="block text-xs text-ga-text-secondary mb-1"
              title="How many people this recipe feeds. Shown on the recipe card."
            >Servings</label>
            <input type="number" min={1} max={50} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 1)}
              className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
          </div>
          <div>
            <label
              className="block text-xs text-ga-text-secondary mb-1"
              title="Total time including chopping. Shown on the recipe card and used to filter quick recipes."
            >Prep Time (min)</label>
            <input type="number" min={0} max={999} value={prepTime} onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
              className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <label
            className="block text-xs text-ga-text-secondary mb-1"
            title="At least one ingredient is required. Names auto-link to your catalog or to the common-ingredients list."
          >Ingredients *</label>
          <div className="space-y-1.5">
            {sortedIngredients.map(({ ing, originalIdx }) => (
              <div key={ing._key}>
                <div className="flex items-start gap-2">
                  <IngredientAutocomplete
                    value={ing.name}
                    onChange={(newName) => updateIngredient(ing._key, 'name', newName)}
                  />
                  <input type="number" value={ing.quantity ?? ''} onChange={(e) => updateIngredient(ing._key, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Qty"
                    title="Optional. Lets the cook flow do partial-pack splits."
                    className="w-16 bg-ga-bg-hover border border-ga-border rounded-lg px-2 py-1.5 text-sm text-ga-text-primary text-center" />
                  <input value={ing.unit ?? ''} onChange={(e) => updateIngredient(ing._key, 'unit', e.target.value || null)}
                    placeholder="Unit"
                    title="Optional. e.g. g, ml, tsp, slice."
                    className="w-20 bg-ga-bg-hover border border-ga-border rounded-lg px-2 py-1.5 text-sm text-ga-text-primary" />
                  <button onClick={() => removeIngredient(ing._key)} title="Remove this ingredient" className="text-red-400 hover:text-red-300 text-xs">🗑</button>
                </div>
                {isEdit && id && homemaker.social && (
                  <IngredientSocialRow
                    recipeId={id}
                    idx={originalIdx}
                    ingredient={ing}
                  />
                )}
              </div>
            ))}
          </div>
          <button onClick={addIngredient} className="text-xs text-ga-accent hover:underline mt-1.5">+ Add ingredient</button>
        </div>

        {/* Steps */}
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Steps (optional)</label>
          <div className="space-y-1.5">
            {steps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-2">
                <span className="text-xs text-ga-text-secondary w-5">{i + 1}.</span>
                <input value={step.text} onChange={(e) => setSteps((prev) => prev.map((s) => s.key === step.key ? { ...s, text: e.target.value } : s))}
                  placeholder="Step description"
                  className="flex-1 bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-1.5 text-sm text-ga-text-primary" />
                <button onClick={() => removeStep(step.key)} className="text-red-400 hover:text-red-300 text-xs">🗑</button>
              </div>
            ))}
          </div>
          <button onClick={addStep} className="text-xs text-ga-accent hover:underline mt-1.5">+ Add step</button>
        </div>

        {/* Tags */}
        <div>
          <label
            className="block text-xs text-ga-text-secondary mb-1"
            title="Free-form labels to group recipes — e.g. breakfast, 30-min, kid-friendly. Press Enter to add."
          >Tags</label>
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map((tag) => (
              <span key={tag} className="text-xs bg-ga-bg-hover border border-ga-border rounded-full px-2.5 py-0.5 text-ga-text-primary flex items-center gap-1">
                {tag}
                <button onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} title="Remove tag" className="text-red-400 hover:text-red-300">×</button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag"
                title="Type a tag and press Enter."
                className="w-24 bg-ga-bg-hover border border-ga-border rounded px-2 py-0.5 text-xs text-ga-text-primary" />
            </div>
          </div>
        </div>

        {/* F1 base — recipe cost estimate. Edit mode only (no recipe id
            in create flow); rendered for ALL users (not homemaker-gated). */}
        {isEdit && id && <RecipeCostCard recipeId={id} />}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Link to="/meals" className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2 hover:text-ga-text-primary">
            Cancel
          </Link>
          <button onClick={handleSubmit} disabled={!canSave || isPending}
            className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
            {isPending ? 'Saving...' : isEdit ? 'Update Recipe' : 'Save Recipe'}
          </button>
        </div>
      </div>

      {isEdit && id && (
        <RecipeHistoryModal
          open={historyOpen}
          recipeId={id}
          recipeName={name || 'Recipe'}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}
