import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { Layout } from './components/layout/Layout';
import { NavItemKey } from './components/layout/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { fetchOrdersDirect, handleShopeeCallbackDirect, handleTikTokCallbackDirect } from './lib/wordpressBridge';
import { Order, AuditLog } from './types';
import { Loader2 } from 'lucide-react';

// Lazy-loaded routes for ultra-fast initial chunk delivery
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const OrdersView = React.lazy(() => import('./components/orders/OrdersView').then(m => ({ default: m.OrdersView })));
const ConfiguratorStudioPage = React.lazy(() => import('./pages/ConfiguratorStudioPage').then(m => ({ default: m.ConfiguratorStudioPage })));
const MaterialsStockPage = React.lazy(() => import('./pages/MaterialsStockPage').then(m => ({ default: m.MaterialsStockPage })));
const ReviewsPage = React.lazy(() => import('./pages/ReviewsPage').then(m => ({ default: m.ReviewsPage })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const EmailTemplatesPage = React.lazy(() => import('./pages/EmailTemplatesPage').then(m => ({ default: m.EmailTemplatesPage })));
const AiToolsPage = React.lazy(() => import('./pages/AiToolsPage').then(m => ({ default: m.AiToolsPage })));
const TeamRolesManager = React.lazy(() => import('./components/settings/TeamRolesManager').then(m => ({ default: m.TeamRolesManager })));
const TestingSandboxPage = React.lazy(() => import('./pages/TestingSandboxPage').then(m => ({ default: m.TestingSandboxPage })));
const SystemHealthPage = React.lazy(() => import('./pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const AuditLogsPage = React.lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const RmaClaimsPage = React.lazy(() => import('./pages/RmaClaimsPage').then(m => ({ default: m.RmaClaimsPage })));
const ExportShipmentsPage = React.lazy(() => import('./pages/ExportShipmentsPage').then(m => ({ default: m.ExportShipmentsPage })));
const TrackingPoolPage = React.lazy(() => import('./pages/TrackingPoolPage').then(m => ({ default: m.TrackingPoolPage })));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })));

const getTabFromUrl = (): NavItemKey => {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const key = path || hash;

  const urlMap: Record<string, NavItemKey> = {
    '': 'dashboard',
    'dashboard': 'dashboard',
    'orders': 'orders',
    'order': 'orders',
    'fulfillment': 'orders',
    'products': 'products',
    'product': 'products',
    'catalog': 'products',
    'shopee-products': 'products',
    'tiktok-products': 'products',
    'configurator': 'configurator',
    'configurator-studio': 'configurator',
    'studio': 'configurator',
    'devices': 'configurator',
    'skins': 'configurator',
    'materials': 'materials',
    'material': 'materials',
    'stock': 'materials',
    'finishes': 'materials',
    'reviews': 'reviews',
    'review': 'reviews',
    'reports': 'reports',
    'sales': 'reports',
    'analytics': 'reports',
    'ai_tools': 'ai_tools',
    'ai-tools': 'ai_tools',
    'ai': 'ai_tools',
    'emails': 'emails',
    'email': 'emails',
    'templates': 'emails',
    'team': 'team',
    'roles': 'team',
    'users': 'team',
    'testing': 'testing',
    'sandbox': 'testing',
    'health': 'health',
    'system': 'health',
    'audit': 'audit',
    'logs': 'audit',
    'rma': 'rma',
    'rma-claims': 'rma',
    'warranty': 'rma',
    'warranty-claims': 'rma',
    'warranties': 'rma',
    'claims': 'rma',
    'export': 'export',
    'exports': 'export',
    'export-shipments': 'export',
    'tracking': 'tracking_pool',
    'tracking-pool': 'tracking_pool',
    'tracking_pool': 'tracking_pool',
    'settings': 'settings',
    'config': 'settings',
  };

  return urlMap[key] || 'dashboard';

};

const SHOP_MANAGER_ALLOWED_TABS: NavItemKey[] = ['orders', 'reviews', 'rma', 'warranty', 'export', 'tracking_pool'];

