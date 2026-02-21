import { useAuth } from '@/lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { format, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { salesApi, productsApi, receiptsApi } from '@/lib/api';
import { Undo2, Calendar, Filter, ChevronLeft, ChevronRight, Receipt, FileText, Download } from 'lucide-react';
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
import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ITEMS_PER_PAGE = 10;

export default function SalesHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmReturnSaleId, setConfirmReturnSaleId] = useState<string | null>(null);
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [filterDateTo, setFilterDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [filterHourFrom, setFilterHourFrom] = useState('');
  const [filterHourTo, setFilterHourTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: sales = [] } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll,
  });

  const { data: returnsLimit } = useQuery({
    queryKey: ['/api/sales/returns/limit'],
    queryFn: async () => {
      const res = await fetch('/api/sales/returns/limit', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao verificar limite');
      return res.json();
    },
  });

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const filteredSales = useMemo(() => {
    let result = [...sales];
    const fromDate = filterDateFrom ? startOfDay(new Date(filterDateFrom)).getTime() : 0;
    const toDate = filterDateTo ? startOfDay(new Date(filterDateTo)).getTime() + 86400000 : Infinity;
    result = result.filter((s) => {
      const d = new Date(s.createdAt).getTime();
      if (d < fromDate || d > toDate) return false;
      if (filterProduct !== 'all') {
        const hasProduct = s.items?.some((i: any) => i.productId === filterProduct);
        if (!hasProduct) return false;
      }
      if (filterHourFrom) {
        const h = new Date(s.createdAt).getHours();
        const [fh] = filterHourFrom.split(':').map(Number);
        if (h < fh) return false;
      }
      if (filterHourTo) {
        const h = new Date(s.createdAt).getHours();
        const [th] = filterHourTo.split(':').map(Number);
        if (h > th) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTotal = formatCurrency(parseFloat(s.total)).toLowerCase().includes(q);
        const matchTime = format(new Date(s.createdAt), 'HH:mm', { locale: ptBR }).includes(q);
        const matchItems = s.items?.some((i: any) => {
          const p = products.find((pr) => pr.id === i.productId);
          return p?.name?.toLowerCase().includes(q);
        });
        if (!matchTotal && !matchTime && !matchItems) return false;
      }
      return true;
    });
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales, filterDateFrom, filterDateTo, filterProduct, filterHourFrom, filterHourTo, searchQuery, products]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, currentPage]);

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

  const SaleCard = ({
    sale,
    allowReturn,
  }: {
    sale: (typeof sales)[0];
    allowReturn: boolean;
  }) => {
    const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
    const isToday = saleDate === today;
    const isYesterday = saleDate === yesterday;
    const dateLabel = isToday ? 'Hoje' : isYesterday ? 'Ontem' : format(new Date(sale.createdAt), "dd/MM/yyyy", { locale: ptBR });
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-white to-muted/20 p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {format(new Date(sale.createdAt), "HH:mm", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground">
                {sale.items?.length ?? 0} itens · {dateLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {sale.paymentMethod}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={receiptsApi.getFileUrl(sale.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/10">
                <FileText className="h-4 w-4 mr-1" />
                Recibo
              </Button>
            </a>
            <a
              href={receiptsApi.getFileUrl(sale.id, true)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Download className="h-4 w-4" />
              </Button>
            </a>
            <span className="text-xl font-bold text-primary">{formatCurrency(parseFloat(sale.total))}</span>
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
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Histórico de Vendas</h1>
        <p className="text-muted-foreground">
          Suas vendas com filtros avançados. Devoluções: {remaining} de 5 disponíveis (por 2 dias)
        </p>
      </div>

      {/* Filtros */}
      <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" />
            Filtros
          </CardTitle>
          <CardDescription>Refine por data, hora e produto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Pesquisar (valor, hora, produto)..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="max-w-xs"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Data inicial</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Data final</label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Hora inicial</label>
              <Input
                type="time"
                value={filterHourFrom}
                onChange={(e) => { setFilterHourFrom(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Hora final</label>
              <Input
                type="time"
                value={filterHourTo}
                onChange={(e) => { setFilterHourTo(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Produto</label>
              <Select value={filterProduct} onValueChange={(v) => { setFilterProduct(v); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {filteredSales.length} vendas
              </CardTitle>
              <CardDescription>
                Página {currentPage} de {totalPages}
              </CardDescription>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">Nenhuma venda encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ajuste os filtros ou período para ver resultados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedSales.map((s) => {
                const saleDate = new Date(s.createdAt).toISOString().split('T')[0];
                const allowReturn = saleDate === today && canReturn;
                return <SaleCard key={s.id} sale={s} allowReturn={allowReturn} />;
              })}
            </div>
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
