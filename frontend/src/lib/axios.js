import axios from 'axios';
import { toast } from '../utils/toast';
const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

let _electronApiUrl = null;

api.interceptors.request.use(async config => {
  if (window.electronAPI) {
    if (!_electronApiUrl) {
      _electronApiUrl = await window.electronAPI.getApiUrl();
      api.defaults.baseURL = _electronApiUrl; // Update global
    }
    config.baseURL = _electronApiUrl;
  }

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

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    const message = data?.message || data?.detail || error.message || 'Something went wrong';

    if (status === 401) {
      console.warn('[Auth] Session expired or unauthenticated. Please log in again.');
    } else if (status === 400) {
      console.warn('[Validation]', message, data?.errors || '');
      const details = data?.errors ? JSON.stringify(data.errors) : message;
      toast.warning(`Validation Error: ${details}`);
    } else if (status >= 500) {
      toast.error(`Server Error: ${message}`);
    }

    return Promise.reject(error);
  }
);

export function extractList(responseData) {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData.data)) return responseData.data;
  if (Array.isArray(responseData.results)) return responseData.results;
  return [];
}

export default api;
