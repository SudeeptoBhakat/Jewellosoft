import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TabContext = createContext(null);

export function TabProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [tabs, setTabs] = useState([
    { id: '/dashboard', title: 'Dashboard', path: '/dashboard', closable: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('/dashboard');

  // Keep a ref of activeTabId to prevent stale closure access in callbacks
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // Sync route changes from React Router into Tab state
  useEffect(() => {
    // Skip public / non-tabbed routes
    if (
      location.pathname === '/login' ||
      location.pathname === '/register' ||
      location.pathname === '/select-template'
    ) {
      return;
    }

    const currentPath = location.pathname + location.search;

    const singletons = {
      '/dashboard': { title: 'Dashboard', closable: false },
      '/billing/list': { title: 'Bills List', closable: true },
      '/orders/list': { title: 'Orders List', closable: true },
      '/inventory': { title: 'Inventory', closable: true },
      '/rates': { title: 'Rates Chart', closable: true },
      '/customers': { title: 'Customers', closable: true },
      '/settings': { title: 'Settings', closable: true },
      '/advances': { title: 'Advance Payments', closable: true }
    };

    setTabs(prevTabs => {
      // 1. Is there an exact match in open tabs?
      const matchedTab = prevTabs.find(t => t.path === currentPath);
      if (matchedTab) {
        if (activeTabIdRef.current !== matchedTab.id) {
          setActiveTabId(matchedTab.id);
        }
        return prevTabs;
      }

      // 2. Is it a multi-instance form (Billing or Orders) without a tab ID in URL?
      if (location.pathname === '/billing' || location.pathname === '/orders') {
        const type = location.pathname.substring(1);
        const title = type === 'billing' ? 'New Bill' : 'New Order';

        const params = new URLSearchParams(location.search);
        const searchId = params.get('id');

        if (searchId) {
          const existingTab = prevTabs.find(t => t.id === searchId);
          if (existingTab) {
            if (activeTabIdRef.current !== existingTab.id) {
              setActiveTabId(existingTab.id);
            }
            return prevTabs;
          }
          const newTab = {
            id: searchId,
            title: title,
            path: currentPath,
            closable: true
          };
          setActiveTabId(searchId);
          return [...prevTabs, newTab];
        } else {
          // No ID in URL: generate a new one
          const tabId = `${type}-${Date.now()}`;
          const existingTypeCount = prevTabs.filter(t => t.id.startsWith(type)).length;
          const displayTitle = existingTypeCount > 0 ? `${title} (${existingTypeCount + 1})` : title;
          const newTab = {
            id: tabId,
            title: displayTitle,
            path: `${location.pathname}?id=${tabId}`,
            closable: true
          };
          setActiveTabId(tabId);
          setTimeout(() => {
            navigate(`${location.pathname}?id=${tabId}`, { replace: true });
          }, 0);
          return [...prevTabs, newTab];
        }
      }

      // 3. Is it a singleton page?
      const details = singletons[location.pathname];
      if (details) {
        const existingTab = prevTabs.find(t => t.id === location.pathname);
        if (existingTab) {
          if (activeTabIdRef.current !== existingTab.id) {
            setActiveTabId(existingTab.id);
          }
          return prevTabs;
        }
        const newTab = {
          id: location.pathname,
          title: details.title,
          path: location.pathname,
          closable: details.closable
        };
        setActiveTabId(newTab.id);
        return [...prevTabs, newTab];
      }

      return prevTabs;
    });

  }, [location.pathname, location.search, navigate]);

  const openTab = (path, title) => {
    const isMultiInstance = path === '/billing' || path === '/orders';
    if (isMultiInstance) {
      const type = path.substring(1);
      const tabId = `${type}-${Date.now()}`;
      
      setTabs(prev => {
        const existingTypeCount = prev.filter(t => t.id.startsWith(type)).length;
        const displayTitle = existingTypeCount > 0 ? `${title} (${existingTypeCount + 1})` : title;
        const newTab = {
          id: tabId,
          title: displayTitle,
          path: `${path}?id=${tabId}`,
          closable: true
        };
        return [...prev, newTab];
      });
      setActiveTabId(tabId);
      navigate(`${path}?id=${tabId}`);
    } else {
      // Singleton tab
      setTabs(prev => {
        const existingTab = prev.find(t => t.id === path);
        if (existingTab) {
          setActiveTabId(existingTab.id);
          setTimeout(() => navigate(existingTab.path), 0);
          return prev;
        } else {
          const newTab = {
            id: path,
            title,
            path,
            closable: path !== '/dashboard'
          };
          setActiveTabId(newTab.id);
          setTimeout(() => navigate(newTab.path), 0);
          return [...prev, newTab];
        }
      });
    }
  };

  const closeTab = (id) => {
    if (id === '/dashboard') return;

    setTabs(prev => {
      const index = prev.findIndex(t => t.id === id);
      if (index === -1) return prev;

      const newTabs = prev.filter(t => t.id !== id);
      
      if (activeTabIdRef.current === id) {
        const nextActiveTab = newTabs[index] || newTabs[index - 1] || newTabs[0];
        setActiveTabId(nextActiveTab.id);
        setTimeout(() => navigate(nextActiveTab.path), 0);
      }
      return newTabs;
    });
  };

  const closeTabAndSwitch = (id, redirectPath, redirectTitle) => {
    setTabs(prev => {
      const nextTabs = prev.filter(t => t.id !== id);
      const existingTarget = nextTabs.find(t => t.id === redirectPath);
      
      if (existingTarget) {
        setActiveTabId(existingTarget.id);
        setTimeout(() => navigate(existingTarget.path), 0);
        return nextTabs;
      } else {
        const newTargetTab = {
          id: redirectPath,
          title: redirectTitle,
          path: redirectPath,
          closable: redirectPath !== '/dashboard'
        };
        setActiveTabId(newTargetTab.id);
        setTimeout(() => navigate(newTargetTab.path), 0);
        return [...nextTabs, newTargetTab];
      }
    });
  };

  return (
    <TabContext.Provider value={{ tabs, activeTabId, openTab, closeTab, closeTabAndSwitch, setActiveTabId }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
}
