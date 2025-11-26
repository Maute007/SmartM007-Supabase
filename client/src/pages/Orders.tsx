import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Check, X, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Order {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  items: any[];
  total: string;
  status: 'pending' | 'approved' | 'cancelled';
  createdAt: Date;
  approvedAt?: Date;
}

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: async () => {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao buscar pedidos');
      return res.json();
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/approve`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erro ao aprovar pedido');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Sucesso', description: 'Pedido aprovado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erro ao cancelar pedido');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Sucesso', description: 'Pedido cancelado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const getStatusColor = (status: string, hasOverstock: boolean) => {
    if (hasOverstock) return 'bg-red-100 text-red-800';
    if (status === 'approved') return 'bg-green-100 text-green-800';
    if (status === 'cancelled') return 'bg-gray-100 text-gray-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const pendingOrders = orders.filter((o: Order) => o.status === 'pending');
  const approvedOrders = orders.filter((o: Order) => o.status === 'approved');
  const cancelledOrders = orders.filter((o: Order) => o.status === 'cancelled');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gerenciar Pedidos</h1>
        <p className="text-muted-foreground">Aprovar, revisar e acompanhar pedidos dos clientes</p>
      </div>

      {/* Pedidos Pendentes */}
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            Pedidos Pendentes ({pendingOrders.length})
          </CardTitle>
          <CardDescription>Aguardando sua aprovação</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingOrders.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido pendente</p>
          ) : (
            <div className="space-y-4">
              {pendingOrders.map((order: Order) => {
                const hasOverstock = order.items.some((item: any) => item.quantity > 100); // Simplified check
                return (
                  <div key={order.id} className={`p-4 rounded-lg border-2 ${getStatusColor(order.status, hasOverstock)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg">{order.orderCode}</p>
                          {hasOverstock && (
                            <Badge className="bg-red-500 text-white">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Estoque Insuficiente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{formatCurrency(parseFloat(order.total))}</p>
                        <p className="text-xs text-muted-foreground">{order.items.length} itens</p>
                      </div>
                    </div>
                    <div className="mb-3 space-y-1">
                      {order.items.map((item: any, idx: number) => (
                        <p key={idx} className="text-sm">• Produto ID: {item.productId} - {item.quantity}x {formatCurrency(item.priceAtSale)}</p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveMutation.mutate(order.id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => cancelMutation.mutate(order.id)}
                        disabled={cancelMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos Aprovados */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Pedidos Aprovados ({approvedOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedOrders.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido aprovado</p>
          ) : (
            <div className="space-y-2">
              {approvedOrders.map((order: Order) => (
                <div key={order.id} className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold">{order.orderCode} - {order.customerName}</span>
                    <span className="font-bold text-green-600">{formatCurrency(parseFloat(order.total))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos Cancelados */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <X className="h-5 w-5 text-gray-600" />
            Pedidos Cancelados ({cancelledOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cancelledOrders.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido cancelado</p>
          ) : (
            <div className="space-y-2">
              {cancelledOrders.map((order: Order) => (
                <div key={order.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-600">{order.orderCode} - {order.customerName}</span>
                    <span className="text-gray-500">{formatCurrency(parseFloat(order.total))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
