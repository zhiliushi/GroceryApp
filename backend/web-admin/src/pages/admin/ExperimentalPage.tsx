import { useState } from 'react';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import PageHeader from '@/components/shared/PageHeader';
import ShelfAuditModal from '@/components/scanner/ShelfAuditModal';
import ProductLabelScanModal from '@/components/scanner/ProductLabelScanModal';
import ReceiptScanModal from '@/components/receipt/ReceiptScanModal';
import OcrTestScanPage from '@/pages/admin-settings/OcrTestScanPage';
import OcrSettingsTab from '@/pages/admin-settings/OcrSettingsTab';
import type { FeatureFlags } from '@/types/api';
import { cn } from '@/utils/cn';

type ExperimentKey =
  | 'receipt_scan'
  | 'product_label'
  | 'shelf_audit'
  | 'recipe_ocr'
  | 'ocr_test'
  | 'ocr_settings';

interface Experiment {
  key: ExperimentKey;
  label: string;
  description: string;
  icon: string;
  flag: keyof FeatureFlags;
  parentFlag?: keyof FeatureFlags; // ocr_enabled master switch
}

const EXPERIMENTS: Experiment[] = [
  {
    key: 'receipt_scan',
    label: 'Receipt Scanner',
    description: 'Upload a receipt image; the OCR pipeline extracts items, prices, store, and date.',
    icon: '🧾',
    flag: 'receipt_scan',
    parentFlag: 'ocr_enabled',
  },
  {
    key: 'product_label',
    label: 'Product Label Scan',
    description: 'Photograph a product label to extract name, brand, weight, barcode, expiry.',
    icon: '🏷️',
    flag: 'smart_camera',
    parentFlag: 'ocr_enabled',
  },
  {
    key: 'shelf_audit',
    label: 'Shelf Audit',
    description: 'Bulk-scan a fridge or pantry shelf; matches products against your inventory.',
    icon: '🗄️',
    flag: 'shelf_audit',
    parentFlag: 'ocr_enabled',
  },
  {
    key: 'recipe_ocr',
    label: 'Recipe OCR',
    description: 'OCR a recipe image into structured ingredients + steps. Also available on Meals.',
    icon: '🍳',
    flag: 'recipe_ocr',
    parentFlag: 'ocr_enabled',
  },
  {
    key: 'ocr_test',
    label: 'OCR Test Console',
    description: 'Raw OCR output inspector — run any image through the active provider and view tokens.',
    icon: '🔬',
    flag: 'ocr_enabled',
  },
  {
    key: 'ocr_settings',
    label: 'OCR Provider Settings',
    description: 'Switch between Tesseract / Google Vision / Mindee. Admin only.',
    icon: '⚙️',
    flag: 'ocr_enabled',
  },
];

export default function ExperimentalPage() {
  const { data: flags, isLoading } = useFeatureFlags();
  const [active, setActive] = useState<ExperimentKey | null>(null);

  if (isLoading) return <LoadingSpinner text="Loading flags…" />;

  const ocrOff = flags?.ocr_enabled === false;

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Admin', to: '/admin-settings' },
          { label: 'Experimental' },
        ]}
      />
      <PageHeader title="Experimental" icon="🧪" subtitle="Admin-only · flag-gated" />

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 text-sm text-ga-text-secondary">
        Camera / OCR features kept behind flags so they can be toggled without a deploy.
        Turn individual experiments on/off from{' '}
        <a href="/admin-settings" className="text-ga-accent hover:underline">
          Admin Settings → Feature Flags
        </a>
        . The master <code className="text-ga-text-primary">ocr_enabled</code> switch gates all
        OCR/camera children.
      </div>

      {ocrOff && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-600">
          OCR master switch is off. Every experiment on this page is disabled until you turn{' '}
          <code>ocr_enabled</code> on.
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EXPERIMENTS.map((exp) => {
          const parentOn = !exp.parentFlag || flags?.[exp.parentFlag] !== false;
          const selfOn = flags?.[exp.flag] !== false;
          const enabled = parentOn && selfOn;
          return (
            <button
              key={exp.key}
              type="button"
              onClick={() => enabled && setActive(exp.key)}
              disabled={!enabled}
              className={cn(
                'text-left bg-ga-bg-card border rounded-lg p-4 transition-all',
                enabled
                  ? 'border-ga-border hover:border-ga-accent/50 hover:shadow-md cursor-pointer'
                  : 'border-ga-border/40 opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="text-3xl">{exp.icon}</div>
                <FlagChip label={String(exp.flag)} on={selfOn && parentOn} />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ga-text-primary">{exp.label}</h3>
              <p className="mt-1 text-xs text-ga-text-secondary">{exp.description}</p>
            </button>
          );
        })}
      </div>

      {/* Modals / embedded pages */}
      {active === 'shelf_audit' && <ShelfAuditModal onClose={() => setActive(null)} />}
      {active === 'product_label' && (
        <ProductLabelScanModal
          onClose={() => setActive(null)}
          onAddToInventory={() => setActive(null)}
        />
      )}
      {active === 'receipt_scan' && (
        <ReceiptScanModal destination="inventory" onClose={() => setActive(null)} />
      )}
      {active === 'ocr_test' && (
        <EmbeddedPanel title="OCR Test Console" onClose={() => setActive(null)}>
          <OcrTestScanPage />
        </EmbeddedPanel>
      )}
      {active === 'ocr_settings' && (
        <EmbeddedPanel title="OCR Provider Settings" onClose={() => setActive(null)}>
          <OcrSettingsTab />
        </EmbeddedPanel>
      )}
      {active === 'recipe_ocr' && (
        <EmbeddedPanel title="Recipe OCR" onClose={() => setActive(null)}>
          <div className="p-6 text-sm text-ga-text-secondary">
            Recipe OCR is wired into the Meals editor — open any recipe and use the "Scan from
            image" button. This experiment tile is a placeholder; no standalone scanner exists yet.
          </div>
        </EmbeddedPanel>
      )}
    </div>
  );
}

function FlagChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cn(
        'text-[10px] font-mono px-1.5 py-0.5 rounded border',
        on
          ? 'border-green-500/30 text-green-600 bg-green-500/10'
          : 'border-red-500/30 text-red-500 bg-red-500/10',
      )}
    >
      {label}
    </span>
  );
}

function EmbeddedPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border sticky top-0 bg-ga-bg-card">
          <h2 className="text-lg font-semibold text-ga-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-ga-text-secondary hover:text-ga-text-primary text-xl"
          >
            &times;
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
