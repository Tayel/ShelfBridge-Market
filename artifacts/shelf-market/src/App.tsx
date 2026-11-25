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
import Offers from '@/pages/offers';
import Start from '@/pages/start';
import Support from '@/pages/support';
import Host from '@/pages/host';
import Saved from '@/pages/saved';
import SignIn from '@/pages/signin';
import { About, Privacy, Terms } from '@/pages/legal';
import { useSession } from '@/lib/store';
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
        <Route path="/host" component={Host} />
        <Route path="/owner" component={Owner} />
        <Route path="/saved" component={Saved} />
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
        <Route path="/offers/:id" component={Offers} />
        <Route path="/start" component={Start} />
        <Route path="/support" component={Support} />
        <Route path="/signin" component={SignIn} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/about" component={About} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

/** Live mode: wait for the first copy of the marketplace from the server before showing pages. */
function LiveGate({ children }: { children: ReactNode }) {
  const s = useSession();
  if (s.loaded && !s.error) return <>{children}</>;
  return (
    <div className="grid min-h-[100dvh] place-items-center px-6 text-center" data-testid="live-gate">
      {s.loaded && s.error
        ? <div><p className="font-display text-2xl font-bold">InRaf can't load right now</p><p className="mt-2 text-muted-foreground">{s.error}</p><button className="mt-5 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground" onClick={() => window.location.reload()}>Try again</button></div>
        : <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-label="Loading" />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <LiveGate><Router /></LiveGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
