/**
 * Foodbanks management — list, CRUD, seed, refresh, sources.
 */

/* ------------------------------------------------------------------ */
/*  List page                                                         */
/* ------------------------------------------------------------------ */

async function loadFoodbanks(country) {
    const spinner = document.getElementById('loadingSpinner');
    const emptyState = document.getElementById('emptyState');
    const grid = document.getElementById('foodbankGrid');

    if (!grid) return; // not on list page

    spinner.classList.remove('d-none');
    emptyState.classList.add('d-none');
    grid.classList.add('d-none');
    grid.innerHTML = '';

    try {
        const query = country ? `?country=${encodeURIComponent(country)}` : '';
        const data = await apiGet(`/api/foodbanks${query}`);
        spinner.classList.add('d-none');

        if (!data || !data.foodbanks || data.foodbanks.length === 0) {
            emptyState.classList.remove('d-none');
            updateCount(0);
            return;
        }

        updateCount(data.count);

        data.foodbanks.forEach(fb => {
            grid.appendChild(buildFoodbankCard(fb));
        });

        grid.classList.remove('d-none');
    } catch (err) {
        spinner.classList.add('d-none');
        showToast('Failed to load foodbanks: ' + err.message, 'error');
        emptyState.classList.remove('d-none');
    }
}

function updateCount(count) {
    const badge = document.getElementById('foodbankCount');
    if (badge) {
        badge.textContent = count;
        badge.classList.remove('d-none');
    }
}

function buildFoodbankCard(fb) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';

    const activeBadge = fb.is_active
        ? '<span class="badge badge-active">Active</span>'
        : '<span class="badge bg-secondary">Inactive</span>';

    const stateBadge = fb.state
        ? `<span class="badge bg-info text-dark me-1">${fb.state}</span>`
        : '';

    const description = fb.description
        ? `<p class="small mb-2" style="color: var(--ga-text-secondary);">${truncate(fb.description, 100)}</p>`
        : '';

    const address = fb.location_address
        ? `<small class="d-block mb-2" style="color: var(--ga-text-secondary);"><i class="bi bi-geo-alt"></i> ${fb.location_address}</small>`
        : '';

    // Map link: prefer location_link, fall back to lat/lng Google Maps URL
    let mapButton = '';
    if (fb.location_link) {
        mapButton = `<a href="${fb.location_link}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-info me-1"><i class="bi bi-map"></i> Map</a>`;
    } else if (fb.latitude && fb.longitude) {
        mapButton = `<a href="https://www.google.com/maps?q=${fb.latitude},${fb.longitude}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-info me-1"><i class="bi bi-map"></i> Map</a>`;
    }

    // Admin actions — rendered for everyone but the backend enforces admin; the buttons
    // are only shown in the template when user.is_admin, but since this is JS we check
    // for the presence of admin-only elements on the page.
    const isAdmin = document.getElementById('btnSeed') !== null;
    let adminActions = '';
    if (isAdmin) {
        adminActions = `
            <div class="mt-2 pt-2 border-top" style="border-color: var(--ga-border) !important;">
                <a href="/foodbanks/${fb.id}/edit" class="btn btn-sm btn-outline-light me-1">
                    <i class="bi bi-pencil"></i> Edit
                </a>
                <button onclick="refreshFoodbankEntry('${fb.id}')" class="btn btn-sm btn-outline-info me-1" title="Refresh this entry">
                    <i class="bi bi-arrow-clockwise"></i> Refresh
                </button>
                <button onclick="toggleFoodbank('${fb.id}')" class="btn btn-sm btn-outline-warning me-1">
                    <i class="bi bi-toggle-${fb.is_active ? 'on' : 'off'}"></i> ${fb.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deleteFoodbank('${fb.id}')" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </div>
        `;
    }

    col.innerHTML = `
        <div class="card h-100">
            <div class="card-body d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0" style="color: var(--ga-text-primary);">${fb.name}</h6>
                    <div class="ms-2 text-nowrap">
                        ${stateBadge}${activeBadge}
                    </div>
                </div>
                ${description}
                ${address}
                <div class="mt-auto">
                    ${mapButton}
                    ${adminActions}
                </div>
            </div>
        </div>
    `;

    return col;
}

function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '...' : str;
}

/* ------------------------------------------------------------------ */
/*  Admin actions                                                     */
/* ------------------------------------------------------------------ */

