import { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';

/**
 * Admin tab for managing the link directory shown on /about.
 *
 * Categories are a fixed enum (donation / reference / social / other).
 * Adding a new category = code change to AboutPage CATEGORY_TITLES + the
 * service _VALID_CATEGORIES.
 */

type Category = 'donation' | 'reference' | 'social' | 'other';

interface ExternalLink {
  id: string;
  label: string;
  url: string;
  category: Category;
  description?: string | null;
  icon?: string | null;
  sort_order?: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ListResponse {
  items: ExternalLink[];
  count: number;
  categories: string[];
}

const CATEGORY_OPTIONS: Category[] = ['donation', 'reference', 'social', 'other'];

const blankDraft = (): Partial<ExternalLink> => ({
  label: '',
  url: '',
  category: 'donation',
  description: '',
  icon: '',
  sort_order: 0,
  enabled: true,
});

export default function ExternalLinksTab() {
  const [items, setItems] = useState<ExternalLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ExternalLink>>(blankDraft());
  const [adding, setAdding] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const r = await apiClient.get<ListResponse>(API.ADMIN_EXTERNAL_LINKS);
      setItems(r.data.items);
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || 'Failed to load links');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startAdd() {
    setEditingId(null);
    setDraft(blankDraft());
    setAdding(true);
  }

  function startEdit(link: ExternalLink) {
    setAdding(false);
    setEditingId(link.id);
    setDraft({
      label: link.label,
      url: link.url,
      category: link.category,
      description: link.description || '',
      icon: link.icon || '',
      sort_order: link.sort_order ?? 0,
      enabled: link.enabled,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setAdding(false);
    setDraft(blankDraft());
  }

  function isValidDraft(): boolean {
    const label = (draft.label || '').trim();
    const url = (draft.url || '').trim();
    if (!label || !url) return false;
    if (!(url.startsWith('http://') || url.startsWith('https://'))) return false;
    if (!CATEGORY_OPTIONS.includes(draft.category as Category)) return false;
    return true;
  }

  async function save() {
    if (!isValidDraft()) {
      toast.error('Label, URL (http/https), and category are required');
      return;
    }
    const payload = {
      label: (draft.label || '').trim(),
      url: (draft.url || '').trim(),
      category: draft.category,
      description: (draft.description || '').trim() || null,
      icon: (draft.icon || '').trim() || null,
      sort_order: Number(draft.sort_order ?? 0),
      enabled: !!draft.enabled,
    };
    try {
      if (editingId) {
        await apiClient.patch(API.ADMIN_EXTERNAL_LINK(editingId), payload);
        toast.success('Link updated');
      } else {
        await apiClient.post(API.ADMIN_EXTERNAL_LINKS, payload);
        toast.success('Link added');
      }
      cancelEdit();
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || 'Failed to save');
    }
  }

  async function toggleEnabled(link: ExternalLink) {
    try {
      await apiClient.patch(API.ADMIN_EXTERNAL_LINK(link.id), {
        enabled: !link.enabled,
      });
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || 'Failed to toggle');
    }
  }

  async function remove(link: ExternalLink) {
    if (!confirm(`Delete "${link.label}"?`)) return;
    try {
      await apiClient.delete(API.ADMIN_EXTERNAL_LINK(link.id));
      toast.success('Link deleted');
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || 'Failed to delete');
    }
  }

  async function seedDefaults() {
    try {
      const r = await apiClient.post<{ inserted: number }>(API.ADMIN_EXTERNAL_LINKS_SEED);
      if (r.data.inserted > 0) {
        toast.success(`Seeded ${r.data.inserted} default link(s)`);
      } else {
        toast.info('Collection already has links — nothing seeded');
      }
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || 'Failed to seed');
    }
  }

  const showForm = adding || editingId !== null;

  // Group by category for display
  const byCategory: Record<string, ExternalLink[]> = {};
  for (const it of items) {
    (byCategory[it.category] ||= []).push(it);
  }
  for (const cat in byCategory) {
    byCategory[cat].sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.label.localeCompare(b.label),
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-ga-text-primary">External Links</h3>
            <p className="text-xs text-ga-text-secondary mt-0.5">
              Donation / reference / social URLs surfaced on the public{' '}
              <code className="text-ga-text-primary">/about</code> page.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={seedDefaults}
              className="px-3 py-1.5 text-xs rounded-md border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover"
              title="Seed Ko-fi default if collection is empty (idempotent)"
            >
              Seed defaults
            </button>
            <button
              onClick={startAdd}
              className="px-3 py-1.5 text-xs rounded-md bg-ga-accent text-white font-medium hover:opacity-90"
            >
              + Add link
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
          <h4 className="text-sm font-semibold text-ga-text-primary mb-3">
            {editingId ? 'Edit link' : 'New link'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Label" required>
              <input
                type="text"
                value={draft.label || ''}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Support on Ko-fi"
                className="w-full px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
              />
            </Field>
            <Field label="Category" required>
              <select
                value={draft.category as string}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as Category })
                }
                className="w-full px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="URL" required hint="http:// or https:// only">
              <input
                type="url"
                value={draft.url || ''}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="https://ko-fi.com/yourname"
                className="w-full px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
              />
            </Field>
            <Field label="Icon (optional)" hint="emoji or short symbol">
              <input
                type="text"
                value={draft.icon || ''}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                placeholder="☕"
                maxLength={8}
                className="w-full px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
              />
            </Field>
            <Field label="Description (optional)">
              <input
                type="text"
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="If GroceryApp helps you, you can buy me a coffee."
                maxLength={200}
                className="w-full px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
              />
            </Field>
            <Field label="Sort order" hint="lower numbers first within a category">
              <input
                type="number"
                value={draft.sort_order ?? 0}
                onChange={(e) =>
                  setDraft({ ...draft, sort_order: Number(e.target.value) })
                }
                className="w-full px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
              />
            </Field>
            <Field label="Enabled">
              <label className="inline-flex items-center gap-2 text-sm text-ga-text-primary">
                <input
                  type="checkbox"
                  checked={!!draft.enabled}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                />
                Show on /about
              </label>
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={save}
              disabled={!isValidDraft()}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md font-medium',
                isValidDraft()
                  ? 'bg-ga-accent text-white hover:opacity-90'
                  : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
              )}
            >
              {editingId ? 'Save changes' : 'Create link'}
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 text-xs rounded-md border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List, grouped by category */}
      <div className="space-y-4">
        {busy && items.length === 0 && (
          <div className="text-sm text-ga-text-secondary">Loading…</div>
        )}
        {!busy && items.length === 0 && (
          <div className="text-sm text-ga-text-secondary border border-ga-border rounded-lg p-4 bg-ga-bg-card">
            No links yet. Click <strong>Seed defaults</strong> to add the Ko-fi link, or{' '}
            <strong>+ Add link</strong> to create one manually.
          </div>
        )}
        {CATEGORY_OPTIONS.filter((c) => (byCategory[c] || []).length > 0).map((cat) => (
          <div key={cat} className="bg-ga-bg-card border border-ga-border rounded-lg">
            <div className="px-4 py-2 border-b border-ga-border text-xs uppercase tracking-wider text-ga-text-secondary font-semibold">
              {cat}
            </div>
            <ul className="divide-y divide-ga-border">
              {byCategory[cat].map((link) => (
                <li
                  key={link.id}
                  className="px-4 py-3 flex items-start gap-3 text-sm"
                >
                  <span className="text-xl leading-none mt-0.5 flex-shrink-0">
                    {link.icon || '🔗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'font-medium',
                          link.enabled
                            ? 'text-ga-text-primary'
                            : 'text-ga-text-secondary line-through',
                        )}
                      >
                        {link.label}
                      </span>
                      {!link.enabled && (
                        <span className="text-[10px] uppercase tracking-wider text-ga-text-secondary bg-ga-bg-hover px-1.5 py-0.5 rounded">
                          disabled
                        </span>
                      )}
                      <span className="text-[11px] text-ga-text-secondary">
                        order {link.sort_order ?? 0}
                      </span>
                    </div>
                    {link.description && (
                      <div className="text-xs text-ga-text-secondary mt-0.5">
                        {link.description}
                      </div>
                    )}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-ga-accent hover:underline break-all"
                    >
                      {link.url}
                    </a>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(link)}
                      className="text-xs px-2 py-1 rounded border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleEnabled(link)}
                      className="text-xs px-2 py-1 rounded border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover"
                    >
                      {link.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => remove(link)}
                      className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-ga-text-secondary mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-ga-text-secondary/70 mt-0.5">{hint}</span>}
    </label>
  );
}
