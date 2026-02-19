import { useAuth } from '@/lib/auth';
import { Bell, Search, Menu, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    enabled: !!user
  });

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => !n.read && (n.type === 'warning' || n.type === 'error')).length;

  const handleMarkRead = (id: string) => {
    markAsReadMutation.mutate(id);
    setTimeout(() => {
      notificationsApi.delete(id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }).catch(e => console.error("Delete notification error:", e));
    }, 5000);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  if (!user) return null;

  return (
    <header className="h-16 bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-10 px-4 flex items-center justify-between gap-4">
      <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden md:flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Buscar produtos, pedidos ou clientes..." 
            className="w-full pl-9 bg-muted/50 border-none focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative hover:bg-accent hover:text-accent-foreground transition-colors" 
              data-testid="button-notifications"
            >
              <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'text-red-600 animate-bounce' : ''}`} />
              {unreadCount > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full animate-pulse flex items-center justify-center text-[10px] font-bold text-white ${
                  criticalCount > 0 ? 'bg-red-600 shadow-lg shadow-red-600/50' : 'bg-destructive'
                }`} data-testid="badge-unread">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuLabel className="px-4 py-3 border-b border-border">Notificações</DropdownMenuLabel>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    data-testid={`notification-${notif.id}`}
                    className={`p-3 border-b border-border last:border-0 hover:bg-muted/50 transition-all cursor-pointer ${
                      !notif.read ? (
                        notif.type === 'warning' ? 'bg-red-50 border-l-4 border-l-red-500 animate-pulse' :
                        notif.type === 'error' ? 'bg-red-50 border-l-4 border-l-red-500 animate-pulse' :
                        'bg-accent/10'
                      ) : ''
                    }`}
                    onClick={() => handleMarkRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className={`text-sm leading-tight ${
                          !notif.read ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        } ${
                          notif.type === 'warning' || notif.type === 'error' ? 'font-bold' : ''
                        }`}>
                          {notif.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                          notif.type === 'warning' ? 'bg-red-500' : 
                          notif.type === 'success' ? 'bg-green-500' : 
                          notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
