import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

export default function Login() {
  const { user, login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-dvh min-h-screen bg-gradient-to-br from-emerald-500/20 via-orange-500/10 to-emerald-500/20 flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden animate-fade-in">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-400/15 rounded-full blur-3xl animate-glow-pulse animation-delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-300/10 rounded-full blur-3xl animate-float" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-emerald-200/80 overflow-hidden relative animate-scale-in hover-lift hover-glow transition-smooth">
        <CardHeader className="text-center pt-8 pb-4 sm:pt-10 sm:pb-6 px-6">
          <div className="flex justify-center px-4 py-6 sm:py-8 rounded-2xl bg-background/80">
            <Logo variant="hero" className="animate-float" />
          </div>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl font-semibold text-center text-foreground">
            Sistema de Gestão e Vendas
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-8">
          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            <div className="space-y-2 transition-transform duration-300 hover:translate-x-0.5">
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
                  className="pl-10 h-12 text-base bg-muted/30 border-emerald-200 focus:ring-emerald-500 transition-all duration-300 focus:shadow-md"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2 transition-transform duration-300 hover:translate-x-0.5">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-11 h-12 text-base bg-muted/30 border-emerald-200 focus:ring-emerald-500 transition-all duration-300 focus:shadow-md"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button 
              type="submit"
              data-testid="button-login"
              className="w-full h-12 text-lg font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/30 active:scale-[0.99] hover:-translate-y-0.5" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Entrando...' : 'Entrar no Sistema'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setLocation('/pedidos')}
              variant="outline"
              className="w-full h-12 text-base font-medium border-2 border-orange-300 text-orange-600 hover:bg-orange-50 transition-all duration-300 hover:scale-[1.01] hover:border-orange-400 active:scale-[0.99]"
            >
              🛒 Fazer Pedido Online (Clientes)
            </Button>

            <p className="text-center text-xs text-muted-foreground pt-4">
              &copy; 2025 Maute360 — Soluções em Negócios
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
