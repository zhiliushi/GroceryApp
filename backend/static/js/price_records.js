/**
 * Price records management — list, delete, bulk delete.
 */

let currentOffset = 0;
const PAGE_LIMIT = 50;
let currentTotal = 0;
let selectedRecords = {};
let searchTimeout = null;

/* ------------------------------------------------------------------ */
/*  Load records                                                       */
/* ------------------------------------------------------------------ */

async function loadRecords(page, search, barcode) {
    const spinner = document.getElementById('loadingSpinner');
    const tableWrapper = document.getElementById('tableWrapper');
    const emptyState = document.getElementById('emptyState');
    const tbody = document.getElementById('recordsTableBody');
    const countBadge = document.getElementById('recordCount');
    const paginationWrapper = document.getElementById('paginationWrapper');

    if (!tbody) return;

    spinner.classList.remove('d-none');
    tableWrapper.classList.add('d-none');
    emptyState.classList.add('d-none');
    if (paginationWrapper) paginationWrapper.classList.add('d-none');

    // Clear selections on reload
    selectedRecords = {};
    updateBulkBar();

    const offset = (page || 0) * PAGE_LIMIT;
    currentOffset = offset;

    try {
        const params = new URLSearchParams();
        params.set('limit', PAGE_LIMIT);
        params.set('offset', offset);
        if (search) params.set('search', search);
        if (barcode) params.set('barcode', barcode);

        const data = await apiGet(`/api/admin/price-records?${params.toString()}`);
        spinner.classList.add('d-none');

        if (!data) return;

        const records = data.records || [];
        currentTotal = data.total || 0;
        countBadge.textContent = currentTotal;

        if (records.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        tableWrapper.classList.remove('d-none');

        // Reset select-all
        const selectAllCb = document.getElementById('selectAll');
        if (selectAllCb) selectAllCb.checked = false;

        tbody.innerHTML = records.map(r => {
            const price = r.price != null ? formatCurrency(r.price) : '—';
            const date = formatDateTime(r.created_at);
            const userShort = r.user_id ? r.user_id.substring(0, 8) + '...' : '—';
            const storeName = escapeHtml(r.store_name || '—');
            const location = escapeHtml(r.location_address || '—');
            const productName = escapeHtml(r.product_name || '—');
            const barcodeVal = r.barcode || '—';

            return `
                <tr style="border-color: var(--ga-border);" data-user-id="${escapeAttr(r.user_id)}" data-record-id="${escapeAttr(r.id)}">
                    <td>
                        <input type="checkbox" class="form-check-input row-checkbox"
                               data-user-id="${escapeAttr(r.user_id)}" data-record-id="${escapeAttr(r.id)}"
                               onchange="toggleSelection(this)">
                    </td>
                    <td><code class="small">${escapeHtml(barcodeVal)}</code></td>
                    <td>${productName}</td>
                    <td>${price}</td>
                    <td>${storeName}</td>
                    <td><small>${location}</small></td>
                    <td><span class="small text-muted" title="${escapeAttr(r.user_id || '')}">${escapeHtml(userShort)}</span></td>
                    <td><small class="text-muted">${date}</small></td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('${escapeAttr(r.user_id)}', '${escapeAttr(r.id)}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Show pagination
        if (paginationWrapper) {
            paginationWrapper.classList.remove('d-none');
            updatePagination(records.length);
        }

    } catch (err) {
        console.error('Failed to load price records:', err);
        spinner.classList.add('d-none');
        emptyState.classList.remove('d-none');
        showToast('Failed to load price records.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */

function updatePagination(loadedCount) {
    const info = document.getElementById('paginationInfo');
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');

    if (!info) return;

    const start = currentOffset + 1;
    const end = currentOffset + loadedCount;
    info.textContent = `Showing ${start}–${end} of ${currentTotal}`;

    if (prev) prev.disabled = currentOffset === 0;
    if (next) next.disabled = (currentOffset + PAGE_LIMIT) >= currentTotal;
}

function getCurrentPage() {
    return Math.floor(currentOffset / PAGE_LIMIT);
}

/* ------------------------------------------------------------------ */
/*  Delete single record                                               */
/* ------------------------------------------------------------------ */

async function deleteRecord(userId, recordId) {
    if (!confirm('Delete this price record? This cannot be undone.')) return;

    try {
        const result = await apiDelete(`/api/admin/price-records/${encodeURIComponent(userId)}/${encodeURIComponent(recordId)}`);
        showToast('Price record deleted.', 'success');
        loadRecords(getCurrentPage(), getCurrentSearch());
    } catch (err) {
        console.error('Delete failed:', err);
        showToast('Failed to delete price record.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Bulk delete                                                        */
/* ------------------------------------------------------------------ */

async function bulkDeleteRecords() {
    const keys = Object.keys(selectedRecords);
    if (keys.length === 0) return;

    if (!confirm(`Delete ${keys.length} price record(s)? This cannot be undone.`)) return;

    const records = keys.map(key => {
        const parts = key.split('::');
        return { user_id: parts[0], record_id: parts[1] };
    });

    try {
        const result = await apiPost('/api/admin/price-records/batch-delete', { records });
        showToast(`Deleted ${result.deleted || 0} record(s).`, 'success');
        selectedRecords = {};
        updateBulkBar();
        loadRecords(getCurrentPage(), getCurrentSearch());
    } catch (err) {
        console.error('Bulk delete failed:', err);
        showToast('Failed to delete records.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Selection management                                               */
/* ------------------------------------------------------------------ */

function toggleSelection(checkbox) {
    const key = checkbox.dataset.userId + '::' + checkbox.dataset.recordId;
    if (checkbox.checked) {
        selectedRecords[key] = true;
    } else {
        delete selectedRecords[key];
    }
    updateBulkBar();
    updateSelectAllState();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-checkbox');

    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        const key = cb.dataset.userId + '::' + cb.dataset.recordId;
        if (selectAll.checked) {
            selectedRecords[key] = true;
        } else {
            delete selectedRecords[key];
        }
    });
    updateBulkBar();
}

function updateSelectAllState() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-checkbox');
    if (!selectAll || checkboxes.length === 0) return;

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAll.checked = allChecked;
}

function updateBulkBar() {
    const bulkBar = document.getElementById('bulkBar');
    const selectedCountEl = document.getElementById('selectedCount');
    const count = Object.keys(selectedRecords).length;

    if (count > 0) {
        bulkBar.classList.remove('d-none');
        selectedCountEl.textContent = count;
    } else {
        bulkBar.classList.add('d-none');
    }
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

function getCurrentSearch() {
    const input = document.getElementById('searchInput');
    return input ? input.value.trim() : '';
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

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ */
/*  Initialization                                                     */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('recordsTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('clearBtn');
    const selectAllCb = document.getElementById('selectAll');

    // Search button
    searchBtn.addEventListener('click', () => {
        const q = searchInput.value.trim();
        if (q) clearBtn.classList.remove('d-none');
        currentOffset = 0;
        loadRecords(0, q);
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('d-none');
        currentOffset = 0;
        loadRecords(0);
    });

    // Search on Enter
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });

    // Search debounce (300ms)
    searchInput.addEventListener('input', () => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const q = searchInput.value.trim();
            if (q) {
                clearBtn.classList.remove('d-none');
            } else {
                clearBtn.classList.add('d-none');
            }
            currentOffset = 0;
            loadRecords(0, q);
        }, 300);
    });

    // Select all checkbox
    if (selectAllCb) {
        selectAllCb.addEventListener('change', toggleSelectAll);
    }

    // Pagination buttons
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentOffset >= PAGE_LIMIT) {
                const page = getCurrentPage() - 1;
                loadRecords(page, getCurrentSearch());
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if ((currentOffset + PAGE_LIMIT) < currentTotal) {
                const page = getCurrentPage() + 1;
                loadRecords(page, getCurrentSearch());
            }
        });
    }

    // Initial load
    loadRecords(0);
});
