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
    // ── Offline Password Fallback ──
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const res = await api.post('/accounts/auth/offline-login/', { email, password });
        setUser(res.data.user);
        setShop(res.data.shop);
        if (res.data.shop?.hallmark_value) {
          localStorage.setItem('jewellosoft_hallmark_value', res.data.shop.hallmark_value);
        }
        if (res.data.access_token) {
          localStorage.setItem('access_token', res.data.access_token);
        }
      } catch (err) {
        throw new Error(err.response?.data?.detail || "Invalid password or profile not found for offline mode.");
      }
      setLoading(false);
      return;
    }

    // 1. Supabase Native Login
    await authService.signIn(email, password);
    
    // 2. Activate Local Offline License & sync Shop Profile
    try {
      const res = await api.post('/accounts/auth/activate/', { password });
      setUser(res.data.license); // Set User from license structure
      setShop(res.data.shop);
      if (res.data.shop?.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', res.data.shop.hallmark_value);
      }
    } catch (err) {
       if (err.response?.status === 403) {
         alert("Subscription inactive or expired. Please manage your subscription online.");
       }
       throw err;
    } finally {
       setLoading(false);
    }
  }, []);

  const register = useCallback(async (email, password, metadata) => {
    // 1. Supabase Native Register (Postgres Trigger instantly creates profile)
    const { session, user } = await authService.signUp(email, password, metadata);
    const needsEmailConfirmation = !session;
    
    // 2. Login implicitly happens, so let's activate the DB
    try {
      // NOTE: We pass email explicitly so backend can resolve user if JWT is missing due to confirmation pending
      const res = await api.post('/accounts/auth/activate/', { 
        email, 
        password, 
        ...metadata 
      });
      setUser(res.data.license || res.data.user); 
      setShop(res.data.shop);
    } catch (err) {
       console.warn("[AuthContext:Register] Activation failed: ", err);
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
