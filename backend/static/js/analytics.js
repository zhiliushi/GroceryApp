/**
 * Analytics page — charts and stats for GroceryApp admin.
 */

(async function () {
    // ── Fetch data in parallel ──────────────────────────────────────────
    let dashboardData = null;
    let inventoryItems = [];

    try {
        const [dashboard, inventory] = await Promise.all([
            apiGet('/api/admin/dashboard'),
            apiGet('/api/admin/inventory'),
        ]);

        dashboardData = dashboard;
        inventoryItems = inventory?.items || inventory || [];
    } catch (err) {
        console.error('Analytics: failed to fetch data', err);
        showToast('Failed to load analytics data.', 'error');
        return;
    }

    // ── Populate stat cards ─────────────────────────────────────────────
    if (dashboardData) {
        document.getElementById('statTotalUsers').textContent = dashboardData.total_users ?? 0;
        document.getElementById('statTotalItems').textContent = dashboardData.total_items ?? 0;
        document.getElementById('statActiveItems').textContent = dashboardData.active_items ?? 0;
        document.getElementById('statExpiredItems').textContent = dashboardData.expired_items ?? 0;
    }

    // ── Helpers ─────────────────────────────────────────────────────────
    const items = Array.isArray(inventoryItems) ? inventoryItems : [];

    function countBy(arr, key) {
        return arr.reduce((acc, item) => {
            const val = (item[key] || 'unknown').toLowerCase();
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});
    }

    // ── 1. Status Doughnut Chart ────────────────────────────────────────
    const statusCounts = countBy(items, 'status');
    const statusLabels = ['active', 'consumed', 'expired', 'discarded'];
    const statusColors = {
        active: 'rgba(76, 175, 80, 0.85)',   // green
        consumed: 'rgba(33, 150, 243, 0.85)', // blue
        expired: 'rgba(244, 67, 54, 0.85)',   // red
        discarded: 'rgba(255, 152, 0, 0.85)', // orange
    };
    const statusBorderColors = {
        active: 'rgba(76, 175, 80, 1)',
        consumed: 'rgba(33, 150, 243, 1)',
        expired: 'rgba(244, 67, 54, 1)',
        discarded: 'rgba(255, 152, 0, 1)',
    };

    const statusChartCanvas = document.getElementById('statusChart');
    document.getElementById('statusChartLoading').classList.add('d-none');
    statusChartCanvas.classList.remove('d-none');

    new Chart(statusChartCanvas, {
        type: 'doughnut',
        data: {
            labels: statusLabels.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
            datasets: [{
                data: statusLabels.map(s => statusCounts[s] || 0),
                backgroundColor: statusLabels.map(s => statusColors[s]),
                borderColor: statusLabels.map(s => statusBorderColors[s]),
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e0e0e0', padding: 16, usePointStyle: true },
                },
            },
        },
    });

    // ── 2. Storage Location Bar Chart ───────────────────────────────────
    const locationCounts = countBy(items, 'storage_location');
    const locationLabels = ['fridge', 'freezer', 'pantry', 'counter', 'other'];
    const locationColors = [
        'rgba(33, 150, 243, 0.7)',
        'rgba(0, 188, 212, 0.7)',
        'rgba(255, 193, 7, 0.7)',
        'rgba(156, 39, 176, 0.7)',
        'rgba(158, 158, 158, 0.7)',
    ];
    const locationBorderColors = [
        'rgba(33, 150, 243, 1)',
        'rgba(0, 188, 212, 1)',
        'rgba(255, 193, 7, 1)',
        'rgba(156, 39, 176, 1)',
        'rgba(158, 158, 158, 1)',
    ];

    const locationChartCanvas = document.getElementById('locationChart');
    document.getElementById('locationChartLoading').classList.add('d-none');
    locationChartCanvas.classList.remove('d-none');

    new Chart(locationChartCanvas, {
        type: 'bar',
        data: {
            labels: locationLabels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
            datasets: [{
                label: 'Items',
                data: locationLabels.map(l => locationCounts[l] || 0),
                backgroundColor: locationColors,
                borderColor: locationBorderColors,
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(255,255,255,0.06)' },
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#e0e0e0', precision: 0 },
                    grid: { color: 'rgba(255,255,255,0.06)' },
                },
            },
        },
    });

    // ── 3. Expiry Overview — Horizontal Bar ─────────────────────────────
    const now = new Date();
    const msPerDay = 86400000;

    // Only consider active items with an expiry_date
    const activeItems = items.filter(i =>
        i.status === 'active' && i.expiry_date
    );

    function daysUntilExpiry(item) {
        const exp = new Date(
            typeof item.expiry_date === 'number' && item.expiry_date < 1e12
                ? item.expiry_date * 1000
                : item.expiry_date
        );
        return Math.ceil((exp - now) / msPerDay);
    }

    let within7 = 0;
    let within14 = 0;
    let within30 = 0;

    activeItems.forEach(item => {
        const days = daysUntilExpiry(item);
        if (days >= 0 && days <= 7) within7++;
        if (days >= 0 && days <= 14) within14++;
        if (days >= 0 && days <= 30) within30++;
    });

    const expiryChartCanvas = document.getElementById('expiryChart');
    document.getElementById('expiryChartLoading').classList.add('d-none');
    expiryChartCanvas.classList.remove('d-none');

    new Chart(expiryChartCanvas, {
        type: 'bar',
        data: {
            labels: ['Within 7 days', 'Within 14 days', 'Within 30 days'],
            datasets: [{
                label: 'Items Expiring',
                data: [within7, within14, within30],
                backgroundColor: [
                    'rgba(244, 67, 54, 0.7)',
                    'rgba(255, 152, 0, 0.7)',
                    'rgba(255, 193, 7, 0.7)',
                ],
                borderColor: [
                    'rgba(244, 67, 54, 1)',
                    'rgba(255, 152, 0, 1)',
                    'rgba(255, 193, 7, 1)',
                ],
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#e0e0e0', precision: 0 },
                    grid: { color: 'rgba(255,255,255,0.06)' },
                },
                y: {
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(255,255,255,0.06)' },
                },
            },
        },
    });
})();
