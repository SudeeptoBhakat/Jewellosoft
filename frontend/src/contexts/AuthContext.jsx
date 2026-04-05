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
    await authService.signIn(email, password);
    await checkSession();
  }, [checkSession]);

  const register = useCallback(async (email, password, metadata) => {
    const result = await authService.signUp(email, password, metadata);
    await checkSession();
    return result;
  }, [checkSession]);

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setShop(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, shop, loading, login, register, logout, syncShop }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
