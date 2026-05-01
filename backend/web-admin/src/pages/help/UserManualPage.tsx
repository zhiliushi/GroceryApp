import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/utils/cn';

/**
 * User manual — single-source-of-truth user-facing help page.
 *
 * The structure mirrors the user's mental model (getting started →
 * adding → tracking → spending/waste → maintenance → tier → FAQ),
 * not the codebase's module structure. When a feature is added or
 * changed, the relevant section here is updated in the same PR — see
 * `.claude/docs/pages/user-manual.md` for the discipline rule.
 *
 * Tier badges (Free / Plus / Pro) are derived from the same
 * `_DEFAULT_TIERS` config in `backend/app/services/config_service.py`
 * — keep them in sync if pricing or limits change.
 */

interface Section {
  id: string;
  title: string;
}

const SECTIONS: Section[] = [
  { id: 'getting-started', title: '1. Getting started' },
  { id: 'adding-items', title: '2. Adding items' },
  { id: 'tracking-items', title: '3. Tracking what you have' },
  { id: 'using-items', title: '4. Use, move, throw, donate' },
  { id: 'spending', title: '5. Tracking spending' },
  { id: 'waste', title: '6. Tracking waste' },
  { id: 'reminders-insights', title: '7. Reminders & insights' },
  { id: 'catalog', title: '8. Your personal catalog' },
  { id: 'tiers', title: '9. Free vs paid' },
  { id: 'faq', title: '10. FAQ' },
];

export default function UserManualPage() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  // Active-section indicator on the side TOC: pick whichever heading
  // is closest to the top of the viewport. Updates on scroll, throttled
  // by requestAnimationFrame so it stays cheap on long pages.
  useEffect(() => {
    let raf = 0;
    function update() {
      const tops = SECTIONS.map((s) => {
        const el = document.getElementById(s.id);
        return { id: s.id, top: el ? el.getBoundingClientRect().top : Infinity };
      });
      const cur =
        tops
          .filter((t) => t.top <= 120)
          .sort((a, b) => b.top - a.top)[0]?.id || SECTIONS[0].id;
      setActiveId(cur);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="User manual"
        subtitle="How GroceryApp works, in plain language. Bookmark this page."
      />

      <div className="grid md:grid-cols-[200px,1fr] gap-6">
        {/* Sticky TOC on desktop. On mobile this becomes a top jump-list. */}
        <nav className="md:sticky md:top-4 md:self-start text-sm">
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-3">
            <div className="text-[11px] uppercase tracking-wider text-ga-text-secondary mb-2">
              Contents
            </div>
            <ul className="space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      'block px-2 py-1 rounded text-xs hover:bg-ga-bg-hover',
                      activeId === s.id
                        ? 'bg-ga-accent/10 text-ga-accent font-medium'
                        : 'text-ga-text-secondary',
                    )}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="space-y-8 text-sm leading-relaxed text-ga-text-primary">
          <GettingStarted />
          <AddingItems />
          <TrackingItems />
          <UsingItems />
          <Spending />
          <Waste />
          <RemindersInsights />
          <Catalog />
          <Tiers />
          <Faq />

          <footer className="pt-6 border-t border-ga-border text-xs text-ga-text-secondary">
            Manual last updated alongside the codebase. Found something out of
            date? Tell the admin — the manual is meant to mirror what the app
            actually does.
          </footer>
        </article>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components — kept in this file so contributors editing a single
// feature see the manual alongside the code that implements it.
// ---------------------------------------------------------------------------

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-lg font-semibold text-ga-text-primary scroll-mt-4 pt-2"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-ga-text-primary mt-4 mb-1">
      {children}
    </h3>
  );
}

