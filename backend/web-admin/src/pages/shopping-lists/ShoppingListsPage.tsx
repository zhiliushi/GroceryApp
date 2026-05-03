import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyShoppingLists } from '@/api/queries/useShoppingLists';
import { useCreateShoppingList } from '@/api/mutations/useShoppingListMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import type { ShoppingList } from '@/types/api';

const MAX_ITEMS_PER_LIST = 50;

function listAge(list: ShoppingList): string {
  const ts = list.created_at ?? list.createdDate;
  if (!ts) return '';
  const ms = typeof ts === 'string' ? Date.parse(ts) : Number(ts);
  if (!Number.isFinite(ms)) return '';
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ShoppingListsPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const { data, isLoading } = useMyShoppingLists();
  const createMutation = useCreateShoppingList();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const lists = data?.lists ?? [];

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate(name, {
      onSuccess: () => {
        setCreating(false);
        setNewName('');
      },
    });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Shopping Lists"
        icon="🛒"
        count={data?.count}
        action={
          <button
            onClick={() => setCreating((v) => !v)}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white"
          >
            {creating ? 'Cancel' : '+ New list'}
          </button>
        }
      />

      {isAdmin && (
        <p className="text-xs text-ga-text-secondary mb-3">
          Admin: showing only YOUR lists. Use Users page for cross-user view.
        </p>
      )}

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mb-4 flex gap-2 items-center bg-ga-bg-card border border-ga-border rounded-lg p-3"
        >
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="List name (e.g. 'Weekly groceries')"
            maxLength={80}
            className="flex-1 px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
          />
          <button
            type="submit"
            disabled={!newName.trim() || createMutation.isPending}
            className="px-3 py-2 text-sm font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      {isLoading ? (
        <LoadingSpinner text="Loading your lists…" />
      ) : lists.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="No shopping lists yet"
          subtitle="Click + New list above to start one."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => {
            const count = list.item_count ?? 0;
            const atCap = count >= MAX_ITEMS_PER_LIST;
            return (
              <Link
                key={list.id}
                to={`/shopping-lists/${list.id}`}
                className="block bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:border-ga-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-ga-text-primary truncate">{list.name}</h3>
                  <span
                    className={`shrink-0 text-xs font-medium rounded-full px-2 py-0.5 ${
                      atCap
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-ga-accent/20 text-ga-accent'
                    }`}
                    title={atCap ? 'List is full (50 items)' : undefined}
                  >
                    {count}/{MAX_ITEMS_PER_LIST}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ga-text-secondary">
                  {listAge(list) || 'recently'}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
