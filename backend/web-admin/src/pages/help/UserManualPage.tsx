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
  { id: 'meals-homemaker', title: '10. Meals: Homemaker add-on' },
  { id: 'preppers', title: '11. Preppers (beta)' },
  { id: 'faq', title: '12. FAQ' },
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
          <MealsHomemaker />
          <Preppers />
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

      <H3>Signing in</H3>
      <p>
        Two ways to sign in on the <strong>Sign in</strong> screen:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Email + password</strong> — what you set when you created the account.
          Forgot it? Type your email above the form, then tap <em>Forgot password?</em> —
          Firebase emails you a one-time reset link.
        </li>
        <li>
          <strong>Sign in with Google</strong> — uses your Google account. No separate
          password to remember, no verification email needed. You can link Google later
          from <Link to="/settings" className="text-ga-accent hover:underline">Settings</Link>{' '}
          if you started with email + password.
        </li>
      </ul>
      <p className="text-xs text-ga-text-secondary">
        If neither option lets you in, you may have hit one of the gating screens below
        — look for the matching icon.
      </p>

      <H3>Joining via an invite link</H3>
      <p>
        Household invitations come as a link like <code>/join/ABC123</code>. Open it in
        your browser:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          If you&apos;re not signed in yet, tap <em>Sign in to join</em>. The code stays
          remembered through sign-in, and your account skips the admin approval queue
          (invited accounts are auto-approved).
        </li>
        <li>
          If you&apos;re already signed in and active, you&apos;ll see &quot;Join {`{household}`}&quot;
          with the role the inviter picked. Tap <em>Join Household</em> to confirm, or{' '}
          <em>Cancel</em> to keep the link valid for later.
        </li>
        <li>
          <strong>Codes are email-bound</strong> — sign in with the email address that
          received the invitation. A code generated for one email won&apos;t work on a
          different account.
        </li>
        <li>
          Invitations expire (admin-set window). If yours has, ask the inviter to
          generate a fresh one.
        </li>
      </ul>

      <H3>Filling in your registration</H3>
      <p>
        When you reach the <strong>&quot;Tell us about you&quot;</strong> screen, three fields:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Display name</strong> — what household members and shopping-list
          collaborators see next to your actions. Editable later in Settings.
        </li>
        <li>
          <strong>Country</strong> — pre-filled from your browser locale. Used to
          suggest local foodbanks and to pick a default currency.
        </li>
        <li>
          <strong>Currency</strong> — re-derives when you change country. Past prices
          keep their original FX rate; only future entries use the new setting. Editable
          later in Settings.
        </li>
      </ul>
      <p>
        Submitting takes you to the dashboard. If you arrived via an invite link, the
        backend auto-accepts the invitation on submit and joins you to the household
        before redirect.
      </p>

      <H3>Account-state screens</H3>
      <p>
        GroceryApp is in <strong>closed beta</strong> — sign-up is gated. Depending on
        how you arrived, you may see one of these screens before the dashboard:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>✉️ Verify your email</strong> — appears right after you create an
          account with email + password. Click the link in the email Firebase sent you,
          then come back and tap <em>I&apos;ve verified — refresh</em>. If the email didn&apos;t
          arrive, check spam, or use <em>Resend</em> (60-second cooldown). Replies to
          that email bounce — it&apos;s automated.
        </li>
        <li>
          <strong>⏳ Awaiting approval</strong> — appears for self-signup users while
          an admin reviews your account. The page auto-checks every 30 seconds for the
          first 30 minutes, then you can tap <em>Check approval status</em> manually.
          Most requests are reviewed within 24 hours. If someone in your household sends
          you an invitation email, opening that link skips this queue entirely.
        </li>
        <li>
          <strong>🚧 Registration closed</strong> — appears when admin has paused new
          sign-ups, or capacity is full. Invite links bypass this gate; otherwise sign
          out and check back later.
        </li>
        <li>
          <strong>🚫 Account disabled</strong> — terminal state. An admin disabled the
          account; signing out and back in won&apos;t help. Contact the admin.
        </li>
      </ul>
      <p className="text-xs text-ga-text-secondary">
        Once approved + registration filled in, you go straight to the dashboard on
        every subsequent sign-in.
      </p>

      <H3>Belonging to more than one household</H3>
      <p>
        You can own at most one household, but you can be a <em>member</em> of as
        many as you&apos;re invited to. So a parent can own their family household
        AND be a member of their parents&apos; household, or a friend group&apos;s pantry,
        without losing either.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Joining another household</strong> — open the invite link.
          The page shows "You&apos;re already in <em>HouseholdA</em>" and joining
          keeps that membership. You&apos;ll see both in the active-household pill
          at the top of every page.
        </li>
        <li>
          <strong>Switching scope</strong> — tap the household pill (top right
          on desktop) to choose which household&apos;s inventory, shopping list,
          spending and waste totals you&apos;re viewing. Each page reads from one
          scope at a time so the dashboard numbers stay meaningful.
        </li>
        <li>
          <strong>Creating your own</strong> — if you&apos;re a member of someone
          else&apos;s household but not yet an owner, <em>Settings → Household</em>
          surfaces a "Create your own household" link. Existing memberships
          stay intact.
        </li>
        <li>
          <strong>Leaving</strong> — you can leave any household you&apos;re a
          member of without affecting the others. If the household you&apos;re
          actively viewing is the one you leave, the app falls back to another
          one you&apos;re in.
        </li>
      </ul>
      <p className="text-xs text-ga-text-secondary">
        Tier features (Plus / Pro) come from the household&apos;s owner — so a
        member of a Plus household sees Plus features there, even on a Free
        account elsewhere. The pill shows each household&apos;s tier when you have
        more than one.
      </p>

      <H3>Privacy &amp; Terms</H3>
      <p>
        Two reference documents linked from{' '}
        <Link to="/settings" className="text-ga-accent hover:underline">Settings</Link>{' '}
        → Legal:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <Link to="/privacy" className="text-ga-accent hover:underline">
            Privacy Policy
          </Link>{' '}
          — what we collect, why, where it&apos;s stored, how long we keep it, and how
          to ask for a copy or deletion (PDPA Malaysia + equivalents).
        </li>
        <li>
          <Link to="/terms" className="text-ga-accent hover:underline">
            Terms of Service
          </Link>{' '}
          — the agreement that lets you use the app. Most-asked sections:{' '}
          <em>account responsibilities</em>, <em>your content</em>, and the food-safety
          disclaimer (the app is a tracking aid, not a food-safety oracle — when in
          doubt, throw it out).
        </li>
      </ul>
      <p className="text-xs text-ga-text-secondary">
        Both pages are public — you can read them without signing in. Material changes
        are announced in-app and by email; the &quot;Last updated&quot; date at the top reflects
        the most recent meaningful change.
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

      <H3>
        D. Shopping list — three steps: list, compare, checkout{' '}
        <Link to="/shopping-lists" className="text-xs text-ga-accent hover:underline">
          (open)
        </Link>
      </H3>
      <p>
        For things you haven't bought yet but want to remember, use{' '}
        <Link to="/shopping-lists" className="text-ga-accent hover:underline">
          Shopping Lists
        </Link>
        . The flow has <strong>three steps</strong>:
      </p>
      <ol className="list-decimal pl-5 space-y-1">
        <li>
          <strong>List the intent (primary)</strong> — type the name (qty /
          weight / volume optional), pick from your existing catalog, or
          scan a barcode. The primary represents <em>what you want</em> —
          e.g. "Eggs."
        </li>
        <li>
          <strong>Compare alternatives</strong> — under each primary, add up
          to 3 alternatives that satisfy that intent (Brand A 12-pack, Brand
          B 6-pack organic, etc.). Each alternative carries brand, store,
          price, barcode, and pack count × pack size. Use{' '}
          <code>📷</code> on a primary row to scan a candidate. Use{' '}
          <code>Use as alt</code> when you're not comparing — it copies the
          primary as a single alternative so you can tick + buy.
        </li>
        <li>
          <strong>Tick to checkout</strong> — tick any alternatives you
          actually bought (the checkbox at the start of each alternative
          row). The sticky footer shows the running total, list estimate,
          and delta. Pick a store + date, then{' '}
          <code>Confirm checkout</code> — items land in your default storage
          (set in Settings → Shopping list), the trip is recorded, and the
          ticked alternatives' parent primaries are removed from the list.
          Untouched primaries stay.
        </li>
      </ol>
      <p className="text-xs text-ga-text-secondary">
        <strong>Other entry points</strong>:{' '}
        <code>📷 Scan to buy</code> on the list page is a one-tap shortcut
        when you're at the store — it adds the scanned item AND auto-ticks
        it for the active checkout. Catalog item detail pages have a{' '}
        <code>+ Add to shopping list</code> button. Receipts (Plus tier) can
        also feed items in via OCR.
      </p>
      <p className="text-xs text-ga-text-secondary">
        <strong>Beta caps</strong>: 15 primaries per list × 3 alternatives
        each. Items auto-clear 30 days after add. Quota is shared with the
        catalog (per the standard catalog rules). Subject to change before
        v1 ships.
      </p>

      <H3>Single vs Bulk</H3>
      <p>
        The Add Item modal has a <strong>Single / Bulk</strong> toggle near
        the quantity area. Pick whichever matches how you bought the item.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Single</strong> — one thing of a given size. Just enter
          quantity + unit. Examples:
          <ul className="list-disc pl-5">
            <li>"6 eggs" → 6 count</li>
            <li>"500 g of flour" → 500 g</li>
            <li>"1 L of milk" → 1 L</li>
          </ul>
        </li>
        <li>
          <strong>Bulk</strong> — multiple identical packs. Three inputs
          answer "<em># packs × items per pack × size each</em>". Each pack
          gets tracked as its own event with its own expiry, so 3 cartons
          can spoil at different times and the app catches each one.
          Examples:
          <ul className="list-disc pl-5">
            <li>3 cartons of 1 L milk: <code>3 × 1 × 1 L</code></li>
            <li>2 boxes of 12 eggs: <code>2 × 12 × 1 count</code></li>
            <li>3 cases of 4 bottles × 500 ml each: <code>3 × 4 × 500 ml</code></li>
          </ul>
        </li>
      </ul>

      <H3>Pack label (optional, but helpful)</H3>
      <p>
        In Bulk mode there's an optional <strong>pack label</strong> field
        — type "carton", "box", "bottle", "case", "bag", whatever it
        actually is. Suggestions appear as you type.
      </p>
      <p className="text-xs text-ga-text-secondary">
        It's optional, but it makes waste and spending recommendations more
        accurate. Without it, the system can only say "you wasted 500 ml
        of milk last week"; with it, the system can spot "you tend to
        throw 1 unfinished carton per week — try a smaller size next time".
      </p>

      <H3>What gets stored</H3>
      <p className="text-xs text-ga-text-secondary">
        Behind the scenes the app stores three numbers per purchase:
        <code> pack_count</code>, <code> pack_size</code> (= items per pack
        × size each, in base units), and <code> base_unit</code> (count /
        ml / L / g / kg). The Use modal works directly in base units — so
        "use 250 ml" out of a 1 L carton works without any pack-fraction
        math on your end.
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

      <H3>From the dashboard — by storage location</H3>
      <p>
        The <strong>"Your storage"</strong> card on the dashboard shows
        one row per storage location you have set up (Fridge, Pantry,
        Freezer, plus an Unsorted bucket if any items don't have a
        location). Each row shows the icon, name, pack count, the
        soonest-expiry chip, and a red "N expired" badge if anything is
        past expiry. Tap any row to open that location's detail page.
      </p>

      <H3>Per-storage detail page</H3>
      <p>
        At <code>/storage/{'{location}'}</code> you get a focused,
        action-first view of one storage area:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Hero</strong> — location icon + name, pack count,
          most-urgent expiry banner.
        </li>
        <li>
          <strong>Stat chips</strong> — "⚠ N expired", "⏰ N expiring
          soon" (only when there's something to flag).
        </li>
        <li>
          <strong>Pack list</strong> — every active pack stored here,
          sorted so the most urgent is on top. Each pack: item name +
          qty in base units + colored expiry chip + Use / Move / Throw
          buttons. Tap the item name to jump to that catalog row's full
          history.
        </li>
        <li>
          <strong>"+ Add here"</strong> top-right opens Quick Add
          prefilled with this location.
        </li>
      </ul>
      <p className="text-xs text-ga-text-secondary">
        The storage detail page is deliberately current-state only — no
        waste history, no price analytics. To manage the location itself
        (rename, change icon/color, reorder, add new locations), go to{' '}
        <Link to="/storage" className="text-ga-accent hover:underline">
          Storage
        </Link>{' '}
        from the sidebar.
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
            <Row label="Shopping lists (count)" cells={['up to 3', 'unlimited', 'unlimited']} />
            <Row
              label="Shopping list primaries per list"
              cells={['up to 15 (beta)', 'up to 15 (beta)', 'up to 15 (beta)']}
            />
            <Row
              label="Alternatives per primary"
              cells={['up to 3 (beta)', 'up to 3 (beta)', 'up to 3 (beta)']}
            />
            <Row
              label="Shopping list TTL"
              cells={['30 days', '30 days', '30 days']}
            />
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
        unlocked, no limits. <strong>Homemaker</strong> (recipe versioning +
        per-ingredient comments + per-version cost snapshots) is a separate
        add-on — see <a href="#meals-homemaker" className="text-ga-accent hover:underline">section 10</a>{' '}
        for what it does and why it's billed separately. AI Chef (recipe
        suggestions, smart shopping lists) is a future add-on, pricing TBD.
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

