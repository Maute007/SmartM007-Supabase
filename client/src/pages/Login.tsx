import { useApp } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Store, UserCircle2, UserCog, ShoppingBag } from 'lucide-react';

export default function Login() {
  const { state, login } = useApp();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    if (selectedUser) {
      login(selectedUser);
      setLocation('/');
    }
  };

  // If already logged in, redirect
  if (state.currentUser) {
    setLocation('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-primary/10">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 transform rotate-3">
            <Store className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-heading font-bold text-primary">Mercearia Smart</CardTitle>
            <CardDescription className="text-lg">Sistema de Gestão Inteligente</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground pl-1">Selecione seu perfil</label>
            <Select onValueChange={setSelectedUser} value={selectedUser}>
              <SelectTrigger className="h-12 text-base bg-muted/30 border-primary/20 focus:ring-primary">
                <SelectValue placeholder="Quem é você?" />
              </SelectTrigger>
              <SelectContent>
                {state.users.map((user) => (
                  <SelectItem key={user.id} value={user.id} className="py-3">
                    <div className="flex items-center gap-3">
                      {user.role === 'admin' && <UserCog className="h-5 w-5 text-primary" />}
                      {user.role === 'manager' && <UserCircle2 className="h-5 w-5 text-blue-500" />}
                      {user.role === 'seller' && <ShoppingBag className="h-5 w-5 text-orange-500" />}
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {user.role === 'manager' ? 'Gestor' : user.role === 'seller' ? 'Vendedor' : 'Administrador'}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]" 
            onClick={handleLogin}
            disabled={!selectedUser}
          >
            Entrar no Sistema
          </Button>
          
          <div className="text-center text-xs text-muted-foreground pt-4">
            &copy; 2025 Mercearia Smart Inc.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
