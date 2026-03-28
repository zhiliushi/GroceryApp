import { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { useDashboard } from '@/api/queries/useDashboard';
import { useInventory } from '@/api/queries/useInventory';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { InventoryItem } from '@/types/api';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const CHART_TEXT_COLOR = '#e0e0e0';
const CHART_GRID_COLOR = '#333333';

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  consumed: '#3b82f6',
  expired: '#ef4444',
  discarded: '#f97316',
  scanned: '#a855f7',
};

const LOCATION_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#eab308', '#a855f7', '#6b7280'];

export default function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading } = useDashboard();
  const { data: inventoryData, isLoading: invLoading } = useInventory({});

  const items = inventoryData?.items ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item: InventoryItem) => {
      const s = item.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [items]);

  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item: InventoryItem) => {
      const loc = item.storage_location || item.location || 'unknown';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return counts;
  }, [items]);

  const expiryCounts = useMemo(() => {
    const now = Date.now();
    const buckets = { '7 days': 0, '14 days': 0, '30 days': 0 };
    items.forEach((item: InventoryItem) => {
      const exp = item.expiryDate ?? item.expiry_date;
      if (!exp) return;
      const ms = exp > 1e12 ? exp : exp * 1000;
      const diffDays = Math.ceil((ms - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return; // already expired
      if (diffDays <= 7) buckets['7 days']++;
      if (diffDays <= 14) buckets['14 days']++;
      if (diffDays <= 30) buckets['30 days']++;
    });
    return buckets;
  }, [items]);

  const statusChartData = useMemo(() => {
    const labels = Object.keys(statusCounts);
    return {
      labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [
        {
          data: labels.map((l) => statusCounts[l]),
          backgroundColor: labels.map((l) => STATUS_COLORS[l] || '#6b7280'),
          borderWidth: 0,
        },
      ],
    };
  }, [statusCounts]);

  const locationChartData = useMemo(() => {
    const labels = Object.keys(locationCounts);
    return {
      labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
      datasets: [
        {
          label: 'Items',
          data: labels.map((l) => locationCounts[l]),
          backgroundColor: labels.map((_, i) => LOCATION_COLORS[i % LOCATION_COLORS.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [locationCounts]);

  const expiryChartData = useMemo(
    () => ({
      labels: Object.keys(expiryCounts),
      datasets: [
        {
          label: 'Items expiring within',
          data: Object.values(expiryCounts),
          backgroundColor: ['#ef4444', '#f97316', '#eab308'],
          borderWidth: 0,
        },
      ],
    }),
    [expiryCounts],
  );

  const darkChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: CHART_TEXT_COLOR, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleColor: CHART_TEXT_COLOR,
        bodyColor: CHART_TEXT_COLOR,
        borderColor: CHART_GRID_COLOR,
        borderWidth: 1,
      },
    },
  };

  const barChartOptions = {
    ...darkChartOptions,
    indexAxis: 'y' as const,
    scales: {
      x: {
        ticks: { color: CHART_TEXT_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
      y: {
        ticks: { color: CHART_TEXT_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
    },
  };

  const verticalBarOptions = {
    ...darkChartOptions,
    scales: {
      x: {
        ticks: { color: CHART_TEXT_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
      y: {
        ticks: { color: CHART_TEXT_COLOR },
        grid: { color: CHART_GRID_COLOR },
      },
    },
  };

  const isLoading = statsLoading || invLoading;

  return (
    <div className="p-6">
      <PageHeader title="Analytics" icon="📊" />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard icon="👥" label="Users" value={stats?.total_users} loading={statsLoading} />
        <StatsCard icon="📦" label="Items" value={stats?.total_items} loading={statsLoading} />
        <StatsCard icon="✅" label="Active" value={stats?.active_items} loading={statsLoading} accentColor="green" />
        <StatsCard icon="⚠️" label="Expired" value={stats?.expired_items} loading={statsLoading} accentColor="red" />
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading analytics..." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Status Doughnut */}
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-ga-text-primary mb-3">Items by Status</h3>
            <div className="h-64">
              <Doughnut data={statusChartData} options={darkChartOptions} />
            </div>
          </div>

          {/* Location Bar */}
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-ga-text-primary mb-3">Items by Location</h3>
            <div className="h-64">
              <Bar data={locationChartData} options={verticalBarOptions} />
            </div>
          </div>

          {/* Expiry Bar */}
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-ga-text-primary mb-3">Expiring Soon</h3>
            <div className="h-64">
              <Bar data={expiryChartData} options={barChartOptions} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
