/**
 * ─── Auth Context ───────────────────────────────────────────────
 * Global authentication state provider.
 *
 * Responsibilities:
 *   • Listens to Supabase auth state changes
 *   • Fetches the user profile from Supabase `profiles` table
 *   • Syncs/resolves the Django Shop record on login
 *   • Exposes login / register / logout via the service layer
 *   • Never calls Supabase directly (delegates to authService)
 * ────────────────────────────────────────────────────────────────
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';
import api from '../lib/axios';
import { toast } from '../utils/toast';

const AuthContext = createContext({
  user: null,
  shop: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);


  // ── Django Shop sync ───────────────────────────────────────────
  // After Supabase auth succeeds, eagerly resolve the shop record
  // from the Django backend. This ensures the Shop exists and is
  // linked to this Supabase user. If 404 → shop is null (onboarding needed).
  const syncShop = useCallback(async () => {
    try {
      const res = await api.get('/accounts/shop/current/');
      setShop(res.data);

      // Sync hallmark_value to localStorage for billing module
      if (res.data?.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', res.data.hallmark_value);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // No shop yet — user needs onboarding
        setShop(null);
      } else {
        console.warn('[AuthContext] Shop sync failed:', err?.message);
        setShop(null);
      }
    }
  }, []);

  // ── Bootstrap: check existing local session ───
  const checkSession = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/accounts/auth/me/');
      setUser(res.data.user);
      await syncShop();
    } catch (err) {
      console.warn('Session expired or invalid:', err?.message);
      authService.signOut();
      setUser(null);
      setShop(null);
    } finally {
      setLoading(false);
    }
  }, [syncShop]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ── Wrapped methods (delegate to authService) ──────────────────
  const login = useCallback(async (email, password) => {
    // ── Offline Password Fallback ──
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const res = await api.post('/accounts/auth/offline-login/', { email, password });
        const userData = res.data.user || { email, is_offline: true };
        setUser(userData);
        setShop(res.data.shop || null);
        if (res.data.shop?.hallmark_value) {
          localStorage.setItem('jewellosoft_hallmark_value', res.data.shop.hallmark_value);
        }
        if (res.data.access_token) {
          localStorage.setItem('access_token', res.data.access_token);
        }
        // Surface sync warning to user
        if (res.data.warning) {
          toast.warning(res.data.warning);
        }
      } catch (err) {
        throw new Error(err.response?.data?.detail || 'Invalid password or profile not found for offline mode.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 1. Supabase Native Login
    const { session } = await authService.signIn(email, password);
    if (!session?.access_token) {
      throw new Error('Login failed: No session returned from Supabase.');
    }

    // 2. Activate Local Offline License & sync Shop Profile
    try {
      const res = await api.post('/accounts/auth/activate/', { password });

      // Backend now returns { status, license, user: {id, email}, shop }
      // Use the explicit 'user' object — never the raw 'license' payload.
      const userData = res.data.user || { email, id: res.data.license?.user_id };
      setUser(userData);
      setShop(res.data.shop || null);

      if (res.data.shop?.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', res.data.shop.hallmark_value);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        alert('Subscription inactive or expired. Please manage your subscription online.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email, password, metadata) => {
    // 1. Create Supabase account. If email confirmation is required, session may be null.
    const { session, user } = await authService.signUp(email, password, metadata);
    const needsEmailConfirmation = !session;

    // 2. Wait briefly for the Supabase Postgres trigger (handle_new_user) to propagate.
    //    This avoids a race condition where the profile row doesn't exist yet when
    //    activate is called immediately after signup.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 3. Activate local license. Pass email explicitly — JWT may be absent when
    //    email confirmation is pending (session = null).
    try {
      const res = await api.post('/accounts/auth/activate/', {
        email,
        password,
        ...metadata,
      });

      // Backend returns { status, license, user: {id, email}, shop }
      const userData = res.data.user || { email, id: res.data.license?.user_id };
      setUser(userData);
      setShop(res.data.shop || null);

      if (res.data.shop?.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', res.data.shop.hallmark_value);
      }
    } catch (err) {
      console.warn('[AuthContext:Register] Activation failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }

    return { needsEmailConfirmation };
  }, []);

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setShop(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, shop, loading, login, register, logout, syncShop }}>
      {children}
    </AuthContext.Provider>
  );
}
