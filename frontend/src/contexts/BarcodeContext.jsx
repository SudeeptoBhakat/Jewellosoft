import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { useTabs } from './TabContext';

const BarcodeContext = createContext(null);

export function BarcodeProvider({ children }) {
  const { tabs, activeTabId, openTab, setActiveTabId } = useTabs();
  const [scanAlert, setScanAlert] = useState(null);
  const pendingScansRef = useRef({});
  const activeBillingListenersRef = useRef({});

  const registerBillingListener = useCallback((tabId, listener) => {
    activeBillingListenersRef.current[tabId] = listener;
    if (pendingScansRef.current[tabId]) {
      const code = pendingScansRef.current[tabId];
      delete pendingScansRef.current[tabId];
      setTimeout(() => listener(code), 50);
    }
    return () => {
      delete activeBillingListenersRef.current[tabId];
    };
  }, []);

  const triggerScanAlert = useCallback((alertDetails) => {
    setScanAlert(alertDetails);
  }, []);

  const closeScanAlert = useCallback(() => {
    setScanAlert(null);
  }, []);

  const handleGlobalScan = useCallback((code) => {
    if (!code) return;

    const currentTab = tabs.find(t => t.id === activeTabId);
    const isCurrentlyOnBilling = currentTab && currentTab.path && currentTab.path.startsWith('/billing') && !currentTab.path.startsWith('/billing/list');

    if (isCurrentlyOnBilling) {
      const listener = activeBillingListenersRef.current[activeTabId];
      if (listener) {
        listener(code);
      } else {
        pendingScansRef.current[activeTabId] = code;
      }
    } else {
      const newTabId = `billing-${Date.now()}`;
      pendingScansRef.current[newTabId] = code;
      openTab(`/billing?id=${newTabId}`, 'New Bill');
    }
  }, [tabs, activeTabId, openTab]);

  useBarcodeScanner(handleGlobalScan, {
    enabled: !scanAlert,
    allowInputIds: ['bill-product-search']
  });

  return (
    <BarcodeContext.Provider
      value={{
        scanAlert,
        triggerScanAlert,
        closeScanAlert,
        registerBillingListener
      }}
    >
      {children}
    </BarcodeContext.Provider>
  );
}

export function useBarcode() {
  const context = useContext(BarcodeContext);
  if (!context) {
    throw new Error('useBarcode must be used within a BarcodeProvider');
  }
  return context;
}
