/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useTabs } from '../../contexts/TabContext';

// Import all page components
import Dashboard from '../../features/dashboard/Dashboard';
import Billing from '../../features/billing/Billing';
import BillsList from '../../features/billing/BillsList';
import Orders from '../../features/orders/Orders';
import OrdersList from '../../features/orders/OrdersList';
import Inventory from '../../features/inventory/Inventory';
import RateChart from '../../features/rates/RateChart';
import Customers from '../../features/customers/Customers';
import Settings from '../../features/settings/Settings';
import Advances from '../../features/advances/Advances';
import DuesCreditsList from '../../features/dashboard/DuesCreditsList';


export default function MainLayout() {
  const { tabs, activeTabId, openTab, closeTab, setActiveTabId } = useTabs();
  const navigate = useNavigate();

  const getTabIcon = (path) => {
    const p = path.split('?')[0];
    switch (p) {
      case '/dashboard': return 'fa-solid fa-chart-pie';
      case '/billing': return 'fa-solid fa-file-invoice-dollar';
      case '/billing/list': return 'fa-solid fa-receipt';
      case '/orders': return 'fa-solid fa-box';
      case '/orders/list': return 'fa-solid fa-clipboard-list';
      case '/inventory': return 'fa-solid fa-warehouse';
      case '/rates': return 'fa-solid fa-coins';
      case '/customers': return 'fa-solid fa-users';
      case '/settings': return 'fa-solid fa-gear';
      case '/advances': return 'fa-solid fa-hand-holding-dollar';
      case '/dues-credits': return 'fa-solid fa-scale-balanced';
      default: return 'fa-solid fa-file';
    }
  };


  const renderTabContent = (tab, isActive) => {
    const path = tab.path.split('?')[0];
    const props = { tabId: tab.id, isActive };

    switch (path) {
      case '/dashboard': return <Dashboard {...props} />;
      case '/billing': return <Billing {...props} />;
      case '/billing/list': return <BillsList {...props} />;
      case '/orders': return <Orders {...props} />;
      case '/orders/list': return <OrdersList {...props} />;
      case '/inventory': return <Inventory {...props} />;
      case '/rates': return <RateChart {...props} />;
      case '/customers': return <Customers {...props} />;
      case '/settings': return <Settings {...props} />;
      case '/advances': return <Advances {...props} />;
      case '/dues-credits': return <DuesCreditsList {...props} />;
      default: return <div>Page not found: {path}</div>;
    }
  };


  return (
    <div className="app-layout">
      <div className="app-layout__sidebar">
        <Sidebar />
      </div>
      <div className="app-layout__main">
        {/* Chrome-like Tab Bar */}
        <div className="chrome-tab-bar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`chrome-tab ${tab.id === activeTabId ? 'chrome-tab--active' : ''}`}
              onClick={() => {
                setActiveTabId(tab.id);
                navigate(tab.path);
              }}
            >
              <i className={`chrome-tab__icon ${getTabIcon(tab.path)}`}></i>
              <span className="chrome-tab__title">{tab.title}</span>
              {tab.closable && (
                <button
                  className="chrome-tab__close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          ))}
          <button
            className="chrome-tab__add"
            title="Start New Bill"
            onClick={() => openTab('/billing', 'New Bill')}
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>

        <Navbar />

        <main className="app-layout__content">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="tab-content-container"
              style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
            >
              {renderTabContent(tab, tab.id === activeTabId)}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}

