/**
 * Inventory management module for GroceryApp admin interface.
 */

let currentOffset = 0;
const PAGE_LIMIT = 50;
let currentTotalCount = 0;
let isEditMode = false;

/* ------------------------------------------------------------------ */
/*  Inventory List                                                     */
/* ------------------------------------------------------------------ */

async function loadInventory(filters = {}) {
    const spinner = document.getElementById('loadingSpinner');
    const tableWrapper = document.getElementById('inventoryTableWrapper');
    const emptyState = document.getElementById('emptyState');
    const countBadge = document.getElementById('inventoryCount');
    const tbody = document.getElementById('inventoryBody');

    if (spinner) spinner.classList.remove('d-none');
    if (tableWrapper) tableWrapper.classList.add('d-none');
    if (emptyState) emptyState.classList.add('d-none');

    // Build query string
    const params = new URLSearchParams();
    params.set('limit', PAGE_LIMIT);
    params.set('offset', currentOffset);

    if (filters.status) params.set('status', filters.status);
    if (filters.location) params.set('location', filters.location);
    if (filters.needs_review) params.set('needs_review', 'true');

    try {
        const data = await apiGet(`/api/admin/inventory?${params.toString()}`);
        if (!data) return;

        currentTotalCount = data.count || 0;
        if (countBadge) countBadge.textContent = currentTotalCount;

        if (spinner) spinner.classList.add('d-none');

        if (!data.items || data.items.length === 0) {
            if (emptyState) emptyState.classList.remove('d-none');
            return;
        }

        // Populate table
        tbody.innerHTML = '';
        data.items.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderColor = 'var(--ga-border)';

            const ownerShort = item.user_id
                ? item.user_id.substring(0, 8) + '...'
                : '—';

            const quantityStr = item.quantity != null
                ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}`
                : '—';

            tr.innerHTML = `
                <td>${escapeHtml(item.name || '—')}</td>
                <td>${escapeHtml(item.brand || '—')}</td>
                <td>${statusBadge(item.status)}</td>
                <td class="text-capitalize">${escapeHtml(item.storage_location || '—')}</td>
                <td>${quantityStr}</td>
                <td>${formatDate(item.expiry_date)}</td>
                <td>${formatCurrency(item.price)}</td>
                <td><span class="small text-muted" title="${escapeHtml(item.user_id || '')}">${escapeHtml(ownerShort)}</span></td>
                <td>
                    <a href="/inventory/${encodeURIComponent(item.user_id)}/${encodeURIComponent(item.id)}"
                       class="btn btn-sm btn-outline-info">
                        <i class="bi bi-eye me-1"></i>View
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (tableWrapper) tableWrapper.classList.remove('d-none');
        updatePagination(data.items.length);

    } catch (err) {
        console.error('Failed to load inventory:', err);
        if (spinner) spinner.classList.add('d-none');
        showToast('Failed to load inventory items.', 'error');
    }
}

function updatePagination(loadedCount) {
    const info = document.getElementById('paginationInfo');
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');

    if (!info) return;

    const start = currentOffset + 1;
    const end = currentOffset + loadedCount;
    info.textContent = `Showing ${start}–${end} of ${currentTotalCount}`;

    if (prev) prev.disabled = currentOffset === 0;
    if (next) next.disabled = (currentOffset + PAGE_LIMIT) >= currentTotalCount;
}

/* ------------------------------------------------------------------ */
/*  Filters                                                            */
/* ------------------------------------------------------------------ */

function applyFilters() {
    currentOffset = 0;
    const filters = {
        status: document.getElementById('filterStatus')?.value || '',
        location: document.getElementById('filterLocation')?.value || '',
        needs_review: document.getElementById('filterNeedsReview')?.checked || false,
    };
    loadInventory(filters);
}

function getCurrentFilters() {
    return {
        status: document.getElementById('filterStatus')?.value || '',
        location: document.getElementById('filterLocation')?.value || '',
        needs_review: document.getElementById('filterNeedsReview')?.checked || false,
    };
}

/* ------------------------------------------------------------------ */
/*  Item Detail                                                        */
/* ------------------------------------------------------------------ */

