import { Link } from 'react-router-dom';
import { useMe } from '@/api/queries/useMe';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import HouseholdSection from '@/components/settings/HouseholdSection';
import SecuritySection from '@/components/settings/SecuritySection';
import DisplayCurrencySection from '@/components/settings/DisplayCurrencySection';
import MergeNudgeWidget from '@/components/settings/MergeNudgeWidget';
import GrocerySection from '@/components/settings/GrocerySection';

const FSM_DATA = [
  {
    name: 'Item Lifecycle',
    states: 'scanned → active → consumed | expired | discarded',
    description: 'Tracks an inventory item from scan to final disposition.',
  },
  {
    name: 'Review Workflow',
    states: 'pending_review → approved | rejected | needs_info',
    description: 'Contributed products go through admin review before merging.',
  },
  {
    name: 'Foodbank Pipeline',
    states: 'healthy → cooldown → disabled',
    description: 'Source scraping states with automatic cooldown on errors.',
  },
];

export default function SettingsPage() {
  const { data: user, isLoading } = useMe();

  if (isLoading) return <LoadingSpinner text="Loading settings..." />;

  return (
    <div className="p-6">
      <PageHeader title="Settings" icon="⚙️" />

      <div className="space-y-4 max-w-3xl">
        <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
          <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
            <span>ⓘ What can I change here?</span>
            <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
            <p>
              <span className="text-ga-text-primary font-medium">Account</span> —
              your email, support ID, and role (read-only).
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">Household</span> —
              create one to share groceries with family, or join with an invite code.
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">Display currency</span> —
              the currency every total on the dashboard / waste / spending pages is shown in.
              Past purchases keep their original FX rate; only future entries use the new
              setting.
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">Shopping list</span> —
              where checkout-confirmed items land by default, and an opt-in to track which
              brands you actually pick.
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">Catalog cleanup</span>{' '}
              (only appears when there&apos;s something to review) — likely-duplicate items the
              app spotted, plus an undo log for any merges you ran in the last 7 days.
            </p>
            <p>
              <span className="text-ga-text-primary font-medium">Security</span> —
              change your password, link Google sign-in, or delete your account.
            </p>
          </div>
        </details>

        {/* Account card */}
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-ga-text-primary mb-3">Account</h2>
          <div className="grid grid-cols-2 gap-y-3 gap-x-8">
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Email</span>
              <span className="text-sm text-ga-text-primary">{user?.email || '—'}</span>
            </div>
            <div>
              <span
                className="block text-xs font-medium text-ga-text-secondary mb-0.5"
                title="Your unique account ID. Share this if support asks."
              >UID</span>
              <code className="text-xs font-mono text-ga-text-secondary">{user?.uid || '—'}</code>
            </div>
            <div>
              <span
                className="block text-xs font-medium text-ga-text-secondary mb-0.5"
                title="Your access level. Admins can manage products, users, and feature flags."
              >Role</span>
              <StatusBadge status={user?.role} />
            </div>
          </div>
        </div>

        {/* Household */}
        <HouseholdSection />

        {/* Display currency (Phase B of catalog_evolution.md) */}
        <DisplayCurrencySection />

        {/* Shopping-list preferences (v3 beta) */}
        <GrocerySection />

        {/* Catalog cleanup — likely duplicates + transfer audit log (Phase G) */}
        <MergeNudgeWidget />

        {/* Security */}
        <SecuritySection />

        {/* Application card */}
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-ga-text-primary mb-3">Application</h2>
          <div className="grid grid-cols-2 gap-y-3 gap-x-8">
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Version</span>
              <span className="text-sm text-ga-text-primary">GroceryApp Web v3.0.0</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Platform</span>
              <span className="text-sm text-ga-text-primary">React SPA</span>
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-ga-text-primary mb-3">Legal</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/privacy" className="text-ga-accent hover:underline">
                Privacy Policy →
              </Link>
              <span className="text-xs text-ga-text-secondary ml-2">
                What we collect, why, and your rights
              </span>
            </li>
            <li>
              <Link to="/terms" className="text-ga-accent hover:underline">
                Terms of Service →
              </Link>
              <span className="text-xs text-ga-text-secondary ml-2">
                Acceptable use, disclaimers, governing law
              </span>
            </li>
          </ul>
        </div>

        {/* FSM Engine card */}
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-ga-text-primary mb-3">FSM Engine</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ga-border">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">
                    States
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {FSM_DATA.map((fsm) => (
                  <tr key={fsm.name} className="border-b border-ga-border/50">
                    <td className="px-3 py-2.5 font-medium text-ga-text-primary whitespace-nowrap">
                      {fsm.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <code className="text-xs font-mono text-ga-accent">{fsm.states}</code>
                    </td>
                    <td className="px-3 py-2.5 text-ga-text-secondary text-xs">{fsm.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
