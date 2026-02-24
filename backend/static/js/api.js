/**
 * Authenticated fetch wrapper.
 * Reads token from cookie, attaches to requests.
 * Handles 401 by redirecting to /login.
 */

async function apiFetch(url, options = {}) {
    const token = getCookie('__session');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        window.location.href = '/login';
        return null;
    }

    return response;
}

async function apiGet(url) {
    const resp = await apiFetch(url);
    if (!resp) return null;
    if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
    return resp.json();
}

async function apiPost(url, body = {}) {
    const resp = await apiFetch(url, { method: 'POST', body: JSON.stringify(body) });
    if (!resp) return null;
    if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
    return resp.json();
}

async function apiPut(url, body = {}) {
    const resp = await apiFetch(url, { method: 'PUT', body: JSON.stringify(body) });
    if (!resp) return null;
    if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
    return resp.json();
}

async function apiDelete(url) {
    const resp = await apiFetch(url, { method: 'DELETE' });
    if (!resp) return null;
    if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
    return resp.json();
}

async function apiPatch(url, body = {}) {
    const resp = await apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) });
    if (!resp) return null;
    if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
    return resp.json();
}
