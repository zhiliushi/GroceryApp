/**
 * Shared utilities for GroceryApp web interface.
 */

function formatDate(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(typeof timestamp === 'number' && timestamp > 1e12 ? timestamp : timestamp * 1000);
    return d.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    const d = new Date(typeof timestamp === 'number' && timestamp > 1e12 ? timestamp : timestamp * 1000);
    return d.toLocaleString('en-MY', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '—';
    return `RM ${parseFloat(amount).toFixed(2)}`;
}

function statusBadge(status) {
    const cls = {
        'active': 'badge-active',
        'consumed': 'badge-consumed',
        'expired': 'badge-expired',
        'discarded': 'badge-discarded',
        'pending_review': 'badge-pending',
        'approved': 'badge-approved',
        'rejected': 'badge-rejected',
    }[status] || 'bg-secondary';
    return `<span class="badge ${cls}">${status || 'unknown'}</span>`;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    toast.role = 'alert';
    toast.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}
