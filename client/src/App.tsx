import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Reports from "@/pages/Reports";
import Tasks from "@/pages/Tasks";
import { MainLayout } from "@/components/layout/MainLayout";
import { AppProvider } from "@/lib/store";

function Router() {
  return (
    <Switch>
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
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