export const App: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();

  const isShopManager = user?.role === 'shop_manager';
  const [currentTab, setCurrentTab] = useState<NavItemKey>(() => {
    const tabFromUrl = getTabFromUrl();
    return tabFromUrl;
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep shop_manager strictly locked to orders, rma claims, export, and tracking pool
  useEffect(() => {
    if (isShopManager && !SHOP_MANAGER_ALLOWED_TABS.includes(currentTab)) {
      setCurrentTab('orders');
      if (window.location.hash !== '#orders') {
        window.history.replaceState(null, '', '#orders');
      }
    }
  }, [isShopManager, currentTab]);

  // Sync tab with URL hash
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromUrl();
      if (user?.role === 'shop_manager' && !SHOP_MANAGER_ALLOWED_TABS.includes(tab)) {
        setCurrentTab('orders');
        return;
      }
      setCurrentTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [user?.role]);

  // Listen for marketplace OAuth callback params (?code=...&shop_id=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const shopId = params.get('shop_id');
    const authCode = params.get('auth_code');
    const path = window.location.pathname.toLowerCase();

    if (code) {
      if (shopId || path.includes('shopee')) {
        handleShopeeCallbackDirect(code, Number(shopId) || 0).then((res) => {
          if (res.success) {
            showToast('success', 'Shopee Connected', 'Shopee store connected successfully!');
            window.history.replaceState({}, document.title, window.location.pathname + '#orders');
            setCurrentTab('orders');
          } else {
            showToast('error', 'Shopee Authorization Failed', res.error || 'Failed to authorize Shopee store');
          }
        });
      } else {
        handleTikTokCallbackDirect(code, shopId || undefined, authCode || undefined).then((res) => {
          if (res.success) {
            showToast('success', 'TikTok Connected', 'TikTok Shop connected successfully!');
            window.history.replaceState({}, document.title, window.location.pathname + '#orders');
            setCurrentTab('orders');
          } else {
            showToast('error', 'TikTok Authorization Failed', res.error || 'Failed to authorize TikTok Shop');
          }
        });
      }
    }
  }, [showToast]);

  const handleTabChange = useCallback((tab: NavItemKey) => {
    if (user?.role === 'shop_manager' && !SHOP_MANAGER_ALLOWED_TABS.includes(tab)) {
      return;
    }
    setCurrentTab(tab);
    window.location.hash = `#${tab}`;
  }, [user?.role]);

  // Load store orders and audit logs
  const loadWorkspaceData = useCallback(async (quiet = false) => {
    if (!user) return;
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const ordersRes = await fetchOrdersDirect({ per_page: 50 });
      if (ordersRes.success) {
        setOrders(ordersRes.orders);
      }
    } catch (err: any) {
      console.warn('Workspace data sync error:', err);
      if (!quiet) {
        showToast('warning', 'Data Sync Warning', 'Could not sync live store data.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (user) {
      loadWorkspaceData();
    }
  }, [user, loadWorkspaceData]);

  // Auth Loading
  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#080808] text-white">
        <Loader2 className="w-8 h-8 text-[#f3aa18] animate-spin mb-4" />
        <p className="text-xs font-mono text-zinc-400">Loading Exacoat ERP...</p>
      </div>
    );
  }

  // Not logged in -> LoginPage
  if (!user) {
    return <LoginPage />;
  }

  const processingCount = orders.filter(
    o => String(o.status).replace(/^wc-/, '') === 'processing'
  ).length;

  const handleSelectOrder = (order: Order) => {
    handleTabChange('orders');
  };

  const renderActiveTab = () => {
    if (user?.role === 'shop_manager') {
      if (currentTab === 'reviews') {
        return <ReviewsPage />;
      }
      if (currentTab === 'rma' || currentTab === 'warranty') {
        return <RmaClaimsPage />;
      }
      if (currentTab === 'export') {
        return <ExportShipmentsPage />;
      }
      if (currentTab === 'tracking_pool') {
        return <TrackingPoolPage />;
      }
      return <OrdersView initialStatus="all" />;
    }
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardPage
            orders={orders}
            onNavigate={handleTabChange}
            onSelectOrder={handleSelectOrder}
            onRefresh={() => loadWorkspaceData(true)}
            isLoading={isLoading}
          />
        );
      case 'orders':
        return <OrdersView initialStatus="all" />;
      case 'rma':
      case 'warranty':
        return <RmaClaimsPage />;
      case 'export':
        return <ExportShipmentsPage />;
      case 'tracking_pool':
        return <TrackingPoolPage />;
      case 'products':
        return <ProductsPage />;
      case 'configurator':
        return <ConfiguratorStudioPage />;
      case 'materials':
        return <MaterialsStockPage />;

      case 'reviews':
        return <ReviewsPage />;
      case 'reports':
        return <ReportsPage onNavigate={(tab) => handleTabChange(tab as NavItemKey)} />;
      case 'emails':
        return <EmailTemplatesPage />;
      case 'ai_tools':
        return <AiToolsPage />;
      case 'team':
        return <TeamRolesManager />;
      case 'testing':
        return (
          <TestingSandboxPage
            onRefreshData={() => loadWorkspaceData(true)}
            onNavigate={handleTabChange}
          />
        );
      case 'health':
        return <SystemHealthPage />;
      case 'audit':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            orders={orders}
            onNavigate={handleTabChange}
            onSelectOrder={handleSelectOrder}
            onRefresh={() => loadWorkspaceData(true)}
            isLoading={isLoading}
          />
        );
    }
  };

  return (
    <Layout
      currentTab={currentTab}
      onTabChange={handleTabChange}
      onRefreshData={() => loadWorkspaceData(true)}
      isRefreshing={isRefreshing}
      pendingOrdersCount={processingCount}
      pendingReviewsCount={0}
    >
      <React.Suspense
        fallback={
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#f3aa18]" />
            <p className="text-xs font-mono text-zinc-500">Loading module...</p>
          </div>
        }
      >
        {renderActiveTab()}
      </React.Suspense>
    </Layout>
  );
};
export default App;
