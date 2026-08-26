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
  syncShop: async () => {},
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

  // ── Backend-Driven Login ──────────────────────────────────────
  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      const data = await authService.signIn(email, password);

      const userData = data.user || { email, is_offline: data.is_offline };
      setUser(userData);
      setShop(data.shop || null);

      if (data.shop?.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', data.shop.hallmark_value);
      }

      if (data.warning) {
        toast.warning(data.warning);
      }

      return data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Backend-Driven Registration ───────────────────────────────
  const register = useCallback(async (email, password, metadata) => {
    try {
      setLoading(true);
      const data = await authService.signUp(email, password, metadata);
      const needsEmailConfirmation = !!data.needs_email_confirmation;

      if (needsEmailConfirmation) {
        setLoading(false);
        return { needsEmailConfirmation: true };
      }

      const userData = data.user || { email, is_offline: false };
      setUser(userData);
      setShop(data.shop || null);

      if (data.shop?.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', data.shop.hallmark_value);
      }

      return { needsEmailConfirmation: false };
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
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
