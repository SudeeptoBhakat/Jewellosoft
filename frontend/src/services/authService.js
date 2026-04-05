/**
 * ─── Auth Service Layer ─────────────────────────────────────────
 * Hand-rolled local auth service communicating with Django SimpleJWT.
 * ────────────────────────────────────────────────────────────────
 */

import api from '../lib/axios';

// ── Request lock (prevents duplicate parallel calls) ────────────
const _locks = {};

function acquireLock(key) {
  if (_locks[key]) return false;
  _locks[key] = true;
  return true;
}

function releaseLock(key) {
  _locks[key] = false;
}

function assertOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You are offline. Please check your internet connection and try again.');
  }
}

// ─── PUBLIC API ──────────────────────────────────────────────────

function parseError(err) {
  return err.response?.data?.detail || err.response?.data?.message || err.message || "Authentication failed.";
}

export async function signUp(email, password, metadata = {}) {
  assertOnline();
  if (!acquireLock('signup')) throw new Error('Registration already in progress.');

  try {
    const res = await api.post('/accounts/auth/register/', { email, password, ...metadata });
    const { user, session } = res.data;
    
    if (session?.access_token) {
      localStorage.setItem('access_token', session.access_token);
      localStorage.setItem('refresh_token', session.refresh_token);
    }
    
    return { user, session, needsEmailConfirmation: false };
  } catch (err) {
    throw new Error(parseError(err));
  } finally {
    releaseLock('signup');
  }
}

export async function signIn(email, password) {
  assertOnline();
  if (!acquireLock('signin')) throw new Error('Login already in progress.');

  try {
    // Call the standard SimpleJWT endpoint
    const res = await api.post('/auth/token/', { username: email, password });
    
    const access_token = res.data.access;
    const refresh_token = res.data.refresh;
    
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    
    // We don't get user details back from TokenObtainPairView default,
    // so we return the session and the AuthContext will fetch /me
    return { session: { access_token, refresh_token }, user: null };
  } catch (err) {
    throw new Error(parseError(err));
  } finally {
    releaseLock('signin');
  }
}

export async function signOut() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export async function resendConfirmation(email) {
  // Not applicable for local auth, mock success
  return true;
}

export async function getSession() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return { access_token: token };
}

export function getSupabaseClient() {
  // Mock function to prevent breaking older code that tries to use it initially
  return null;
}

