import { ReactNode, useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { Header } from './Header';
import { useAuth } from '@/lib/auth';
import { Redirect, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

const SELLER_ALLOWED = ['/pos', '/sales-history', '/tasks'];

export function MainLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  useWebSocket(!!user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      setSidebarCollapsed(saved === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30 flex flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xl text-primary font-medium animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role === 'seller' && !SELLER_ALLOWED.includes(location)) {
    return <Redirect to="/pos" />;
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      <Sidebar onCollapsedChange={setSidebarCollapsed} />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      <main className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300",
        sidebarCollapsed ? "md:ml-16" : "md:ml-64"
      )}>
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <div className="flex-1 p-4 md:p-6 overflow-y-auto h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto animate-slide-up">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