function Tier({
  level,
}: {
  level: 'free' | 'plus' | 'pro' | 'always-free' | 'admin';
}) {
  const cfg = {
    free: { label: 'Free', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
    plus: { label: 'Plus', cls: 'bg-blue-50 text-blue-700 border-blue-300' },
    pro: { label: 'Pro', cls: 'bg-purple-50 text-purple-700 border-purple-300' },
    'always-free': {
      label: 'Always free',
      cls: 'bg-green-50 text-green-700 border-green-300',
    },
    admin: { label: 'Admin', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  }[level];
  return (
    <span
      className={cn(
        'inline-block ml-2 px-1.5 py-0.5 text-[10px] font-medium border rounded uppercase tracking-wider align-middle',
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ── 1. Getting started ────────────────────────────────────────────────────

function GettingStarted() {
  return (
    <section className="space-y-2">
      <H2 id="getting-started">1. Getting started</H2>
      <p>
        GroceryApp is a <strong>waste-prevention app</strong>. Every feature in
        the app exists to answer one of three questions:
      </p>
      <ol className="list-decimal pl-5 space-y-1">
        <li>What do I have, and what's about to go bad?</li>
        <li>How much did I spend, and on what?</li>
        <li>How much did I waste, and why?</li>
      </ol>
      <p>
        The app gets out of the way. There are no upfront forms — you give an
        item a name, optionally an expiry, and you're done. Everything else
        (price, location, payment method, barcode) is optional and can be
        filled in later.
      </p>

      <H3>The dashboard</H3>
      <p>
        Open the app and you land on{' '}
        <Link to="/dashboard" className="text-ga-accent hover:underline">
          Dashboard
        </Link>
        . Top to bottom, it shows:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Your spending</strong> — three cards (this week / this month
          / last month) in your preferred currency. Tap any card to see the 5
          most expensive purchases in that period.
        </li>
        <li>
          <strong>What you wasted</strong> — same three-card structure for
          items thrown. Tap to see the most expensive wasted items.
        </li>
        <li>
          <strong>Use these soon</strong> — items expiring in the next 3 days
          and items already past expiry, grouped by where they live (fridge,
          pantry, etc). Each item has a one-tap "Use…" button.
        </li>
        <li>
          <strong>Inventory glance</strong> — one-line plain summary: how many
          items in stock, how many expiring, how many already expired.
        </li>
        <li>
          <strong>Insights</strong> and <strong>Frequently bought</strong> —
          quick re-buy and milestone reflections.
        </li>
      </ul>
    </section>
  );
}

// ── 2. Adding items ────────────────────────────────────────────────────────

function AddingItems() {
  return (
    <section className="space-y-2">
      <H2 id="adding-items">2. Adding items</H2>
      <p>
        There are <strong>three ways</strong> to add an item — pick whichever
        is fastest for the moment.
      </p>

      <H3>A. Add item button (manual)</H3>
      <p>
        The <code>+ Add item</code> pill at the top-right opens the Quick Add
        modal.
      </p>
      <ol className="list-decimal pl-5 space-y-1">
        <li>
          <strong>Name</strong> the item (required). Typing shows
          autocomplete suggestions from your catalog so you don't accidentally
          create "Milk" and "milk" as separate rows.
        </li>
        <li>
          <strong>Expiry</strong> (optional). Plain language works:
          "tomorrow", "next week", "in 5 days", or an ISO date like{' '}
          <code>2026-06-01</code>. Type "no expiry" for non-perishables.
        </li>
        <li>
          <strong>Location</strong> (fridge / pantry / freezer / counter). If
          the item exists in your catalog, the location it usually goes in is
          pre-filled.
        </li>
        <li>
          Click <code>▼ More</code> for optional barcode, price, payment
          method.
        </li>
        <li>
          Press <strong>Save</strong>.
        </li>
      </ol>

      <H3>B. Scan a barcode</H3>
      <p>
        The <code>📷 Scan</code> pill (top-right, next to Add) opens the
        scanner.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          If the barcode is known, the catalog match is shown — confirm and
          add.
        </li>
        <li>
          If unknown, give it a name. The app remembers the
          name↔barcode link so the next scan is one tap.
        </li>
        <li>
          The shopping-list and bulk-actions surfaces also accept scans.{' '}
          <Tier level="plus" />
        </li>
      </ul>

      <H3>C. Quick re-add</H3>
      <p>
        On the Dashboard's <strong>Frequently bought</strong> card, every row
        has a <code>+ Add</code> button that pre-fills Quick Add with that
        item's catalog defaults — for the things you re-buy every week, this
        is one tap.
      </p>

      <H3>Multi-pack purchases</H3>
      <p>
        Bought 4 packs of eggs, each with 6 eggs? Use the multi-pack option
        when adding. The app stores it as 4 events of "1 pack × 6 eggs/pack"
        so you can later "Use 3 eggs" without doing pack-fraction math
        yourself.
      </p>
    </section>
  );
}

// ── 3. Tracking what you have ──────────────────────────────────────────────

function TrackingItems() {
  return (
    <section className="space-y-2">
      <H2 id="tracking-items">3. Tracking what you have</H2>
      <p>
        Three places to look at your stock, depending on what you want
        to do.
      </p>

      <H3>From the dashboard — quick glance</H3>
      <p>
        The <strong>"What's in your kitchen"</strong> card on the dashboard
        lists up to 8 items you have right now, sorted by what's expiring
        first. Each row shows the quantity, where it's stored, and an
        expiry chip (red / orange / yellow / green). Tap any row to open
        its detail page.
      </p>

      <H3>Per-item inventory detail</H3>
      <p>
        Tap an item from the dashboard list (or the item name on My Items)
        to open the inventory detail page at <code>/inventory/{'{name}'}</code>.
        It's a focused, action-first view of one item:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Hero</strong> — name, total available across all packs
          (in eggs / ml / g — base units), urgency banner.
        </li>
        <li>
          <strong>Per-location chips</strong> — "Fridge: 6 · Pantry: 12".
        </li>
        <li>
          <strong>Per-pack list</strong> — every active pack as its own
          row with Use / Move / Throw / Give-away buttons. Sorted so the
          most urgent pack is at the top.
        </li>
        <li>
          <strong>"+ Buy more"</strong> top-right opens Quick Add prefilled
          with this item.
        </li>
      </ul>
      <p className="text-xs text-ga-text-secondary">
        The inventory page is deliberately current-state only. For price
        history, waste analysis, or to rename / merge / delete the catalog
        row, use the <strong>"Full price history & analysis →"</strong> link
        at the bottom (goes to the manager view at{' '}
        <code>/catalog/{'{name}'}</code>).
      </p>

      <H3>The full list — My Items</H3>
      <p>
        <Link to="/my-items" className="text-ga-accent hover:underline">
          My Items
        </Link>{' '}
        is the full list of every active purchase grouped by catalog row.
        Filter by location, expiry urgency, or status. Each row also
        lets you drill to the per-pack detail page (movement timeline,
        partial-action lineage, restore button if the pack was
        accidentally marked used or thrown).
      </p>
    </section>
  );
}

// ── 4. Using items ─────────────────────────────────────────────────────────

function UsingItems() {
  return (
    <section className="space-y-2">
      <H2 id="using-items">4. Use, move, throw, donate</H2>

      <H3>Use… (partial-pack supported)</H3>
      <p>
        Click <strong>Use…</strong> on any item to open the Mark-used modal.
        It works in <em>base units</em> — "use 3 eggs" not "use 0.5 packs".
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          The slider step adapts to the unit type — count items step by 1,
          ml/g items step by 10/50/100 depending on container size.
        </li>
        <li>
          When you have only 1 unit available, the modal becomes a simple
          "Mark all 1 unit as used" confirmation.
        </li>
        <li>
          A 7-day undo toast appears after every action — for older
          mistakes, use the Restore button on the item detail page.
        </li>
      </ul>

      <H3>Move location</H3>
      <p>
        Use <strong>Move</strong> to reassign the item to a different storage
        location (fridge → freezer, etc). Useful when you batch-cook and
        store leftovers in a different place than where the ingredient
        started.
      </p>

      <H3>Throw away</H3>
      <p>
        <strong>Throw</strong> records the item as wasted. The cost (in your
        currency) flows into the waste scoreboard. Like Use, partial-pack
        throws are supported — "threw 2 of 6 eggs because they cracked"
        keeps the other 4 active.
      </p>

      <H3>Give away / Donate</H3>
      <p>
        <strong>Give away</strong> records the item as transferred to
        someone — friend, neighbour, or food bank. It doesn't count as
        waste because the food was eaten, just not by you. The{' '}
        <Link to="/foodbanks" className="text-ga-accent hover:underline">
          Foodbanks
        </Link>{' '}
        page <Tier level="always-free" /> shows nearby food banks on a map.
      </p>
    </section>
  );
}

// ── 5. Spending ────────────────────────────────────────────────────────────

function Spending() {
  return (
    <section className="space-y-2">
      <H2 id="spending">5. Tracking spending</H2>
      <p>
        Spending is recorded automatically when you add a price to a
        purchase. Three places to view it:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Dashboard scoreboard</strong> — three cards (this week /
          this month / last month). Tap any card to see the 5 most expensive
          purchases for that period.
        </li>
        <li>
          <Link to="/spending" className="text-ga-accent hover:underline">
            Spending page
          </Link>{' '}
          — full breakdown by month, by store, by payment method (cash / card
          / no-method-recorded).
        </li>
        <li>
          <strong>Item detail</strong> — every purchase event shows its own
          price.
        </li>
      </ul>

      <H3>Currency settings</H3>
      <p>
        Set your preferred currency in{' '}
        <Link to="/settings" className="text-ga-accent hover:underline">
          Settings
        </Link>
        . Every spending and waste figure on the dashboard is converted to
        that currency at <strong>read time</strong> using the current FX
        rate. So if you bought milk in SGD while travelling, your Malaysian
        Ringgit dashboard shows it in RM at today's rate.
      </p>
      <p>
        The original purchase currency is preserved on the event itself — the
        item detail page shows both the original amount and the converted
        amount.
      </p>

      <H3>Untracked purchases</H3>
      <p>
        If you add an item without a price, it counts as "no price recorded"
        — visible on the spending card as a footnote. Open the item detail
        page and add a price to bring it into the totals.
      </p>
    </section>
  );
}

// ── 6. Waste ───────────────────────────────────────────────────────────────

function Waste() {
  return (
    <section className="space-y-2">
      <H2 id="waste">6. Tracking waste</H2>
      <p>
        Waste = items marked <strong>thrown</strong>. The waste scoreboard
        leads with cost (in your currency), not count, because two RM-12
        items thrown is the lesson, not ten RM-0.50 items thrown.
      </p>

      <H3>What gets counted</H3>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Items you mark <strong>Thrown</strong> count as waste.
        </li>
        <li>
          Items marked <strong>Used</strong> or <strong>Given away</strong>{' '}
          do not — they were eaten, just not by you.
        </li>
        <li>
          Items past expiry that you haven't acted on are flagged on the
          dashboard (<strong>Use these soon</strong> red strip) but only
          become waste once you actually mark them thrown.
        </li>
      </ul>

      <H3>Where to look</H3>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Dashboard</strong> — three-card scoreboard, same shape as
          spending. Tap any card for the 5 most expensive thrown items in the
          period.
        </li>
        <li>
          <Link to="/waste" className="text-ga-accent hover:underline">
            Waste page
          </Link>{' '}
          — full per-item history with reasons.
        </li>
        <li>
          <strong>Insights</strong>{' '}
          <Tier level="plus" /> calls out repeat-waste patterns — "you've
          thrown lettuce 4 times this year, average 3 days after buying".
        </li>
      </ul>
    </section>
  );
}

// ── 7. Reminders & insights ────────────────────────────────────────────────

function RemindersInsights() {
  return (
    <section className="space-y-2">
      <H2 id="reminders-insights">7. Reminders & insights</H2>

      <H3>Reminders</H3>
      <p>
        The{' '}
        <Link to="/reminders" className="text-ga-accent hover:underline">
          Reminders
        </Link>{' '}
        page surfaces items expiring at staged thresholds (7d / 3d / 0d).
        Each item has a one-tap action to dismiss or to use.
      </p>

      <H3>Progressive nudges</H3>
      <p>
        After 5 items, the app starts asking for missing fields it thinks
        you'll want — first expiry dates, then prices, then volumes.
        Dismissable and configurable in feature flags.
      </p>

      <H3>Insights</H3>
      <p>
        At 50, 100, 500, and 1000 lifetime purchases, the app generates
        milestone summaries — top items bought, your seasonal patterns,
        money saved by not wasting. View them on the{' '}
        <Link to="/insights" className="text-ga-accent hover:underline">
          Insights
        </Link>{' '}
        page.
      </p>
    </section>
  );
}

// ── 8. Catalog ─────────────────────────────────────────────────────────────

function Catalog() {
  return (
    <section className="space-y-2">
      <H2 id="catalog">8. Your personal catalog</H2>
      <p>
        Your{' '}
        <Link to="/catalog" className="text-ga-accent hover:underline">
          Catalog
        </Link>{' '}
        is your reusable name list — one row per item you buy regularly.
        It's what makes scanning, autocomplete, and re-buy work.
      </p>

      <H3>What lives on a catalog row</H3>
      <ul className="list-disc pl-5 space-y-1">
        <li>The display name (you can rename anytime).</li>
        <li>An optional barcode (shared across all packs of the same item).</li>
        <li>Default location — auto-fills the Add modal.</li>
        <li>
          <strong>Unit type</strong> — count, volume, weight, or container.
          Drives the input shape on the Use modal (eggs use a spinner; milk
          uses an ml slider; meat uses a g slider). Editable from{' '}
          <em>Manage this item</em> on the catalog row.
        </li>
        <li>
          Stats — times bought, last bought, your typical price, waste rate.
        </li>
      </ul>

      <H3>Catalog cleanup (free users)</H3>
      <p>
        <Tier level="free" /> Catalog rows without a barcode have a{' '}
        <strong>30-day idle counter</strong>. If you don't touch the row
        (open it, add a new purchase, edit it) for 30 days, the system asks
        whether to keep or remove it. This keeps the autocomplete list
        relevant. <Tier level="plus" /> <Tier level="pro" /> Paid users are
        exempt from idle cleanup.
      </p>

      <H3>Restore a deleted item</H3>
      <p>
        If you accidentally marked something used or thrown, open it from My
        Items and click the <strong>↺ Restore to active</strong> button. The
        original quantity, location, and expiry come back.
      </p>
    </section>
  );
}

// ── 9. Tiers ───────────────────────────────────────────────────────────────

function Tiers() {
  return (
    <section className="space-y-2">
      <H2 id="tiers">9. Free vs paid</H2>
      <p>
        Three tiers, plus an "always free" floor for the Foodbank Finder. Tier
        choice is changed in{' '}
        <Link to="/settings" className="text-ga-accent hover:underline">
          Settings → Subscription
        </Link>
        . The numbers below are the current published limits; the
        authoritative source is the backend's tier config.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-ga-border rounded-lg overflow-hidden">
          <thead className="bg-ga-bg-hover/40">
            <tr>
              <th className="text-left px-3 py-2 border-b border-ga-border">Feature</th>
              <th className="text-left px-3 py-2 border-b border-ga-border">
                Basic Basket
                <div className="text-[10px] text-ga-text-secondary font-normal">free</div>
              </th>
              <th className="text-left px-3 py-2 border-b border-ga-border">
                Smart Cart
                <div className="text-[10px] text-ga-text-secondary font-normal">RM 5.99 / mo</div>
              </th>
              <th className="text-left px-3 py-2 border-b border-ga-border">
                Full Fridge
                <div className="text-[10px] text-ga-text-secondary font-normal">RM 12.99 / mo</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ga-border">
            <Row label="Items in catalog" cells={['up to 50', 'unlimited', 'unlimited']} />
            <Row label="Shopping lists" cells={['up to 3', 'unlimited', 'unlimited']} />
            <Row label="History retention" cells={['90 days', '365 days', 'unlimited']} />
            <Row label="Barcode scans / day" cells={['20', 'unlimited', 'unlimited']} />
            <Row
              label="Catalog idle cleanup"
              cells={['30-day counter', 'exempt', 'exempt']}
            />
            <Row
              label="Bulk actions"
              cells={['—', '✓', '✓']}
            />
            <Row label="Receipt OCR" cells={['—', 'pick 1 of 3 tools', '✓ included']} />
            <Row label="Price tracking" cells={['—', 'pick 1 of 3 tools', '✓ included']} />
            <Row label="Cloud sync (multi-device)" cells={['—', 'pick 1 of 3 tools', '✓ included']} />
            <Row label="Basic analytics" cells={['—', 'pick 1 of 3 tools', '✓ included']} />
            <Row label="Advanced analytics + price comparison" cells={['—', 'pick 1 of 3 tools', '✓ included']} />
            <Row label="Data export" cells={['—', 'pick 1 of 3 tools', '✓ included']} />
            <Row
              label="Foodbank Finder"
              cells={['✓ always free', '✓', '✓']}
            />
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ga-text-secondary">
        Smart Cart = pick any 3 tools from the menu. Full Fridge = everything
        unlocked, no limits. AI Chef (recipe suggestions, smart shopping
        lists) is a separate add-on, pricing TBD.
      </p>
    </section>
  );
}

function Row({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium text-ga-text-primary">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="px-3 py-2 text-ga-text-secondary">
          {c}
        </td>
      ))}
    </tr>
  );
}

// ── 10. FAQ ────────────────────────────────────────────────────────────────

function Faq() {
  return (
    <section className="space-y-2">
      <H2 id="faq">10. FAQ</H2>

      <Question q="My spending dashboard shows RM but I bought the item in SGD. Why?">
        Spending and waste figures are converted to your{' '}
        <em>currency_preference</em> (set in Settings) at read time, using
        the current FX rate. The item detail page still shows the original
        amount and currency.
      </Question>

      <Question q='I clicked "Use 1" and lost a whole pack of eggs. How do I get them back?'>
        Open the affected event from My Items and click{' '}
        <strong>↺ Restore to active</strong>. The original quantity comes
        back. The destructive "Use 1" inline button is gone — Use… now
        always opens the slider modal and operates in base units.
      </Question>

      <Question q='Where did "Inventory Health 73" go?'>
        Replaced by a one-line plain-language pill row on the dashboard:
        "26 items in stock · 3 expiring in 3 days · 3 already expired". The
        full health-score view still exists at{' '}
        <Link to="/health-score" className="text-ga-accent hover:underline">
          /health-score
        </Link>
        .
      </Question>

      <Question q="Why does a purchase show 'no price recorded'?">
        You added the item without entering a price. Open it from My Items
        and add the price — it will start counting toward your spending and
        (if thrown) waste totals.
      </Question>

      <Question q="My catalog row says it'll be deleted in 30 days. What do I do?">
        Either touch the row (open it, add a new purchase, or rename it),
        which resets the idle counter — or upgrade to Smart Cart / Full
        Fridge, which removes the counter entirely.
      </Question>

      <Question q="Do I need to scan barcodes? I just buy fresh produce.">
        No. The catalog is name-centric — barcodes are an optional
        accelerator. Type "tomatoes", set a location, save.
      </Question>

      <Question q={`What's the difference between "Use" and "Throw away"?`}>
        Use = consumed, didn't waste it. Throw = wasted, didn't eat it. Only
        Throw counts against your waste scoreboard. Give away = transferred
        to someone else; doesn't count as waste either.
      </Question>

      <Question q="Can I share a list with my family?">
        Household sharing is on the roadmap (deferred design in
        FUTURE_HOUSEHOLD_CATALOG_MERGE). For now, each user has their own
        catalog and lists.
      </Question>
    </section>
  );
}

function Question({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ga-border py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center justify-between gap-2 hover:opacity-90"
      >
        <span className="font-medium text-ga-text-primary text-sm">{q}</span>
        <span className="text-xs text-ga-text-secondary flex-shrink-0">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="mt-2 text-ga-text-secondary text-sm leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
