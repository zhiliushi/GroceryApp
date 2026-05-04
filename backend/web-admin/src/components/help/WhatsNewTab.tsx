/**
 * WhatsNewTab — changelog + announcements surface inside the User Hub.
 *
 * Static array of entries, newest-first, grouped by date. Discipline
 * rule (encoded in `.claude/docs/pages/user-hub.md`): when something
 * user-visible ships, add an entry here in the same PR — same as the
 * existing "update the manual" rule.
 *
 * Why static (not a Firestore-backed admin-curated feed): for closed
 * beta with N=2-50 users, code-shipped entries are simpler, version-
 * controlled, and tied to actual releases. Switch to Firestore later
 * if admin needs to post non-code announcements (maintenance windows,
 * etc.) without a deploy.
 *
 * Entry kinds:
 *   ✨ feature       — new user-facing capability
 *   🔧 improvement   — refined existing surface
 *   🐛 fix           — bug, regression, or safety net
 *   📢 notice        — info that isn't a ship (beta status, schedule, etc.)
 *
 * Each entry can carry an optional in-app link so users can jump
 * straight to the surface that changed.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

type EntryKind = 'feature' | 'improvement' | 'fix' | 'notice';

interface WhatsNewEntry {
  /** ISO date 'YYYY-MM-DD'. Used both for sort + display grouping. */
  date: string;
  kind: EntryKind;
  title: string;
  description: string;
  /** Optional in-app link the entry refers to. Use relative paths only. */
  link?: { to: string; label: string };
}

const KIND_LABEL: Record<EntryKind, { emoji: string; label: string; cls: string }> = {
  feature: { emoji: '✨', label: 'Feature', cls: 'bg-ga-accent/10 text-ga-accent border-ga-accent/30' },
  improvement: { emoji: '🔧', label: 'Improvement', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  fix: { emoji: '🐛', label: 'Fix', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  notice: { emoji: '📢', label: 'Notice', cls: 'bg-purple-500/10 text-purple-700 border-purple-500/30' },
};

// ---------------------------------------------------------------------------
// THE CHANGELOG. Newest first. Add an entry when shipping a user-visible change.
// Keep titles short (<60 chars) and descriptions to ~2 sentences. Optional
// link should land on the surface that changed.
// ---------------------------------------------------------------------------
const ENTRIES: WhatsNewEntry[] = [
  {
    date: '2026-05-04',
    kind: 'feature',
    title: 'Plan & shop from a recipe',
    description:
      'Tap 📝 Plan & shop on any recipe to see what you have vs need to buy. Auto-adds missing ingredients to your shopping list with the recipe name in the notes. Mark items used right there if you already finished them.',
    link: { to: '/meals', label: 'Open Meals' },
  },
  {
    date: '2026-05-04',
    kind: 'feature',
    title: 'In-app feedback button',
    description:
      'Tap the floating 💬 anywhere in the app to send feedback. Bug, feature, or general — admin sees it and replies. Your replies show up in the My feedback tab here.',
  },
  {
    date: '2026-05-04',
    kind: 'feature',
    title: 'Multi-household support',
    description:
      'You can be a member of multiple households now. You still own at most one. Switch between them via the household pill in the top-right of every page; each scope shows only that household\'s inventory, spending, and waste.',
    link: { to: '/settings', label: 'Manage households' },
  },
  {
    date: '2026-05-04',
    kind: 'improvement',
    title: '"This item doesn\'t expire" toggle',
    description:
      'Logged dish soap, soy sauce, salt or rice for spend tracking? Open the catalog page → toggle "This item doesn\'t expire". The 7/14/21-day reminder cycle skips it forever after.',
    link: { to: '/catalog', label: 'Open My Catalog' },
  },
  {
    date: '2026-05-04',
    kind: 'fix',
    title: 'Cook flow now warns on sub-portion mismatches',
    description:
      'When a recipe wants 1 tsp from a 1-bottle inventory event, the cook checklist pre-unchecks that row + shows a warning. Stops the "whole bottle wiped out" surprise.',
  },
  {
    date: '2026-05-04',
    kind: 'notice',
    title: 'Beta chips on Preppers + Homemaker surfaces',
    description:
      'Surfaces that are still being shaped now carry visible Beta chips (amber for Preppers, purple for Homemaker). Tells you what\'s stable vs what\'s evolving. Tell us if anything breaks.',
  },
  {
    date: '2026-05-04',
    kind: 'improvement',
    title: '"What does this page show?" helpers everywhere',
    description:
      'Every user-facing page now has a small expandable explainer at the top — what each section means, where the numbers come from, what the buttons do.',
  },
];


export default function WhatsNewTab() {
  // Sort newest-first, then group consecutive entries by date.
  const sorted = [...ENTRIES].sort((a, b) => b.date.localeCompare(a.date));
  const groups: Array<{ date: string; entries: WhatsNewEntry[] }> = [];
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.entries.push(e);
    else groups.push({ date: e.date, entries: [e] });
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-ga-text-primary">What&apos;s new</h2>
        <p className="text-xs text-ga-text-secondary leading-snug">
          Things shipped, things changed, things to know about. Newest first.
        </p>
      </header>

      {groups.length === 0 && (
        <p className="text-sm text-ga-text-secondary italic">
          Nothing logged yet — check back after the next release.
        </p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.date} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ga-text-secondary">
              {formatDate(group.date)}
            </h3>
            <ul className="space-y-2">
              {group.entries.map((e, i) => (
                <li key={`${group.date}-${i}`}>
                  <EntryCard entry={e} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}


function EntryCard({ entry }: { entry: WhatsNewEntry }) {
  const cfg = KIND_LABEL[entry.kind];
  return (
    <div className="border border-ga-border rounded-lg p-3.5 space-y-1.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={cn(
            'text-[10px] uppercase tracking-wider font-medium border rounded-full px-2 py-0.5',
            cfg.cls,
          )}
        >
          <span aria-hidden="true">{cfg.emoji}</span> {cfg.label}
        </span>
        <h4 className="text-sm font-semibold text-ga-text-primary leading-snug">
          {entry.title}
        </h4>
      </div>
      <p className="text-sm text-ga-text-secondary leading-snug">{entry.description}</p>
      {entry.link && (
        <Link
          to={entry.link.to}
          className="inline-block text-xs text-ga-accent hover:underline mt-1"
        >
          {entry.link.label} →
        </Link>
      )}
    </div>
  );
}


function formatDate(iso: string): string {
  // 2026-05-04 → "May 4, 2026"
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}
