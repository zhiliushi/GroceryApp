/**
 * Contributed Products management — list, approve, reject, delete, bulk actions.
 */

let currentOffset = 0;
const PAGE_LIMIT = 50;
let currentTotal = 0;
let currentStatus = '';
let selectedBarcodes = {};
let searchTimeout = null;

/* ------------------------------------------------------------------ */
/*  Load records                                                       */
/* ------------------------------------------------------------------ */

async function loadContributed(page, search, status) {
    const spinner = document.getElementById('loadingSpinner');
    const tableWrapper = document.getElementById('tableWrapper');
    const emptyState = document.getElementById('emptyState');
    const tbody = document.getElementById('productsTableBody');
    const paginationWrapper = document.getElementById('paginationWrapper');

    if (!tbody) return;

    spinner.classList.remove('d-none');
    tableWrapper.classList.add('d-none');
    emptyState.classList.add('d-none');
    if (paginationWrapper) paginationWrapper.classList.add('d-none');

    // Clear selections on reload
    selectedBarcodes = {};
    updateBulkBar();

    const offset = (page || 0) * PAGE_LIMIT;
    currentOffset = offset;

    try {
        const params = new URLSearchParams();
        params.set('limit', PAGE_LIMIT);
        params.set('offset', offset);
        if (search) params.set('search', search);
        if (status) params.set('status', status);

        const data = await apiGet(`/api/admin/contributed?${params.toString()}`);
        spinner.classList.add('d-none');

        if (!data) return;

        const records = data.records || [];
        currentTotal = data.total || 0;

        // Update counts
        const counts = data.counts || {};
        updateCounts(counts);

        if (records.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        tableWrapper.classList.remove('d-none');

        // Reset select-all
        const selectAllCb = document.getElementById('selectAll');
        if (selectAllCb) selectAllCb.checked = false;

        tbody.innerHTML = records.map(p => {
            const name = escapeHtml(p.product_name || '—');
            const brand = escapeHtml(p.brands || '—');
            const category = escapeHtml(p.categories || '—');
            const contributorShort = p.contributed_by ? p.contributed_by.substring(0, 8) + '...' : '—';
            const date = formatDateTime(p.contributed_at);
            const bc = escapeAttr(p.barcode);

            // Image column
            const imgHtml = p.image_url
                ? `<img src="${escapeAttr(p.image_url)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`
                : `<i class="bi bi-image text-muted" style="font-size:1.4rem;"></i>`;

            // Status badge
            const badge = statusBadge(p.status);

            // Actions
            let actionsHtml = '';
            if (p.status === 'pending_review') {
                actionsHtml = `
                    <button class="btn btn-sm btn-success me-1" onclick="approveProduct('${bc}')" title="Approve">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="btn btn-sm btn-danger me-1" onclick="openRejectModal('${bc}')" title="Reject">
                        <i class="bi bi-x-lg"></i>
                    </button>
                `;
            } else if (p.status === 'approved' || p.status === 'rejected') {
                const reviewer = p.reviewed_by ? p.reviewed_by.substring(0, 8) + '...' : '';
                const reviewDate = p.reviewed_at ? formatDateTime(p.reviewed_at) : '';
                const reasonHtml = p.rejection_reason
                    ? `<br><span class="text-danger small">${escapeHtml(p.rejection_reason)}</span>`
                    : '';
                actionsHtml = `<small class="text-muted">${reviewer} ${reviewDate}${reasonHtml}</small>`;
            }

            // Always add delete button
            actionsHtml += `
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${bc}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            `;

            return `
                <tr style="border-color: var(--ga-border);" data-barcode="${bc}">
                    <td>
                        <input type="checkbox" class="form-check-input row-checkbox"
                               data-barcode="${bc}" onchange="toggleSelection(this)">
                    </td>
                    <td class="text-center">${imgHtml}</td>
                    <td><code class="small">${escapeHtml(p.barcode)}</code></td>
                    <td>${name}</td>
                    <td>${brand}</td>
                    <td>${category}</td>
                    <td><span class="small text-muted" title="${escapeAttr(p.contributed_by || '')}">${escapeHtml(contributorShort)}</span></td>
                    <td><small class="text-muted">${date}</small></td>
                    <td>${badge}</td>
                    <td class="text-nowrap">${actionsHtml}</td>
                </tr>
            `;
        }).join('');

        // Show pagination
        if (paginationWrapper) {
            paginationWrapper.classList.remove('d-none');
            updatePagination(records.length);
        }

    } catch (err) {
        console.error('Failed to load contributed products:', err);
        spinner.classList.add('d-none');
        emptyState.classList.remove('d-none');
        showToast('Failed to load contributed products.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Counts                                                             */
/* ------------------------------------------------------------------ */

function updateCounts(counts) {
    const el = (id, val) => {
        const e = document.getElementById(id);
        if (e) e.textContent = val;
    };
    el('totalCount', counts.total || 0);
    el('countAll', counts.total || 0);
    el('countPending', counts.pending_review || 0);
    el('countApproved', counts.approved || 0);
    el('countRejected', counts.rejected || 0);
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
/*  Status filter tabs                                                 */
/* ------------------------------------------------------------------ */

function setStatusFilter(status) {
    currentStatus = status;
    currentOffset = 0;

    // Update active tab
    document.querySelectorAll('.status-tab').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.remove('btn-outline-secondary');
    });
    const activeBtn = document.querySelector(`.status-tab[data-status="${status}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    loadContributed(0, getCurrentSearch(), status);
}

/* ------------------------------------------------------------------ */
/*  Approve / Reject / Delete — single                                 */
/* ------------------------------------------------------------------ */

async function approveProduct(barcode) {
    try {
        const result = await apiPost(`/api/admin/contributed/${encodeURIComponent(barcode)}/approve`);
        showToast(result?.message || 'Product approved.', 'success');
        loadContributed(getCurrentPage(), getCurrentSearch(), currentStatus);
    } catch (err) {
        console.error('Approve failed:', err);
        showToast('Failed to approve product.', 'error');
    }
}

function openRejectModal(barcode) {
    document.getElementById('rejectBarcode').value = barcode;
    document.getElementById('rejectReason').value = '';
    const modal = new bootstrap.Modal(document.getElementById('rejectModal'));
    modal.show();
}

async function rejectProduct(barcode, reason) {
    try {
        const encodedReason = encodeURIComponent(reason);
        const result = await apiPost(`/api/admin/contributed/${encodeURIComponent(barcode)}/reject?reason=${encodedReason}`);
        showToast(result?.message || 'Product rejected.', 'success');
        loadContributed(getCurrentPage(), getCurrentSearch(), currentStatus);
    } catch (err) {
        console.error('Reject failed:', err);
        showToast('Failed to reject product.', 'error');
    }
}

async function deleteProduct(barcode) {
    if (!confirm('Delete this contributed product? This cannot be undone.')) return;

    try {
        await apiDelete(`/api/admin/contributed/${encodeURIComponent(barcode)}`);
        showToast('Product deleted.', 'success');
        loadContributed(getCurrentPage(), getCurrentSearch(), currentStatus);
    } catch (err) {
        console.error('Delete failed:', err);
        showToast('Failed to delete product.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Bulk actions                                                       */
/* ------------------------------------------------------------------ */

async function bulkApprove() {
    const barcodes = Object.keys(selectedBarcodes);
    if (barcodes.length === 0) return;
    if (!confirm(`Approve ${barcodes.length} product(s)?`)) return;

    let success = 0;
    for (const bc of barcodes) {
        try {
            await apiPost(`/api/admin/contributed/${encodeURIComponent(bc)}/approve`);
            success++;
        } catch (err) {
            console.error(`Approve ${bc} failed:`, err);
        }
    }
    showToast(`Approved ${success} of ${barcodes.length} product(s).`, 'success');
    selectedBarcodes = {};
    updateBulkBar();
    loadContributed(getCurrentPage(), getCurrentSearch(), currentStatus);
}

function openBulkRejectModal() {
    document.getElementById('bulkRejectReason').value = '';
    const modal = new bootstrap.Modal(document.getElementById('bulkRejectModal'));
    modal.show();
}

async function bulkReject(reason) {
    const barcodes = Object.keys(selectedBarcodes);
    if (barcodes.length === 0) return;

    let success = 0;
    for (const bc of barcodes) {
        try {
            const encodedReason = encodeURIComponent(reason);
            await apiPost(`/api/admin/contributed/${encodeURIComponent(bc)}/reject?reason=${encodedReason}`);
            success++;
        } catch (err) {
            console.error(`Reject ${bc} failed:`, err);
        }
    }
    showToast(`Rejected ${success} of ${barcodes.length} product(s).`, 'success');
    selectedBarcodes = {};
    updateBulkBar();
    loadContributed(getCurrentPage(), getCurrentSearch(), currentStatus);
}

async function bulkDelete() {
    const barcodes = Object.keys(selectedBarcodes);
    if (barcodes.length === 0) return;
    if (!confirm(`Delete ${barcodes.length} product(s)? This cannot be undone.`)) return;

    try {
        const result = await apiPost('/api/admin/contributed/batch-delete', { barcodes });
        showToast(`Deleted ${result.deleted || 0} product(s).`, 'success');
        selectedBarcodes = {};
        updateBulkBar();
        loadContributed(getCurrentPage(), getCurrentSearch(), currentStatus);
    } catch (err) {
        console.error('Bulk delete failed:', err);
        showToast('Failed to delete products.', 'error');
    }
}

/* ------------------------------------------------------------------ */
/*  Selection management                                               */
/* ------------------------------------------------------------------ */

function toggleSelection(checkbox) {
    const bc = checkbox.dataset.barcode;
    if (checkbox.checked) {
        selectedBarcodes[bc] = true;
    } else {
        delete selectedBarcodes[bc];
    }
    updateBulkBar();
    updateSelectAllState();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.row-checkbox');

    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        const bc = cb.dataset.barcode;
        if (selectAll.checked) {
            selectedBarcodes[bc] = true;
        } else {
            delete selectedBarcodes[bc];
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
    const count = Object.keys(selectedBarcodes).length;

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
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('clearBtn');
    const selectAllCb = document.getElementById('selectAll');

    // Status filter tabs
    document.querySelectorAll('.status-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            setStatusFilter(btn.dataset.status);
        });
    });

    // Search button
    searchBtn.addEventListener('click', () => {
        const q = searchInput.value.trim();
        if (q) clearBtn.classList.remove('d-none');
        currentOffset = 0;
        loadContributed(0, q, currentStatus);
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('d-none');
        currentOffset = 0;
        loadContributed(0, '', currentStatus);
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
            loadContributed(0, q, currentStatus);
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
                loadContributed(page, getCurrentSearch(), currentStatus);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if ((currentOffset + PAGE_LIMIT) < currentTotal) {
                const page = getCurrentPage() + 1;
                loadContributed(page, getCurrentSearch(), currentStatus);
            }
        });
    }

    // Single reject modal confirm
    document.getElementById('confirmRejectBtn').addEventListener('click', async () => {
        const barcode = document.getElementById('rejectBarcode').value;
        const reason = document.getElementById('rejectReason').value.trim();
        if (!reason) {
            showToast('Please provide a rejection reason.', 'error');
            return;
        }

        const modalEl = document.getElementById('rejectModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        await rejectProduct(barcode, reason);
    });

    // Bulk reject modal confirm
    document.getElementById('confirmBulkRejectBtn').addEventListener('click', async () => {
        const reason = document.getElementById('bulkRejectReason').value.trim();
        if (!reason) {
            showToast('Please provide a rejection reason.', 'error');
            return;
        }

        const modalEl = document.getElementById('bulkRejectModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        await bulkReject(reason);
    });

    // Initial load
    loadContributed(0);
});
