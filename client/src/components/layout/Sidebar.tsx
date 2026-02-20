import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Settings, 
  CheckSquare, 
  LogOut, 
  Boxes,
  FileText,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Logo } from '@/components/Logo';

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  const collapsed = controlledCollapsed ?? internalCollapsed;
  
  const toggleCollapsed = () => {
    const newValue = !collapsed;
    setInternalCollapsed(newValue);
    localStorage.setItem('sidebar-collapsed', String(newValue));
    onCollapsedChange?.(newValue);
  };

  if (!user) return null;

  const role = user.role;
  
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      setLocation('/login');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer logout",
        description: error.message,
      });
    }
  };

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'manager'] as const },
    { label: 'PDV (Vendas)', href: '/pos', icon: ShoppingCart, roles: ['admin', 'manager', 'seller'] as const },
    { label: 'Histórico', href: '/sales-history', icon: FileText, roles: ['seller'] as const },
    { label: 'Produtos', href: '/products', icon: Package, roles: ['admin', 'manager'] as const },
    { label: 'Pedidos', href: '/orders', icon: Boxes, roles: ['admin', 'manager'] as const },
    { label: 'Relatórios', href: '/reports', icon: BarChart3, roles: ['admin', 'manager'] as const },
    { label: 'Tarefas', href: '/tasks', icon: CheckSquare, roles: ['admin', 'manager', 'seller'] as const },
    { label: 'Rastreamento', href: '/tracking', icon: History, roles: ['admin', 'manager'] as const },
    { label: 'Configurações', href: '/settings', icon: Settings, roles: ['admin'] as const },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className={cn(
      "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border h-screen fixed left-0 top-0 z-20 transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className={cn("p-4 flex items-center", collapsed ? "justify-center" : "px-4")}>
        <Logo variant={collapsed ? "sidebar-collapsed" : "sidebar"} className="shrink-0" />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapsed}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar shadow-md z-30"
        data-testid="button-toggle-sidebar"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto", collapsed ? "px-2" : "px-4")}>
        {filteredNav.map((item) => {
          const isActive = location === item.href;
          
          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center p-2.5 rounded-md transition-all duration-200 group no-underline",
                      isActive 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive ? "text-current" : "text-muted-foreground group-hover:text-current")} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 group no-underline hover:translate-x-1",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20 font-medium" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-current" : "text-muted-foreground group-hover:text-current")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("p-4 border-t border-sidebar-border bg-sidebar/50 backdrop-blur-sm", collapsed && "px-2")}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-orange-500 flex items-center justify-center ring-2 ring-sidebar-ring/20 text-lg shrink-0">
                {user.avatar || user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">
                  {user.role === 'manager' ? 'Gestor' : user.role === 'seller' ? 'Vendedor' : 'Admin'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              data-testid="button-logout"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                data-testid="button-logout"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  return { collapsed, setCollapsed };
}
