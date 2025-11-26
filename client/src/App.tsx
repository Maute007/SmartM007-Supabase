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
import ClientOrders from "@/pages/ClientOrders";
import Orders from "@/pages/Orders";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";

function Router() {
  return (
    <Switch>
      <Route path="/setup" component={Setup} />
      <Route path="/login" component={Login} />
      <Route path="/pedidos" component={ClientOrders} />
      
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
      <Route path="/orders">
        <MainLayout><Orders /></MainLayout>
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
