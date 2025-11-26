import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, Lock, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Login() {
  const { user, login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, preencha usuário e senha.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username, password);
      toast({
        title: "Login realizado!",
        description: "Bem-vindo ao sistema.",
      });
      setLocation('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: error.message || "Usuário ou senha incorretos.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already logged in, redirect
  if (user && !isLoading) {
    setLocation('/');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500/20 via-orange-500/10 to-emerald-500/20 flex items-center justify-center">
        <div className="animate-pulse text-xl text-primary">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500/20 via-orange-500/10 to-emerald-500/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-emerald-200">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 transform rotate-3">
            <Store className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-heading font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
              M007System
            </CardTitle>
            <CardDescription className="text-lg">Sistema de Vendas Inteligente</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-muted-foreground">
                Usuário
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-12 text-base bg-muted/30 border-emerald-200 focus:ring-emerald-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12 text-base bg-muted/30 border-emerald-200 focus:ring-emerald-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button 
              type="submit"
              data-testid="button-login"
              className="w-full h-12 text-lg font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Entrando...' : 'Entrar no Sistema'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setLocation('/pedidos')}
              variant="outline"
              className="w-full h-12 text-base font-medium border-2 border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              🛒 Fazer Pedido Online (Clientes)
            </Button>

            <div className="text-center text-xs text-muted-foreground pt-6">
              &copy; 2025 M007System - Sistema Inteligente de Vendas
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
