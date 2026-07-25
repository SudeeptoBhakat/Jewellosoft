/**
 * ─── Auth Service Layer ─────────────────────────────────────────
 * Hand-rolled local auth service communicating with Django SimpleJWT.
 * ────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabaseClient';

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

export async function signUp(email, password, metadata = {}) {
  assertOnline();
  if (!acquireLock('signup')) throw new Error('Registration already in progress.');

  try {
    const shopName = metadata.shop_name || metadata.shopName || 'My Jewellery Shop';
    const ownerName = metadata.owner_name || metadata.ownerName || '';
    const mobileNumber = metadata.mobile_number || metadata.mobileNumber || metadata.phone || '';

    const metaPayload = {
      ...metadata,
      shop_name: shopName,
      shopName: shopName,
      owner_name: ownerName,
      ownerName: ownerName,
      mobile_number: mobileNumber,
      mobileNumber: mobileNumber,
    };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metaPayload,
      }
    });

    if (error) throw error;

    if (data.session?.access_token) {
      localStorage.setItem('access_token', data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
    }

    if (data.user && data.session) {
      try {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          shop_name: shopName,
          owner_name: ownerName,
          mobile_number: mobileNumber,
          plan: 'free',
          is_active: true,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      } catch (profileErr) {
        console.warn('[authService] Profile sync notice:', profileErr?.message);
      }
    }

    return { user: data.user, session: data.session };
  } finally {
    releaseLock('signup');
  }
}

export async function signIn(email, password) {
  assertOnline();
  if (!acquireLock('signin')) throw new Error('Login already in progress.');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (data.session?.access_token) {
      localStorage.setItem('access_token', data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
    }
    
    return { user: data.user, session: data.session };
  } finally {
    releaseLock('signin');
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });
  if (error) throw error;
  return true;
}

export async function getSession() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return { access_token: token };
}

export function getSupabaseClient() {
  return supabase;
}

