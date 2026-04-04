import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useCreateRecipe, useUpdateRecipe, useScanRecipeImage } from '@/api/mutations/useRecipeMutations';
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

  return (
    <div className="p-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm">
        <Link to="/meals" className="text-ga-accent hover:underline">← Meals</Link>
        <span className="text-ga-text-secondary mx-2">/</span>
        <span className="text-ga-text-primary">{isEdit ? 'Edit Recipe' : 'Add Recipe'}</span>
      </div>

      {scannedBanner && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2 mb-4 text-sm text-blue-400">
          📷 Scanned recipe — review and edit before saving
        </div>
      )}

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 space-y-4">
        {/* Scan button */}
        {!isEdit && (
          <div className="flex items-center gap-2">
            <label className="bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent text-sm font-medium rounded-lg px-4 py-2 cursor-pointer transition-colors">
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
            <label className="block text-xs text-ga-text-secondary mb-1">Servings</label>
            <input type="number" min={1} max={50} value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 1)}
              className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
          </div>
          <div>
            <label className="block text-xs text-ga-text-secondary mb-1">Prep Time (min)</label>
            <input type="number" min={0} max={999} value={prepTime} onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
              className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Ingredients *</label>
          <div className="space-y-1.5">
            {ingredients.map((ing) => (
              <div key={ing._key} className="flex items-center gap-2">
                <input value={ing.name} onChange={(e) => updateIngredient(ing._key, 'name', e.target.value)}
                  placeholder="Ingredient name"
                  className="flex-1 bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-1.5 text-sm text-ga-text-primary" />
                <input type="number" value={ing.quantity ?? ''} onChange={(e) => updateIngredient(ing._key, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Qty" className="w-16 bg-ga-bg-hover border border-ga-border rounded-lg px-2 py-1.5 text-sm text-ga-text-primary text-center" />
                <input value={ing.unit ?? ''} onChange={(e) => updateIngredient(ing._key, 'unit', e.target.value || null)}
                  placeholder="Unit" className="w-20 bg-ga-bg-hover border border-ga-border rounded-lg px-2 py-1.5 text-sm text-ga-text-primary" />
                <button onClick={() => removeIngredient(ing._key)} className="text-red-400 hover:text-red-300 text-xs">🗑</button>
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
          <label className="block text-xs text-ga-text-secondary mb-1">Tags</label>
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map((tag) => (
              <span key={tag} className="text-xs bg-ga-bg-hover border border-ga-border rounded-full px-2.5 py-0.5 text-ga-text-primary flex items-center gap-1">
                {tag}
                <button onClick={() => setTags((prev) => prev.filter((t) => t !== tag))} className="text-red-400 hover:text-red-300">×</button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag" className="w-24 bg-ga-bg-hover border border-ga-border rounded px-2 py-0.5 text-xs text-ga-text-primary" />
            </div>
          </div>
        </div>

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
    </div>
  );
}