// ── 10. Meals: Homemaker add-on ────────────────────────────────────────────

function MealsHomemaker() {
  return (
    <section className="space-y-3">
      <H2 id="meals-homemaker">10. Meals: Homemaker add-on</H2>
      <p>
        Homemaker is a separate add-on for users who treat their recipe
        collection as a living thing — tweaking ingredients over time,
        annotating what worked, tracking what each version cost. It sits on
        top of any plan (Free, Smart Cart, or Full Fridge) and you only pay
        for it if you actually want these features.
      </p>

      <div className="bg-ga-bg-card border border-purple-500/30 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-purple-400">
          What you get with Homemaker
        </h3>

        <div>
          <h4 className="text-sm font-medium text-ga-text-primary">
            🕘 Recipe versioning
          </h4>
          <p className="text-xs text-ga-text-secondary mt-1">
            Edit a recipe's ingredients and the previous list is saved
            automatically. Open the <strong>History</strong> button in the
            recipe edit page to see every version, restore an older one, or
            compare what's changed. Up to 7 versions per recipe — when you
            edit the 8th time, the oldest version rotates out.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-ga-text-primary">
            ★ 📌 💬 Per-ingredient notes
          </h4>
          <p className="text-xs text-ga-text-secondary mt-1">
            Each ingredient row gets a star (you starred it = it bubbles to
            the top), a pin (manually keep an ingredient at the very top),
            and a comment thread for notes like "use the smaller eggs" or
            "skip if making for kids". Pin beats stars; stars are sorted by
            count.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-ga-text-primary">
            💰 Per-version cost snapshots
          </h4>
          <p className="text-xs text-ga-text-secondary mt-1">
            The recipe-cost estimate (visible to all users — last-paid price
            per ingredient) gets <em>captured</em> with each revision. So you
            can look at a recipe edit from 3 months ago and see what it cost
            to make at the time, vs today. Useful when comparing pre/post-
            inflation grocery bills, or seeing whether the "cheaper version"
            of a recipe actually saves money.
          </p>
          <p className="text-[11px] text-ga-text-secondary italic mt-1">
            v1 uses raw last-paid prices (not portion-aware — 1 egg or 2,
            same line). A weight × unit-price refinement is on the
            roadmap.
          </p>
        </div>
      </div>

      <div className="bg-ga-bg-app border border-ga-border rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-ga-text-primary">
          The fine print
        </h3>
        <ul className="text-xs text-ga-text-secondary space-y-1 pl-4 list-disc">
          <li>
            Recipe cap: <strong>500 recipes</strong> on Homemaker (vs 50 on
            Smart Cart / Full Fridge, 15 on free).
          </li>
          <li>
            Ingredient cap: <strong>25 ingredients per recipe</strong> —
            applies to <em>everyone</em>, Homemaker or not. If you're hitting
            it, the recipe is probably two recipes (main + sauce).
          </li>
          <li>
            Version cap: <strong>7 per recipe</strong>. The 8th edit rotates
            the oldest version out automatically. Restore creates a new
            revision from the current state first, so it's undoable.
          </li>
          <li>
            Comments are currently scoped to your own recipes. Household-
            wide comments (your spouse can comment on your recipe) is on the
            roadmap.
          </li>
          <li>
            Cooking method (the <em>steps</em>) is intentionally not
            versioned. Methods tend to stay constant while ingredients vary
            — versioning steps would mostly be noise. Tell us if your use
            case differs.
          </li>
        </ul>
      </div>

      <div className="bg-ga-bg-app border border-ga-border rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-ga-text-primary">
          Why is this billed separately?
        </h3>
        <p className="text-xs text-ga-text-secondary">
          Honest answer: the app is built and run by one developer (hi 👋)
          on rented cloud storage. Versioning + comments + per-version
          finance snapshots write a lot more data per recipe than the
          base app — multiple times more in some cases. Bundling all of
          that into the main subscription would mean charging every user,
          including the ones who just want barcode-scan + waste tracking.
          A separate billing line keeps the main app affordable for
          everyone while letting power users opt in to the heavier
          features without subsidizing them across the whole base.
        </p>
        <p className="text-xs text-ga-text-secondary">
          Pricing isn't pinned yet — it'll surface in{' '}
          <Link to="/settings" className="text-ga-accent hover:underline">
            Settings → Subscription
          </Link>
          {' '}when activation goes live. Cancel anytime; recipes you've
          created stay (versions and comments included), you just lose the
          ability to add new ones until you re-subscribe.
        </p>
      </div>
    </section>
  );
}

