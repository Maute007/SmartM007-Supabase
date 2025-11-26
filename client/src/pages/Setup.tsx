import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export default function Setup() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { toast } = useToast();

  const handleInitialize = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/force-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Falha ao inicializar');
      }

      const data = await response.json();
      toast({
        title: '✅ Sucesso!',
        description: data.message,
        variant: 'default'
      });
      
      setIsDone(true);
      
      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      toast({
        title: '❌ Erro',
        description: error instanceof Error ? error.message : 'Erro ao inicializar banco de dados',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-orange-50 p-4">
      <Card className="w-full max-w-md border-emerald-200 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-700">🎉 Bem-vindo!</CardTitle>
          <CardDescription>Sistema de Vendas - Mercearia Smart</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isDone ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="text-blue-900 font-semibold mb-2">⚙️ Primeira Inicialização</p>
                <p className="text-blue-800 text-xs">
                  O banco de dados precisa ser inicializado com usuários e produtos padrão. Clique no botão abaixo para começar.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs">
                <p className="text-emerald-900 font-semibold mb-2">📋 Credenciais Padrão:</p>
                <ul className="text-emerald-800 space-y-1">
                  <li>👨‍💼 <strong>Admin:</strong> admin / senha123</li>
                  <li>👨‍💻 <strong>Vendedor:</strong> joao / senha123</li>
                  <li>👩‍💼 <strong>Gerente:</strong> maria / senha123</li>
                </ul>
              </div>

              <Button 
                onClick={handleInitialize}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 rounded-lg"
                data-testid="button-initialize-database"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inicializando...
                  </>
                ) : (
                  '🚀 Inicializar Sistema'
                )}
              </Button>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <p className="text-emerald-700 font-semibold">Banco de dados inicializado!</p>
              <p className="text-sm text-gray-600">Redirecionando para login...</p>
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-emerald-600" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
