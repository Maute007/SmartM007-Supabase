import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { salesApi } from '@/lib/api';
import { Undo2, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

export default function SalesHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmReturnSaleId, setConfirmReturnSaleId] = useState<string | null>(null);

  const { data: sales = [] } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll,
  });

  const { data: returnsLimit } = useQuery({
    queryKey: ['/api/sales/returns/limit'],
    queryFn: async () => {
      const res = await fetch('/api/sales/returns/limit', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao verificar limite');
      return res.json();
    },
  });

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const todaySales = sales.filter(
    (s) => new Date(s.createdAt).toISOString().split('T')[0] === today
  );
  const yesterdaySales = sales.filter(
    (s) => new Date(s.createdAt).toISOString().split('T')[0] === yesterday
  );

  const returnMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const res = await fetch(`/api/sales/${saleId}/return`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || 'Erro ao registar devolução');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/returns/limit'] });
      setConfirmReturnSaleId(null);
      toast({ title: 'Devolução registada', description: 'Estoque foi restaurado.' });
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  const remaining = returnsLimit?.remaining ?? 5;
  const canReturn = remaining > 0;

  const SaleRow = ({
    sale,
    allowReturn,
  }: {
    sale: (typeof sales)[0];
    allowReturn: boolean;
  }) => (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div>
        <p className="font-medium">{format(new Date(sale.createdAt), "HH:mm", { locale: ptBR })}</p>
        <p className="text-sm text-muted-foreground">
          {sale.items.length} itens · {sale.paymentMethod}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-primary">{formatCurrency(parseFloat(sale.total))}</span>
        {allowReturn && (
          <Button
            variant="outline"
            size="sm"
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={() => setConfirmReturnSaleId(sale.id)}
            disabled={!canReturn || returnMutation.isPending}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            Devolução
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Histórico de Vendas</h1>
        <p className="text-muted-foreground">
          Suas vendas de hoje e ontem. Devoluções: {remaining} de 5 disponíveis (por 2 dias)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Hoje ({format(new Date(), "dd/MM/yyyy", { locale: ptBR })})
          </CardTitle>
          <CardDescription>Vendas do dia — pode registar devolução (máx. 5 em 2 dias)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {todaySales.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">Nenhuma venda hoje</p>
          ) : (
            todaySales.map((s) => <SaleRow key={s.id} sale={s} allowReturn={true} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ontem</CardTitle>
          <CardDescription>Visualização apenas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {yesterdaySales.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">Nenhuma venda ontem</p>
          ) : (
            yesterdaySales.map((s) => <SaleRow key={s.id} sale={s} allowReturn={false} />)
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmReturnSaleId} onOpenChange={() => setConfirmReturnSaleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registar devolução?</AlertDialogTitle>
            <AlertDialogDescription>
              O estoque dos produtos será restaurado. Esta ação fica registada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmReturnSaleId && returnMutation.mutate(confirmReturnSaleId)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Confirmar devolução
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