// ── 11. Preppers (beta) ────────────────────────────────────────────────────

function Preppers() {
  return (
    <section className="space-y-3">
      <H2 id="preppers">11. Preppers (beta)</H2>
      <p>
        Preppers is the niche tier for people who keep <strong>preserves</strong>{' '}
        — kimchi fermenting in jars, achar in the cupboard, kaya in the fridge,
        beef jerky in the dehydrator, batch-cooked stews in the freezer. The
        feature tracks <strong>when each batch becomes ready</strong> and{' '}
        <strong>when it expires</strong> so nothing gets forgotten.
      </p>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs">
        <strong className="text-amber-300">Beta:</strong> the feature is open
        to enrolled users. Pricing for the long-term niche tier is still TBD.
      </div>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        Stockpile supply estimate
      </h3>
      <p className="text-xs text-ga-text-secondary">
        At the very top is a <strong>days of supply</strong> projection — how
        long your active batches will feed your household. To make it
        meaningful, fill in the <strong>Household</strong> form (adults / youth
        / elderly counts) and set a <strong>servings</strong> count when you
        save a recipe or start a batch.
      </p>
      <p className="text-xs text-ga-text-secondary">
        Defaults: 3 servings/day per adult, 2.5 per youth, 2.5 per elderly. The
        bar tints emerald (≥30d), amber (≥7d), or red (&lt;7d).
      </p>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        "Use first" rotation
      </h3>
      <p className="text-xs text-ga-text-secondary">
        Active batches are sorted by soonest expiry first, and the
        ready-to-eat batch closest to expiring gets a small
        <strong> 🔝 use first</strong> chip. Standard preserves practice —
        rotate by expiry, not by start date — keeps the back of the
        fridge from becoming an archaeological dig.
      </p>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        Data readiness score
      </h3>
      <p className="text-xs text-ga-text-secondary">
        At the top of the page is a <strong>data readiness</strong> bar that
        shows how close your account is to having enough history for the
        analytics layer (recommendations, predictions, frequent-meal
        reorder). Threshold: <strong>30 days of activity + 10 purchases
        logged</strong>.
      </p>
      <p className="text-xs text-ga-text-secondary">
        During beta the score is <strong>informational only</strong> — all
        preppers features are unlocked regardless. Once analytics ship,
        the score will gate the recommendation layer; the basic batch
        tracker stays open even at 0%.
      </p>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        Recipe vs batch
      </h3>
      <ul className="list-disc list-inside space-y-1 text-xs text-ga-text-secondary">
        <li>
          A <strong className="text-ga-text-primary">recipe</strong> is your
          reusable template (your kimchi recipe, with the brine ratio you like).
        </li>
        <li>
          A <strong className="text-ga-text-primary">batch</strong> is a single
          jar / tray you actually started on a given day. Same recipe →
          many batches over time.
        </li>
      </ul>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        Preservation types
      </h3>
      <p className="text-xs text-ga-text-secondary">
        Each batch is tagged with one of: 🦠 Fermented (kimchi, miso, kombucha)
        · 🥒 Pickled (vinegar quick-pickles, achar) · 🥓 Cured (gravlax,
        bacon) · 🍓 Jam / preserve (jam, kaya, sambal) · 🥫 Canned · 🌿 Dried
        (jerky, herbs) · ❄️ Frozen (batch-cooked meals) · 🫒 Infused (oils,
        vinegars).
      </p>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        Common presets
      </h3>
      <p className="text-xs text-ga-text-secondary">
        The page ships with ~30 curated presets covering Malaysian and global
        staples — you can start a batch from a preset with one click and the
        ready-by / expires-by are pre-filled with sensible defaults. You can
        always override per batch.
      </p>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        Marking outcomes
      </h3>
      <p className="text-xs text-ga-text-secondary">
        Each active batch has two buttons: <strong>✓</strong> (consumed — eaten
        / used up) and <strong>✗</strong> (discarded — spoiled / thrown out).
        These move the batch out of the active list. The data flows into the
        eligibility score meter once that lights up.
      </p>

      <h3 className="text-sm font-semibold text-emerald-400 mt-4">
        Why preppers is separate from cooking recipes
      </h3>
      <p className="text-xs text-ga-text-secondary">
        Cooking recipes (Meals page) are about{' '}
        <em>"what do I make with what's expiring?"</em> — short-term, inventory-
        driven. Preppers is about <em>"what do I have stockpiled and when does
        it go off?"</em> — multi-day to multi-month preservation timelines.
        Different mental model, different schema, different page.
      </p>
    </section>
  );
}

// ── 12. FAQ ────────────────────────────────────────────────────────────────

function Faq() {
  return (
    <section className="space-y-2">
      <H2 id="faq">12. FAQ</H2>

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