async function seedFoodbanks() {
    const btn = document.getElementById('btnSeed');
    if (btn) btn.disabled = true;
    try {
        const data = await apiPost('/api/foodbanks/seed');
        showToast(data && data.message ? data.message : 'Malaysia foodbanks seeded successfully.');
        reloadCurrentList();
    } catch (err) {
        showToast('Seed failed: ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function refreshFoodbanks() {
    const btn = document.getElementById('btnRefresh');
    if (btn) btn.disabled = true;
    try {
        const data = await apiPost('/api/foodbanks/refresh');
        showToast(data && data.message ? data.message : 'Foodbanks refreshed successfully.');
        reloadCurrentList();
    } catch (err) {
        showToast('Refresh failed: ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function toggleFoodbank(id) {
    try {
        await apiPatch(`/api/foodbanks/${id}/toggle`);
        showToast('Foodbank status toggled.');
        reloadCurrentList();
    } catch (err) {
        showToast('Toggle failed: ' + err.message, 'error');
    }
}

async function deleteFoodbank(id) {
    if (!confirm('Are you sure you want to delete this foodbank? This action cannot be undone.')) {
        return;
    }
    try {
        await apiDelete(`/api/foodbanks/${id}`);
        showToast('Foodbank deleted.');
        reloadCurrentList();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

async function refreshFoodbankEntry(id) {
    try {
        await apiPost(`/api/foodbanks/${id}/refresh`);
        showToast('Foodbank entry refreshed.');
        reloadCurrentList();
    } catch (err) {
        showToast('Refresh failed: ' + err.message, 'error');
    }
}

function reloadCurrentList() {
    const select = document.getElementById('countryFilter');
    const country = select ? select.value : 'MY';
    loadFoodbanks(country);
}

/* ------------------------------------------------------------------ */
/*  Sources panel                                                     */
/* ------------------------------------------------------------------ */

async function loadSources() {
    const spinner = document.getElementById('sourcesSpinner');
    const table = document.getElementById('sourcesTable');
    const tbody = document.getElementById('sourcesTableBody');
    const badge = document.getElementById('sourceCount');

    if (!tbody) return; // not admin or not on list page

    try {
        const data = await apiGet('/api/foodbanks/sources');
        if (spinner) spinner.classList.add('d-none');

        if (!data || !data.sources || data.sources.length === 0) {
            return;
        }

        if (badge) {
            badge.textContent = data.count;
            badge.classList.remove('d-none');
        }

        tbody.innerHTML = '';
        data.sources.forEach(src => {
            tbody.appendChild(buildSourceRow(src));
        });
        if (table) table.classList.remove('d-none');
    } catch (err) {
        if (spinner) spinner.classList.add('d-none');
        console.warn('Failed to load sources:', err);
    }
}

function buildSourceRow(src) {
    const tr = document.createElement('tr');
    tr.style.borderColor = 'var(--ga-border)';

    // Status badge
    let statusBadge = '';
    if (src.status === 'healthy') {
        statusBadge = '<span class="badge bg-success">Healthy</span>';
    } else if (src.status === 'cooldown') {
        const hoursLeft = src.cooldown_until
            ? Math.max(0, ((src.cooldown_until - Date.now() / 1000) / 3600)).toFixed(1)
            : '?';
        statusBadge = `<span class="badge bg-warning text-dark">Cooldown (${hoursLeft}h)</span>`;
    } else {
        statusBadge = '<span class="badge bg-secondary">Disabled</span>';
    }

    const lastSuccess = src.last_success
        ? new Date(src.last_success * 1000).toLocaleString()
        : '<span class="text-muted">—</span>';
    const lastError = src.last_error
        ? `<span class="text-danger" title="${src.error_message || ''}">${new Date(src.last_error * 1000).toLocaleString()}</span>`
        : '<span class="text-muted">—</span>';

    // Action buttons
    const fetchBtn = `<button onclick="fetchSource('${src.id}')" class="btn btn-sm btn-outline-info me-1" title="Fetch now"><i class="bi bi-cloud-download"></i></button>`;
    const resetBtn = src.status === 'cooldown'
        ? `<button onclick="resetSourceCooldown('${src.id}')" class="btn btn-sm btn-outline-warning me-1" title="Reset cooldown"><i class="bi bi-arrow-counterclockwise"></i></button>`
        : '';
    const toggleBtn = `<button onclick="toggleSource('${src.id}')" class="btn btn-sm btn-outline-${src.status === 'disabled' ? 'success' : 'secondary'} me-1" title="${src.status === 'disabled' ? 'Enable' : 'Disable'}"><i class="bi bi-toggle-${src.status === 'disabled' ? 'off' : 'on'}"></i></button>`;

    tr.innerHTML = `
        <td class="ps-3">
            <a href="${src.url}" target="_blank" rel="noopener" class="text-decoration-none" style="color: var(--ga-text-primary);">
                ${src.name} <i class="bi bi-box-arrow-up-right small"></i>
            </a>
        </td>
        <td><span class="badge bg-info text-dark">${src.country}</span></td>
        <td>${statusBadge}</td>
        <td class="small">${lastSuccess}</td>
        <td class="small">${lastError}</td>
        <td class="text-nowrap">${fetchBtn}${resetBtn}${toggleBtn}</td>
    `;
    return tr;
}

async function fetchSource(id) {
    try {
        const data = await apiPost(`/api/foodbanks/sources/${id}/fetch`);
        const msg = data && data.message ? data.message : 'Source fetched.';
        showToast(msg, data && data.success ? 'success' : 'error');
        loadSources();
        reloadCurrentList();
    } catch (err) {
        showToast('Fetch failed: ' + err.message, 'error');
        loadSources();
    }
}

async function resetSourceCooldown(id) {
    try {
        await apiPost(`/api/foodbanks/sources/${id}/reset`);
        showToast('Cooldown cleared.');
        loadSources();
    } catch (err) {
        showToast('Reset failed: ' + err.message, 'error');
    }
}

async function toggleSource(id) {
    try {
        const data = await apiPost(`/api/foodbanks/sources/${id}/toggle`);
        showToast(data && data.message ? data.message : 'Source toggled.');
        loadSources();
    } catch (err) {
        showToast('Toggle failed: ' + err.message, 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Form page — load & save                                           */
/* ------------------------------------------------------------------ */

async function loadFoodbankForm(id) {
    if (!id) return; // create mode — nothing to load

    const spinner = document.getElementById('formSpinner');
    const formCard = document.getElementById('formCard');

    try {
        const data = await apiGet(`/api/foodbanks/${id}`);

        if (!data) {
            showToast('Foodbank not found.', 'error');
            return;
        }

        // The API may return the foodbank directly or nested — handle both
        const fb = data.foodbank || data;

        document.getElementById('fbName').value = fb.name || '';
        document.getElementById('fbDescription').value = fb.description || '';
        document.getElementById('fbCountry').value = fb.country || 'MY';
        document.getElementById('fbState').value = fb.state || '';
        document.getElementById('fbLocationName').value = fb.location_name || '';
        document.getElementById('fbLocationAddress').value = fb.location_address || '';
        document.getElementById('fbLocationLink').value = fb.location_link || '';
        document.getElementById('fbLatitude').value = fb.latitude ?? '';
        document.getElementById('fbLongitude').value = fb.longitude ?? '';
        document.getElementById('fbSourceUrl').value = fb.source_url || '';
        document.getElementById('fbSourceName').value = fb.source_name || '';

        if (spinner) spinner.classList.add('d-none');
        if (formCard) formCard.classList.remove('d-none');
    } catch (err) {
        if (spinner) spinner.classList.add('d-none');
        showToast('Failed to load foodbank: ' + err.message, 'error');
    }
}

async function saveFoodbank(id) {
    const form = document.getElementById('foodbankForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('btnSubmit');
    if (btn) btn.disabled = true;

    const body = {
        name: document.getElementById('fbName').value.trim(),
        description: document.getElementById('fbDescription').value.trim(),
        country: document.getElementById('fbCountry').value,
        state: document.getElementById('fbState').value.trim(),
        location_name: document.getElementById('fbLocationName').value.trim() || null,
        location_address: document.getElementById('fbLocationAddress').value.trim() || null,
        location_link: document.getElementById('fbLocationLink').value.trim() || null,
        latitude: document.getElementById('fbLatitude').value ? parseFloat(document.getElementById('fbLatitude').value) : null,
        longitude: document.getElementById('fbLongitude').value ? parseFloat(document.getElementById('fbLongitude').value) : null,
        source_url: document.getElementById('fbSourceUrl').value.trim() || null,
        source_name: document.getElementById('fbSourceName').value.trim() || null,
    };

    try {
        let data;
        if (id) {
            data = await apiPut(`/api/foodbanks/${id}`, body);
            showToast('Foodbank updated successfully.');
        } else {
            data = await apiPost('/api/foodbanks', body);
            showToast('Foodbank created successfully.');
        }
        // Redirect back to list after short delay so toast is visible
        setTimeout(() => { window.location.href = '/foodbanks'; }, 800);
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
        if (btn) btn.disabled = false;
    }
}

/* ------------------------------------------------------------------ */
/*  Page initialisation                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    // Detect which page we are on and initialise accordingly.

    // Foodbank list page
    const grid = document.getElementById('foodbankGrid');
    if (grid) {
        const countryFilter = document.getElementById('countryFilter');
        if (countryFilter) {
            countryFilter.addEventListener('change', () => {
                loadFoodbanks(countryFilter.value);
            });
        }
        // Initial load
        loadFoodbanks(countryFilter ? countryFilter.value : 'MY');
        loadSources();

        // Auto-refresh every 10 minutes
        setInterval(() => {
            reloadCurrentList();
        }, 10 * 60 * 1000);
        return;
    }

    // Foodbank form page
    const formCard = document.getElementById('formCard');
    if (formCard) {
        const idField = document.getElementById('foodbankId');
        const foodbankId = idField ? idField.value : '';
        if (foodbankId) {
            loadFoodbankForm(foodbankId);
        }
        return;
    }
});
