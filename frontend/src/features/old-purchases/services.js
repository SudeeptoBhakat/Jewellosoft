/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import api, { extractList } from '../../lib/axios';

export const fetchVouchers = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const res = await api.get(`/old-purchases/vouchers/${query ? `?${query}` : ''}`);
  return {
    results: extractList(res.data),
    count: res.data?.count || 0,
  };
};

export const fetchVoucherById = async (id) => {
  const res = await api.get(`/old-purchases/vouchers/${id}/`);
  return res.data;
};

export const lookupVoucher = async (voucherNo) => {
  const res = await api.get(`/old-purchases/vouchers/lookup/?no=${encodeURIComponent(voucherNo)}`);
  return res.data;
};

export const createVoucher = async (data) => {
  const res = await api.post('/old-purchases/vouchers/', data);
  return res.data;
};

export const updateVoucher = async (id, data) => {
  const res = await api.patch(`/old-purchases/vouchers/${id}/`, data);
  return res.data;
};

export const deleteVoucher = async (id) => {
  const res = await api.delete(`/old-purchases/vouchers/${id}/`);
  return res.data;
};
