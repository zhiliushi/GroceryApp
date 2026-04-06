import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/utils/cn';
import PageManagementTab from './PageManagementTab';
import TierPlansTab from './TierPlansTab';
import UserApprovalTab from './UserApprovalTab';
import OcrSettingsTab from './OcrSettingsTab';
import EmailSettingsTab from './EmailSettingsTab';
import SystemSettingsTab from './SystemSettingsTab';

const TABS = [
  { key: 'pages', label: 'Page Management', icon: '📄' },
  { key: 'tiers', label: 'Tier Plans', icon: '💎' },
  { key: 'users', label: 'User Approval', icon: '👥' },
  { key: 'ocr', label: 'OCR Settings', icon: '🧾' },
  { key: 'email', label: 'Email', icon: '📧' },
  { key: 'system', label: 'System', icon: '🖥️' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pages');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <PageHeader title="Admin Settings" icon="⚙️" />
        <Link
          to="/admin-settings/test-scan"
          className="bg-ga-bg-hover border border-ga-border hover:border-ga-accent/50 text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors inline-flex items-center gap-2"
        >
          🔬 Test Scanner
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-ga-border pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm rounded-t-md transition-colors inline-flex items-center gap-2',
              activeTab === tab.key
                ? 'bg-ga-accent text-white font-medium'
                : 'text-ga-text-secondary hover:bg-ga-bg-hover hover:text-ga-text-primary',
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'pages' && <PageManagementTab />}
      {activeTab === 'tiers' && <TierPlansTab />}
      {activeTab === 'users' && <UserApprovalTab />}
      {activeTab === 'ocr' && <OcrSettingsTab />}
      {activeTab === 'email' && <EmailSettingsTab />}
      {activeTab === 'system' && <SystemSettingsTab />}
    </div>
  );
}
