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
    const { session, user: authUser } = await authService.signIn(email, password);
    if (!session?.access_token) {
      throw new Error('Login failed: No session returned from Supabase.');
    }

    const meta = authUser?.user_metadata || {};

    // 2. Direct client-side profile sync to Supabase table
    try {
      const client = authService.getSupabaseClient();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await client.from('profiles').upsert({
        id: authUser.id,
        email: authUser.email,
        shop_name: meta.shop_name || meta.shopName || 'My Jewellery Shop',
        owner_name: meta.owner_name || meta.ownerName || '',
        mobile_number: meta.mobile_number || meta.mobileNumber || meta.phone || '',
        plan: 'free',
        is_active: true,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (syncErr) {
      console.warn('[AuthContext] Direct Supabase profile sync notice:', syncErr?.message);
    }

    // 3. Activate Local Offline License & sync Shop Profile
    try {
      const res = await api.post('/accounts/auth/activate/', {
        password,
        shop_name: meta.shop_name || meta.shopName || '',
        owner_name: meta.owner_name || meta.ownerName || '',
        mobile_number: meta.mobile_number || meta.mobileNumber || meta.phone || '',
      });

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

    if (needsEmailConfirmation) {
      setLoading(false);
      return { needsEmailConfirmation: true };
    }

    // 2. Wait briefly for Supabase Postgres trigger (handle_new_user) to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Activate local license & provision shop
    try {
      const res = await api.post('/accounts/auth/activate/', {
        email,
        password,
        ...metadata,
      });

      const userData = res.data.user || { email, id: res.data.license?.user_id || user?.id };
      setUser(userData);
      setShop(res.data.shop || null);

      if (res.data.shop?.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', res.data.shop.hallmark_value);
      }
    } catch (err) {
      console.warn('[AuthContext:Register] Activation failed:', err);
      const detail = err.response?.data?.detail || err.message || 'Registration activation failed.';
      throw new Error(detail);
    } finally {
      setLoading(false);
    }

    return { needsEmailConfirmation: false };
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
