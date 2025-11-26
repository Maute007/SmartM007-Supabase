import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Settings, 
  CheckSquare, 
  LogOut, 
  Store,
  Boxes,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

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
    { 
      label: 'Dashboard', 
      href: '/', 
      icon: LayoutDashboard,
      roles: ['admin', 'manager', 'seller'] 
    },
    { 
      label: 'PDV (Vendas)', 
      href: '/pos', 
      icon: ShoppingCart,
      roles: ['admin', 'manager', 'seller'] 
    },
    { 
      label: 'Produtos', 
      href: '/products', 
      icon: Package,
      roles: ['admin', 'manager'] 
    },
    { 
      label: 'Pedidos', 
      href: '/orders', 
      icon: Boxes,
      roles: ['admin', 'manager'] 
    },
    { 
      label: 'Relatórios', 
      href: '/reports', 
      icon: BarChart3,
      roles: ['admin', 'manager'] 
    },
    { 
      label: 'Tarefas', 
      href: '/tasks', 
      icon: CheckSquare,
      roles: ['admin', 'manager', 'seller'] 
    },
    { 
      label: 'Rastreamento', 
      href: '/tracking', 
      icon: FileText,
      roles: ['admin', 'manager'] 
    },
    { 
      label: 'Configurações', 
      href: '/settings', 
      icon: Settings,
      roles: ['admin'] 
    },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen fixed left-0 top-0 z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
          <Store className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-xl tracking-tight text-sidebar-foreground leading-none">
            Mercearia
          </h1>
          <span className="text-xs font-medium text-muted-foreground">Smart System</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = location === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group no-underline",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20 font-medium" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-current" : "text-muted-foreground group-hover:text-current")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-orange-500 flex items-center justify-center ring-2 ring-sidebar-ring/20 text-2xl">
            {user.avatar || '👤'}
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
      </div>
    </aside>
  );
}
