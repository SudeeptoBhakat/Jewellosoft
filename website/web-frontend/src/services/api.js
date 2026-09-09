import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const registerUser = async (data) => {
  const response = await api.post('/auth/register', data);
  return response.data;
};

export const loginUser = async (data) => {
  const response = await api.post('/auth/login', data);
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('/auth/profile');
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await api.put('/auth/profile', data);
  return response.data;
};

export const getPlans = async () => {
  const response = await api.get('/payment/plans');
  return response.data;
};

export const createPaymentOrder = async (plan_id) => {
  const response = await api.post('/payment/create-order', { plan_id });
  return response.data;
};

export const verifyPayment = async (data) => {
  const response = await api.post('/payment/verify-payment', data);
  return response.data;
};

export const getUserSubscription = async () => {
  const response = await api.get('/payment/subscription');
  return response.data;
};

export default api;