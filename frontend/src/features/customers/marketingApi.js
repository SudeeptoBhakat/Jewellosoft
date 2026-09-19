import api from '../../lib/axios';

const BASE = '/marketing';

export const whatsappApi = {
  getSession: () => api.get(`${BASE}/whatsapp/session/`),
  initQR: () => api.post(`${BASE}/whatsapp/session/`, { action: 'init_qr' }),
  confirmScan: (phone, name) => api.post(`${BASE}/whatsapp/session/`, { action: 'confirm_scan', phone, name }),
  disconnect: () => api.post(`${BASE}/whatsapp/session/`, { action: 'disconnect' }),
  updateConfig: (gateway_url, api_key) => api.post(`${BASE}/whatsapp/session/`, { action: 'update_config', gateway_url, api_key }),
  sendSingle: (formData) => api.post(`${BASE}/whatsapp/send-single/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const campaignApi = {
  create: (formData) => api.post(`${BASE}/campaigns/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list: () => api.get(`${BASE}/campaigns/`),
  progress: (id) => api.get(`${BASE}/campaigns/${id}/progress/`),
  cancel: (id) => api.patch(`${BASE}/campaigns/${id}/`, { status: 'cancelled' }),
};

export const templateApi = {
  list: () => api.get(`${BASE}/templates/`),
  create: (data) => api.post(`${BASE}/templates/`, data),
  delete: (id) => api.delete(`${BASE}/templates/${id}/`),
};
