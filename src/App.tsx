import React, { useState } from 'react';
import { Layout } from './components/layout/Layout';
import { NavigationTab } from './components/layout/Sidebar';
import { OrdersView } from './components/orders/OrdersView';
import { CustomersView } from './components/customers/CustomersView';
import { ProductsConfiguratorView } from './components/products/ProductsConfiguratorView';
import { DashboardView } from './components/dashboard/DashboardView';
import { HealthView } from './components/health/HealthView';
import { ToastProvider } from './context/ToastContext';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('orders');
  const [globalSearch, setGlobalSearch] = useState('');

  return (
    <ToastProvider>
      <Layout
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        globalSearch={globalSearch}
        onSearchChange={setGlobalSearch}
      >
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigateToOrders={() => setCurrentTab('orders')}
            onNavigateToConfigurator={() => setCurrentTab('configurator')}
          />
        )}
        {currentTab === 'orders' && <OrdersView searchFilter={globalSearch} />}
        {currentTab === 'customers' && <CustomersView />}
        {currentTab === 'configurator' && <ProductsConfiguratorView />}
        {currentTab === 'health' && <HealthView />}
      </Layout>
    </ToastProvider>
  );
};

export default App;
