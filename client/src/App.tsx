import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Reports from "@/pages/Reports";
import Tasks from "@/pages/Tasks";
import SettingsPage from "@/pages/Settings";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { useEffect, useState } from "react";

function Router() {
  const { isLoading } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    // Check if system needs setup (no auth users available)
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.status === 401) {
          // Try to check if DB is empty by attempting to initialize
          const setupCheck = await fetch('/api/admin/check-empty', { method: 'GET' });
          if (setupCheck.ok) {
            const data = await setupCheck.json();
            setNeedsSetup(data.isEmpty);
          }
        }
      } catch {
        // Continue normally if check fails
      }
    };
    
    if (!isLoading) {
      checkSetup();
    }
  }, [isLoading]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (needsSetup) {
    return <Setup />;
  }

  return (
    <Switch>
      <Route path="/setup" component={Setup} />
      <Route path="/login" component={Login} />
      
      {/* Protected Routes wrapped in MainLayout */}
      <Route path="/">
        <MainLayout><Dashboard /></MainLayout>
      </Route>
      <Route path="/pos">
        <MainLayout><POS /></MainLayout>
      </Route>
      <Route path="/products">
        <MainLayout><Products /></MainLayout>
      </Route>
      <Route path="/reports">
        <MainLayout><Reports /></MainLayout>
      </Route>
      <Route path="/tasks">
        <MainLayout><Tasks /></MainLayout>
      </Route>
      <Route path="/settings">
        <MainLayout><SettingsPage /></MainLayout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
