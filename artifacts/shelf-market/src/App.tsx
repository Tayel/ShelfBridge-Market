import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import Owner from '@/pages/owner';
import Explore from '@/pages/explore';
import ShopDetail from '@/pages/shop-detail';
import Stock from '@/pages/stock';
import Dashboard from '@/pages/dashboard';
import OwnerDashboard from '@/pages/owner-dashboard';
import ShopSettings from '@/pages/shop-settings';
import ContractPage from '@/pages/contract';
import ShelfPage from '@/pages/shelf';
import ProductForm from '@/pages/product-form';
import Catalog from '@/pages/catalog';
import Scan from '@/pages/scan';
import { OrdersList, Receipt } from '@/pages/orders';
import Admin from '@/pages/admin';
import Notifications from '@/pages/notifications';
import Guide from '@/pages/guide';
import Support from '@/pages/support';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/owner" component={Owner} />
        <Route path="/explore" component={Explore} />
        <Route path="/explore/:id" component={ShopDetail} />
        <Route path="/stock/:tokenId" component={Stock} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/owner-dashboard" component={OwnerDashboard} />
        <Route path="/owner-dashboard/shops/:id" component={ShopSettings} />
        <Route path="/contracts/:id" component={ContractPage} />
        <Route path="/shelf/:tokenId" component={ShelfPage} />
        <Route path="/shelf/:tokenId/new" component={ProductForm} />
        <Route path="/products/:id/edit" component={ProductForm} />
        <Route path="/catalog/:tokenId" component={Catalog} />
        <Route path="/scan" component={Scan} />
        <Route path="/orders" component={OrdersList} />
        <Route path="/orders/:id" component={Receipt} />
        <Route path="/admin" component={Admin} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/guide" component={Guide} />
        <Route path="/support" component={Support} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
