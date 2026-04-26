import { Link } from 'react-router-dom';
import { useMe } from '@/api/queries/useMe';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import HouseholdSection from '@/components/settings/HouseholdSection';
import SecuritySection from '@/components/settings/SecuritySection';

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
        {/* Account card */}
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-ga-text-primary mb-3">Account</h2>
          <div className="grid grid-cols-2 gap-y-3 gap-x-8">
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Email</span>
              <span className="text-sm text-ga-text-primary">{user?.email || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">UID</span>
              <code className="text-xs font-mono text-ga-text-secondary">{user?.uid || '—'}</code>
            </div>
            <div>
              <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Role</span>
              <StatusBadge status={user?.role} />
            </div>
          </div>
        </div>

        {/* Household */}
        <HouseholdSection />

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
