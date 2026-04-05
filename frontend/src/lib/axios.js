import axios from 'axios';
const api = axios.create({
  // Fallback for web mode, interceptor overwrites in Electron desktop mode
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

let _electronApiUrl = null;

// ── Request interceptor: dynamic URL & Supabase JWT ─────────────────
api.interceptors.request.use(async config => {
  // Electron dynamic routing
  if (window.electronAPI) {
    if (!_electronApiUrl) {
      _electronApiUrl = await window.electronAPI.getApiUrl();
      api.defaults.baseURL = _electronApiUrl; // Update global
    }
    config.baseURL = _electronApiUrl;
  }

  // ── Attach Local JWT ──────────────────────────────────────────────────
  try {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.debug('[axios] Could not attach local token:', err?.message);
  }

  return config;
});

// ── Response interceptor: normalize & error handling ─────────────────
api.interceptors.response.use(
  (response) => {
    // Success — pass through untouched
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Structured error from our custom exception handler
    const message = data?.message || data?.detail || error.message || 'Something went wrong';

    if (status === 401) {
      console.warn('[Auth] Session expired or unauthenticated. Please log in again.');
      // Could redirect to login here
    } else if (status === 400) {
      console.warn('[Validation]', message, data?.errors || '');
      const details = data?.errors ? JSON.stringify(data.errors) : message;
      alert(`Validation Error: ${details}`);
    } else if (status >= 500) {
      console.error('[Server Error]', message);
    }

    return Promise.reject(error);
  }
);

/**
 * Safely extract the array of records from any API response.
 * Handles:
 *   - Paginated: { status, data: [...], count, next, previous }
 *   - DRF default paginated: { results: [...], count }
 *   - Direct array: [...]
 *   - Empty / null: []
 */
export function extractList(responseData) {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData.data)) return responseData.data;
  if (Array.isArray(responseData.results)) return responseData.results;
  return [];
}

export default api;
