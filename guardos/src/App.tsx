import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { seedIfEmpty } from "@/lib/db";

// Seed localStorage with default data on first run (no-op if data already exists)
seedIfEmpty();

const queryClient = new QueryClient();

// Lazy load pages for better performance
const Landing     = lazy(() => import("@/pages/landing"));
const GuardLogin  = lazy(() => import("@/pages/guard/login"));
const GuardLayout = lazy(() => import("@/pages/guard/layout"));
const AdminLogin  = lazy(() => import("@/pages/admin/login"));
const AdminLayout = lazy(() => import("@/pages/admin/layout"));
const ClientLogin = lazy(() => import("@/pages/client/login"));
const ClientLayout = lazy(() => import("@/pages/client/layout"));

function Router() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center text-muted-foreground font-mono">
          Loading GuardOS...
        </div>
      }
    >
      <Switch>
        <Route path="/" component={Landing} />

        {/* Guard Routes */}
        <Route path="/guard/login" component={GuardLogin} />
        <Route path="/guard"       component={GuardLayout} />
        <Route path="/guard/:tab"  component={GuardLayout} />

        {/* Admin Routes */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin"       component={AdminLayout} />
        <Route path="/admin/:tab"  component={AdminLayout} />

        {/* Client Routes */}
        <Route path="/client/login" component={ClientLogin} />
        <Route path="/client"       component={ClientLayout} />
        <Route path="/client/:tab"  component={ClientLayout} />

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter>
          <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
            <div className="flex-1 flex flex-col relative">
              <Router />
            </div>
          </div>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
