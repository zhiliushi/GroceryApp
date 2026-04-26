import { useMemo } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useHealthHistory } from '@/api/queries/useWaste';
import type { HealthHistorySnapshot } from '@/types/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

const DAYS = 30;

function fillGaps(snapshots: HealthHistorySnapshot[], days: number): HealthHistorySnapshot[] {
  if (snapshots.length === 0) return [];
  const map = new Map(snapshots.map((s) => [s.date, s]));
  const today = new Date();
  const out: HealthHistorySnapshot[] = [];
  let lastSeen = snapshots[0];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = map.get(key);
    if (found) {
      lastSeen = found;
      out.push(found);
    } else {
      out.push({ ...lastSeen, date: key });
    }
  }
  return out;
}

export default function HealthTrendChart() {
  const { data, isLoading } = useHealthHistory(DAYS);

  const filled = useMemo(
    () => fillGaps(data?.snapshots ?? [], DAYS),
    [data?.snapshots],
  );

  if (isLoading) {
    return (
      <div className="h-32 bg-ga-bg-card border border-ga-border rounded-lg animate-pulse" />
    );
  }

  if (filled.length === 0) {
    return (
      <div className="h-32 bg-ga-bg-card border border-ga-border rounded-lg flex items-center justify-center">
        <p className="text-xs text-ga-text-secondary px-4 text-center">
          No history yet — daily snapshots start tomorrow at 23:30 UTC.
        </p>
      </div>
    );
  }

  const labels = filled.map((s) =>
    new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  );

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <div className="text-sm font-medium text-ga-text-primary mb-2">
        Last {DAYS} days
      </div>
      <div className="h-32">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: 'Health',
                data: filled.map((s) => s.score),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                tension: 0.25,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 4,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `Score: ${ctx.parsed.y}`,
                },
              },
            },
            scales: {
              y: {
                min: 0,
                max: 100,
                ticks: { stepSize: 25, color: '#9ca3af' },
                grid: { color: 'rgba(156, 163, 175, 0.1)' },
              },
              x: {
                ticks: {
                  color: '#9ca3af',
                  maxTicksLimit: 6,
                  autoSkip: true,
                },
                grid: { display: false },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
