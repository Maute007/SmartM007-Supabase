import { useApp } from '@/lib/store';
import { Bell, Search, Menu } from 'lucide-react';
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
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { state, dispatch } = useApp();
  const { notifications, currentUser } = state;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = (id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  };

  if (!currentUser) return null;

  return (
    <header className="h-16 bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-10 px-4 flex items-center justify-between md:justify-end gap-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden md:flex items-center max-w-md w-full mr-auto">
        {/* Global Search Placeholder - functional in future */}
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Buscar produtos, pedidos ou clientes..." 
            className="w-full pl-9 bg-muted/50 border-none focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 bg-destructive rounded-full animate-pulse" />
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
                    className={`p-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${!notif.read ? 'bg-accent/5' : ''}`}
                    onClick={() => handleMarkRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        notif.type === 'warning' ? 'bg-yellow-500' : 
                        notif.type === 'success' ? 'bg-green-500' : 
                        notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                      <div className="space-y-1">
                        <p className={`text-sm leading-tight ${!notif.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {notif.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
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