async function loadItemDetail(uid, itemId) {
    const loading = document.getElementById('detailLoading');
    const card = document.getElementById('detailCard');

    try {
        const item = await apiGet(`/api/admin/inventory/${encodeURIComponent(uid)}/${encodeURIComponent(itemId)}`);
        if (!item) return;

        if (loading) loading.classList.add('d-none');
        if (card) card.classList.remove('d-none');

        // Header
        document.getElementById('detailTitle').textContent = item.name || 'Unnamed Item';

        // View fields
        setText('viewName', item.name);
        setText('viewBrand', item.brand);
        setText('viewBarcode', item.barcode);
        setText('viewCategory', item.category);
        setHtml('viewStatus', statusBadge(item.status));
        setText('viewLocation', capitalize(item.storage_location));
        setText('viewQuantity', formatQuantity(item.quantity, item.unit));
        setText('viewExpiry', formatDate(item.expiry_date));
        setText('viewPurchaseDate', formatDate(item.purchase_date));
        setText('viewPrice', formatCurrency(item.price));
        setNeedsReviewDisplay('viewNeedsReview', item.needsReview);
        setText('viewCreated', formatDateTime(item.created_at));
        setText('viewUpdated', formatDateTime(item.updated_at));

        // Populate edit fields
        setVal('editName', item.name || '');
        setVal('editBrand', item.brand || '');
        setVal('editBarcode', item.barcode || '');
        setVal('editCategory', item.category || '');
        setVal('editStatus', item.status || 'active');
        setVal('editLocation', item.storage_location || 'fridge');
        setVal('editQuantity', item.quantity ?? '');
        setVal('editUnit', item.unit || '');
        setVal('editPrice', item.price ?? '');

        // Date fields — convert timestamps to YYYY-MM-DD for input[type=date]
        setDateInput('editExpiry', item.expiry_date);
        setDateInput('editPurchaseDate', item.purchase_date);

        const needsReviewCb = document.getElementById('editNeedsReview');
        if (needsReviewCb) needsReviewCb.checked = !!item.needsReview;

    } catch (err) {
        console.error('Failed to load item detail:', err);
        if (loading) loading.classList.add('d-none');
        showToast('Failed to load item details.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Edit / Save                                                        */
/* ------------------------------------------------------------------ */

function toggleEdit() {
    isEditMode = !isEditMode;

    const viewEls = document.querySelectorAll('.view-mode');
    const editEls = document.querySelectorAll('.edit-mode');
    const btnEdit = document.getElementById('btnEdit');
    const btnCancel = document.getElementById('btnCancel');
    const btnSave = document.getElementById('btnSave');

    if (isEditMode) {
        viewEls.forEach(el => el.classList.add('d-none'));
        editEls.forEach(el => el.classList.remove('d-none'));
        if (btnEdit) btnEdit.classList.add('d-none');
        if (btnCancel) btnCancel.classList.remove('d-none');
        if (btnSave) btnSave.classList.remove('d-none');
    } else {
        viewEls.forEach(el => el.classList.remove('d-none'));
        editEls.forEach(el => el.classList.add('d-none'));
        if (btnEdit) btnEdit.classList.remove('d-none');
        if (btnCancel) btnCancel.classList.add('d-none');
        if (btnSave) btnSave.classList.add('d-none');
    }
}

async function saveItem(uid, itemId) {
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    }

    const body = {
        name: document.getElementById('editName')?.value || '',
        brand: document.getElementById('editBrand')?.value || '',
        barcode: document.getElementById('editBarcode')?.value || '',
        category: document.getElementById('editCategory')?.value || '',
        status: document.getElementById('editStatus')?.value || 'active',
        storage_location: document.getElementById('editLocation')?.value || '',
        quantity: parseFloat(document.getElementById('editQuantity')?.value) || 0,
        unit: document.getElementById('editUnit')?.value || '',
        price: parseFloat(document.getElementById('editPrice')?.value) || null,
        expiry_date: document.getElementById('editExpiry')?.value || null,
        purchase_date: document.getElementById('editPurchaseDate')?.value || null,
        needsReview: document.getElementById('editNeedsReview')?.checked || false,
    };

    try {
        const result = await apiPut(
            `/api/admin/inventory/${encodeURIComponent(uid)}/${encodeURIComponent(itemId)}`,
            body
        );

        if (result) {
            showToast('Item updated successfully.', 'success');
            // Exit edit mode and reload detail
            isEditMode = true; // will be toggled to false
            toggleEdit();
            loadItemDetail(uid, itemId);
        }
    } catch (err) {
        console.error('Failed to save item:', err);
        showToast('Failed to update item.', 'error');
    } finally {
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="bi bi-check-lg me-1"></i>Save';
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function escapeHtml(str) {
    if (!str) return '—';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
}

function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html || '—';
}

function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function setDateInput(id, timestamp) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!timestamp) { el.value = ''; return; }
    const d = new Date(typeof timestamp === 'number' && timestamp > 1e12 ? timestamp : timestamp * 1000);
    if (isNaN(d.getTime())) { el.value = ''; return; }
    el.value = d.toISOString().split('T')[0];
}

function capitalize(str) {
    if (!str) return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatQuantity(qty, unit) {
    if (qty == null) return '—';
    return `${qty}${unit ? ' ' + unit : ''}`;
}

function setNeedsReviewDisplay(id, flag) {
    const el = document.getElementById(id);
    if (!el) return;
    if (flag) {
        el.innerHTML = '<span class="badge bg-warning text-dark"><i class="bi bi-flag-fill me-1"></i>Yes</span>';
    } else {
        el.innerHTML = '<span class="badge bg-secondary">No</span>';
    }
}

/* ------------------------------------------------------------------ */
/*  Initialization                                                     */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', function () {
    // Inventory list page
    const inventoryTable = document.getElementById('inventoryTable');
    if (inventoryTable) {
        loadInventory();

        // Filter form
        const filterForm = document.getElementById('filterForm');
        if (filterForm) {
            filterForm.addEventListener('submit', function (e) {
                e.preventDefault();
                applyFilters();
            });
        }

        // Pagination buttons
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                if (currentOffset >= PAGE_LIMIT) {
                    currentOffset -= PAGE_LIMIT;
                    loadInventory(getCurrentFilters());
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                if ((currentOffset + PAGE_LIMIT) < currentTotalCount) {
                    currentOffset += PAGE_LIMIT;
                    loadInventory(getCurrentFilters());
                }
            });
        }
    }
});
