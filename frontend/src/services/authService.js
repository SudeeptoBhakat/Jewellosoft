import api from '../lib/axios';

const _locks = {};

function acquireLock(key) {
  if (_locks[key]) return false;
  _locks[key] = true;
  return true;
}

function releaseLock(key) {
  _locks[key] = false;
}

export async function signUp(email, password, metadata = {}) {
  if (!acquireLock('signup')) throw new Error('Registration already in progress.');

  try {
    const shopName = metadata.shop_name || metadata.shopName || 'My Jewellery Shop';
    const ownerName = metadata.owner_name || metadata.ownerName || '';
    const mobileNumber = metadata.mobile_number || metadata.mobileNumber || metadata.phone || '';

    const payload = {
      email,
      password,
      shop_name: shopName,
      shopName: shopName,
      owner_name: ownerName,
      ownerName: ownerName,
      mobile_number: mobileNumber,
      mobileNumber: mobileNumber,
      ...metadata,
    };

    const res = await api.post('/accounts/auth/register/', payload);
    const data = res.data;
    // console.log("Data ", data);
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }

    return data;
  } catch (err) {
    const detail = err.response?.data?.detail || err.message || 'Registration failed.';
    throw new Error(detail);
  } finally {
    releaseLock('signup');
  }
}

export async function signIn(email, password) {
  if (!acquireLock('signin')) throw new Error('Login already in progress.');

  try {
    const res = await api.post('/accounts/auth/login/', { email, password });
    const data = res.data;

    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }

    return data;
  } catch (err) {
    const detail = err.response?.data?.detail || err.message || 'Login failed. Please check your credentials.';
    throw new Error(detail);
  } finally {
    releaseLock('signin');
  }
}

export async function signOut() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export async function resendConfirmation(email) {
  try {
    const res = await api.post('/accounts/auth/resend-confirmation/', { email });
    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail || err.message || 'Failed to resend confirmation email.';
    throw new Error(detail);
  }
}

export async function verifyAdminPassword(password) {
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }
  try {
    const res = await api.post('/accounts/auth/verify-password/', { password });
    if (res.data?.valid) {
      return { success: true };
    }
    return { success: false, error: res.data?.detail || 'Incorrect password.' };
  } catch (err) {
    const detail = err.response?.data?.detail || 'Incorrect admin password.';
    return { success: false, error: detail };
  }
}

export async function getSession() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  return { access_token: token };
}
