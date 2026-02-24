/**
 * Products database management — list, CRUD, OFF lookup.
 */

/* ------------------------------------------------------------------ */
/*  List page                                                         */
/* ------------------------------------------------------------------ */

async function loadProducts(search) {
    const spinner = document.getElementById('loadingSpinner');
    const tableWrapper = document.getElementById('tableWrapper');
    const emptyState = document.getElementById('emptyState');
    const tbody = document.getElementById('productsTableBody');
    const countBadge = document.getElementById('productCount');

    if (!tbody) return; // not on list page

    spinner.classList.remove('d-none');
    tableWrapper.classList.add('d-none');
    emptyState.classList.add('d-none');

    try {
        let url = '/api/admin/products?limit=100';
        if (search) {
            url += '&search=' + encodeURIComponent(search);
        }

        const data = await apiGet(url);
        spinner.classList.add('d-none');

        const products = data?.products || [];
        countBadge.textContent = products.length;

        if (products.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        tableWrapper.classList.remove('d-none');
        tbody.innerHTML = products.map(p => {
            const imgHtml = p.image_url
                ? `<img src="${p.image_url}" alt="" style="width:40px;height:40px;object-fit:contain;background:#2a2a2a;border-radius:4px;">`
                : '<span class="text-muted small">—</span>';

            const sourceBadge = getSourceBadge(p.source);
            const cached = formatDateTime(p.cached_at);

            return `
                <tr style="border-color: var(--ga-border);">
                    <td>${imgHtml}</td>
                    <td><code class="small">${p.barcode}</code></td>
                    <td>${p.product_name || '—'}</td>
                    <td>${p.brands || '—'}</td>
                    <td><small>${truncate(p.categories || '', 40)}</small></td>
                    <td>${sourceBadge}</td>
                    <td><small class="text-muted">${cached}</small></td>
                    <td>
                        <a href="/products/${p.barcode}/edit" class="btn btn-sm btn-outline-light me-1" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </a>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${p.barcode}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load products:', err);
        spinner.classList.add('d-none');
        emptyState.classList.remove('d-none');
        showToast('Failed to load products.', 'error');
    }
}

function getSourceBadge(source) {
    switch (source) {
        case 'openfoodfacts':
            return '<span class="badge bg-info text-dark">OFF</span>';
        case 'contributed':
            return '<span class="badge bg-warning text-dark">Contributed</span>';
        case 'manual':
            return '<span class="badge bg-primary">Manual</span>';
        default:
            return '<span class="badge bg-secondary">' + (source || 'unknown') + '</span>';
    }
}

function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '...' : str;
}

async function deleteProduct(barcode) {
    if (!confirm(`Delete product ${barcode}? This cannot be undone.`)) return;

    try {
        const result = await apiDelete(`/api/admin/products/${barcode}`);
        showToast(result?.message || 'Product deleted.', 'success');
        loadProducts(getCurrentSearch());
    } catch (err) {
        console.error('Delete failed:', err);
        showToast('Failed to delete product.', 'error');
    }
}

function getCurrentSearch() {
    const input = document.getElementById('searchInput');
    return input ? input.value.trim() : '';
}

/* ------------------------------------------------------------------ */
/*  Form page — load, lookup, save                                    */
/* ------------------------------------------------------------------ */

async function loadProduct(barcode) {
    if (!barcode) return;

    const spinner = document.getElementById('formSpinner');
    const formCard = document.getElementById('formCard');

    try {
        const data = await apiGet(`/api/admin/products/${barcode}`);

        if (!data) {
            showToast('Product not found.', 'error');
            return;
        }

        document.getElementById('pBarcode').value = data.barcode || '';
        document.getElementById('pName').value = data.product_name || '';
        document.getElementById('pBrands').value = data.brands || '';
        document.getElementById('pCategories').value = data.categories || '';
        document.getElementById('pImageUrl').value = data.image_url || '';
        document.getElementById('pSource').value = data.source || 'unknown';

        updateImagePreview(data.image_url);

        if (spinner) spinner.classList.add('d-none');
        if (formCard) formCard.classList.remove('d-none');
    } catch (err) {
        if (spinner) spinner.classList.add('d-none');
        showToast('Failed to load product: ' + err.message, 'error');
    }
}

async function lookupBarcode() {
    const barcodeInput = document.getElementById('pBarcode');
    const barcode = barcodeInput.value.trim();
    if (!barcode) {
        showToast('Please enter a barcode first.', 'error');
        return;
    }

    const lookupBtn = document.getElementById('lookupBtn');
    const statusDiv = document.getElementById('lookupStatus');
    const statusMsg = document.getElementById('lookupMsg');

    if (lookupBtn) lookupBtn.disabled = true;
    statusDiv.classList.remove('d-none');
    statusMsg.textContent = 'Looking up barcode on Open Food Facts...';

    try {
        const data = await apiGet(`/api/admin/products/lookup/${barcode}`);

        // Pre-fill form fields
        if (data.product_name) document.getElementById('pName').value = data.product_name;
        if (data.brands) document.getElementById('pBrands').value = data.brands;
        if (data.categories) document.getElementById('pCategories').value = data.categories;
        if (data.image_url) {
            document.getElementById('pImageUrl').value = data.image_url;
            updateImagePreview(data.image_url);
        }

        statusDiv.className = 'alert alert-success mb-3';
        statusMsg.textContent = 'Product found on Open Food Facts! Fields pre-filled.';
    } catch (err) {
        statusDiv.className = 'alert alert-warning mb-3';
        statusMsg.textContent = 'Product not found on Open Food Facts. You can enter details manually.';
    } finally {
        if (lookupBtn) lookupBtn.disabled = false;
    }
}

async function saveProduct() {
    const form = document.getElementById('productForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btn = document.getElementById('btnSubmit');
    if (btn) btn.disabled = true;

    const editBarcode = document.getElementById('editBarcode').value;
    const barcode = document.getElementById('pBarcode').value.trim();

    const body = {
        barcode: barcode,
        product_name: document.getElementById('pName').value.trim(),
        brands: document.getElementById('pBrands').value.trim() || null,
        categories: document.getElementById('pCategories').value.trim() || null,
        image_url: document.getElementById('pImageUrl').value.trim() || null,
    };

    try {
        if (editBarcode) {
            // Update existing
            await apiPut(`/api/admin/products/${editBarcode}`, body);
            showToast('Product updated successfully.');
        } else {
            // Create new
            await apiPost('/api/admin/products', body);
            showToast('Product created successfully.');
        }
        setTimeout(() => { window.location.href = '/products'; }, 800);
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
        if (btn) btn.disabled = false;
    }
}

function updateImagePreview(url) {
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('previewImg');
    if (url) {
        img.src = url;
        preview.classList.remove('d-none');
    } else {
        preview.classList.add('d-none');
    }
}

/* ------------------------------------------------------------------ */
/*  Page initialisation                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    // List page
    const tbody = document.getElementById('productsTableBody');
    if (tbody) {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const clearBtn = document.getElementById('clearBtn');

        searchBtn.addEventListener('click', () => {
            const q = searchInput.value.trim();
            if (q) clearBtn.classList.remove('d-none');
            loadProducts(q);
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.add('d-none');
            loadProducts();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchBtn.click();
            }
        });

        // Initial load
        loadProducts();
        return;
    }

    // Form page
    const formCard = document.getElementById('formCard');
    if (formCard) {
        const editBarcode = document.getElementById('editBarcode').value;
        if (editBarcode) {
            loadProduct(editBarcode);
        }

        // Image preview on URL change
        const imageInput = document.getElementById('pImageUrl');
        if (imageInput) {
            imageInput.addEventListener('change', () => {
                updateImagePreview(imageInput.value.trim());
            });
        }
        return;
    }
});
