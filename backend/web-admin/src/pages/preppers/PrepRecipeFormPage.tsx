import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import {
  useCreatePrepRecipe,
  useUpdatePrepRecipe,
} from '@/api/queries/usePreppers';
import type { PrepRecipe, PrepType } from '@/types/api';

const PREP_TYPES: { value: PrepType; label: string; emoji: string }[] = [
  { value: 'ferment', label: 'Fermented', emoji: '🦠' },
  { value: 'pickle', label: 'Pickled', emoji: '🥒' },
  { value: 'cure', label: 'Cured', emoji: '🥓' },
  { value: 'jam', label: 'Jam / preserve', emoji: '🍓' },
  { value: 'can', label: 'Canned', emoji: '🥫' },
  { value: 'dry', label: 'Dried', emoji: '🌿' },
  { value: 'freeze', label: 'Frozen', emoji: '❄️' },
  { value: 'infuse', label: 'Infused', emoji: '🫒' },
];

interface FormIngredient {
  _key: number;
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

let nextKey = 0;

export default function PrepRecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const createMutation = useCreatePrepRecipe();
  const updateMutation = useUpdatePrepRecipe();

  const { data: existing } = useQuery({
    queryKey: ['preppers', 'recipe', id],
    queryFn: () =>
      apiClient.get<PrepRecipe>(API.PREPPERS_RECIPE(id!)).then((r) => r.data),
    enabled: isEdit,
  });

  const [name, setName] = useState('');
  const [prepType, setPrepType] = useState<PrepType>('ferment');
  const [readyAfterHours, setReadyAfterHours] = useState(72); // 3 days default
  const [shelfLifeDays, setShelfLifeDays] = useState(30);
  const [ingredients, setIngredients] = useState<FormIngredient[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setPrepType(existing.prep_type);
    setReadyAfterHours(existing.ready_after_hours);
    setShelfLifeDays(existing.shelf_life_days);
    setNotes(existing.notes || '');
    setIngredients(
      (existing.ingredients || []).map((ing) => ({
        _key: ++nextKey,
        name: ing.name,
        quantity: ing.quantity ?? null,
        unit: ing.unit ?? null,
      })),
    );
  }, [existing]);

  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      { _key: ++nextKey, name: '', quantity: null, unit: null },
    ]);
  }

  function updateIngredient(key: number, field: keyof FormIngredient, value: any) {
    setIngredients((prev) =>
      prev.map((ing) => (ing._key === key ? { ...ing, [field]: value } : ing)),
    );
  }

  function removeIngredient(key: number) {
    setIngredients((prev) => prev.filter((ing) => ing._key !== key));
  }

  const canSave =
    name.trim().length > 0 &&
    readyAfterHours >= 0 &&
    shelfLifeDays > 0 &&
    !createMutation.isPending &&
    !updateMutation.isPending;

  function handleSubmit() {
    const payload = {
      name: name.trim(),
      prep_type: prepType,
      ready_after_hours: Number(readyAfterHours),
      shelf_life_days: Number(shelfLifeDays),
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity ?? null,
          unit: i.unit?.trim() || null,
        })),
      notes: notes.trim(),
    };
    if (isEdit) {
      updateMutation.mutate(
        { rid: id!, body: payload },
        { onSuccess: () => navigate('/preppers') },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => navigate('/preppers') });
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="text-sm text-ga-text-secondary">
        <Link to="/preppers" className="hover:text-ga-accent">← Preppers</Link>
        {' / '}
        <span className="text-ga-text-primary">{isEdit ? 'Edit Recipe' : 'Add Prep Recipe'}</span>
      </header>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Recipe name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Mum's kimchi"
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
          />
        </div>

        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Preservation type *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PREP_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => setPrepType(pt.value)}
                className={`text-xs px-2 py-2 rounded-lg border transition ${
                  prepType === pt.value
                    ? 'bg-ga-accent/20 border-ga-accent text-ga-text-primary'
                    : 'bg-ga-bg-hover border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover/70'
                }`}
              >
                <div className="text-lg">{pt.emoji}</div>
                <div className="text-[10px] mt-1">{pt.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ga-text-secondary mb-1">
              Ready after (hours)
            </label>
            <input
              type="number"
              min={0}
              max={8760}
              value={readyAfterHours}
              onChange={(e) => setReadyAfterHours(parseInt(e.target.value) || 0)}
              className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
            />
            <div className="text-[10px] text-ga-text-secondary mt-1">
              {readyAfterHours < 24
                ? `${readyAfterHours}h`
                : `~${Math.round(readyAfterHours / 24)} days`}
            </div>
          </div>
          <div>
            <label className="block text-xs text-ga-text-secondary mb-1">
              Shelf life (days, after ready) *
            </label>
            <input
              type="number"
              min={1}
              max={3650}
              value={shelfLifeDays}
              onChange={(e) => setShelfLifeDays(parseInt(e.target.value) || 1)}
              className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
            />
            <div className="text-[10px] text-ga-text-secondary mt-1">
              {shelfLifeDays < 30
                ? `${shelfLifeDays} days`
                : `~${Math.round(shelfLifeDays / 30)} months`}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Ingredients (optional)</label>
          <div className="space-y-1.5">
            {ingredients.map((ing) => (
              <div key={ing._key} className="flex items-center gap-2">
                <input
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing._key, 'name', e.target.value)}
                  placeholder="Ingredient name"
                  className="flex-1 bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-1.5 text-sm text-ga-text-primary"
                />
                <input
                  type="number"
                  value={ing.quantity ?? ''}
                  onChange={(e) =>
                    updateIngredient(
                      ing._key,
                      'quantity',
                      e.target.value ? parseFloat(e.target.value) : null,
                    )
                  }
                  placeholder="Qty"
                  className="w-16 bg-ga-bg-hover border border-ga-border rounded-lg px-2 py-1.5 text-sm text-ga-text-primary text-center"
                />
                <input
                  value={ing.unit ?? ''}
                  onChange={(e) =>
                    updateIngredient(ing._key, 'unit', e.target.value || null)
                  }
                  placeholder="Unit"
                  className="w-20 bg-ga-bg-hover border border-ga-border rounded-lg px-2 py-1.5 text-sm text-ga-text-primary"
                />
                <button
                  onClick={() => removeIngredient(ing._key)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addIngredient}
            className="text-xs text-ga-accent hover:underline mt-1.5"
          >
            + Add ingredient
          </button>
        </div>

        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Brine ratio, technique tips, source URL…"
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate('/preppers')}
          className="text-sm px-4 py-2 text-ga-text-secondary hover:text-ga-text-primary"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSave}
          className="text-sm px-4 py-2 bg-ga-accent hover:bg-ga-accent/80 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isEdit ? 'Update Recipe' : 'Save Recipe'}
        </button>
      </div>
    </div>
  );
}
