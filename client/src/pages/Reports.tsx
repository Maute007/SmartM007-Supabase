import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { format, subDays, isSameDay, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useSearch } from 'wouter';
import { DateRange } from "react-day-picker"
import { Calendar as CalendarIcon, Download, TrendingUp, Users, FileUp, Package, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from '@tanstack/react-query';
import { salesApi, productsApi, categoriesApi, usersApi, auditLogsApi } from '@/lib/api';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { formatAuditLog } from '@/lib/auditFormat';

const presets = [
  { label: 'Hoje', from: (d: Date) => d, to: (d: Date) => d },
  { label: 'Esta semana', from: (d: Date) => subDays(d, 6), to: (d: Date) => d },
  { label: 'Este mês', from: (d: Date) => subDays(d, 29), to: (d: Date) => d },
] as const;

export default function Reports() {
  const { user } = useAuth();
  const search = useSearch();
  const tabFromUrl = new URLSearchParams(search || '').get('tab') || 'entrada';
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [importDate, setImportDate] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [pageEntrada, setPageEntrada] = useState(0);
  const [pageSaida, setPageSaida] = useState(0);
  useEffect(() => { if (tabFromUrl) setActiveTab(tabFromUrl); }, [tabFromUrl]);
  useEffect(() => { setPageEntrada(0); setPageSaida(0); }, [date?.from, date?.to]);
  const ITEMS_PER_PAGE = 20;

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll
  });

  const importStart = importDate?.from ? format(importDate.from, 'yyyy-MM-dd') : format(subDays(new Date(), 29), 'yyyy-MM-dd');
  const importEnd = importDate?.to ? format(importDate.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const { data: importLogs = [] } = useQuery({
    queryKey: ['/api/audit-logs/imports', importStart, importEnd],
    queryFn: () => auditLogsApi.getImportsByDateRange(importStart, importEnd),
    enabled: !!importDate?.from
  });

  const handleExportExcel = async () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Sheet 1: Saída (Vendas)
      const salesData = filteredSales.map(s => ({
        'ID': s.id.slice(-6),
        'Vendedor': users.find(u => u.id === s.userId)?.name || 'Desconhecido',
        'Total': parseFloat(s.total),
        'Itens': s.items.length,
        'Forma Pagamento': s.paymentMethod,
        'Data': format(new Date(s.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesData), "Saída");

      // Sheet 2: Performance por Vendedor
      const sellerPerformance = sales.reduce((acc, sale) => {
        const seller = users.find(u => u.id === sale.userId);
        const existing = acc.find(s => s.vendedor === (seller?.name || 'Desconhecido'));
        if (existing) {
          existing.vendas += 1;
          existing.total += parseFloat(sale.total);
        } else {
          acc.push({ vendedor: seller?.name || 'Desconhecido', vendas: 1, total: parseFloat(sale.total) });
        }
        return acc;
      }, [] as any[]).sort((a, b) => b.total - a.total);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sellerPerformance), "Performance Vendedores");

      // Sheet: Entrada (produtos registados)
      const entradaData = products
        .filter(p => {
          if (!date?.from || !date?.to) return false;
          const d = new Date(p.createdAt);
          const to = date.to || date.from;
          return d >= date.from && d <= to;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(p => ({
          'Produto': p.name,
          'SKU': p.sku,
          'Categoria': categories.find(c => c.id === p.categoryId)?.name || '-',
          'Preço': parseFloat(p.price),
          'Estoque': p.stock,
          'Unidade': p.unit,
          'Data': format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
        }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(entradaData), "Entrada");

      // Sheet: Importações (no período do relatório)
      if (date?.from && date?.to) {
        const importStart = format(date.from, 'yyyy-MM-dd');
        const importEnd = format(date.to, 'yyyy-MM-dd');
        try {
          const impLogs = await auditLogsApi.getImportsByDateRange(importStart, importEnd);
          const importData = impLogs.map((log: any) => {
            const fmt = formatAuditLog(log.action, log.entityType, log.details);
            const author = users.find((u: any) => u.id === log.userId)?.name || 'Sistema';
            return {
              'Data/Hora': format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
              'Resumo': fmt.summary,
              'Autor': author,
              'Detalhes': (fmt.detailsText || '').replace(/\n/g, ' | ')
            };
          });
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(importData), "Importações");
        } catch (_) { /* skip if fails */ }
      }

      // Sheet 4: Produtos Mais Vendidos
      const topProducts = sales
        .flatMap(s => s.items)
        .reduce((acc, item) => {
          const existing = acc.find(p => p.productId === item.productId);
          const product = products.find(p => p.id === item.productId);
          if (existing) {
            existing.quantidade += item.quantity;
          } else {
            acc.push({ produto: product?.name || 'Desconhecido', quantidade: item.quantity, preco: item.priceAtSale, productId: item.productId });
          }
          return acc;
        }, [] as any[])
        .map(p => ({ 'Produto': p.produto, 'Quantidade': p.quantidade, 'Preço': p.preco }))
        .sort((a, b) => b.Quantidade - a.Quantidade);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(topProducts), "Top Produtos");

      XLSX.writeFile(workbook, `relatorio_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
      toast({ title: "Sucesso", description: "Relatório exportado com sucesso!" });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao exportar relatório", variant: "destructive" });
    }
  };

  const toDate = date?.to || date?.from;

  const filteredProductsEntrada = products.filter(p => {
    if (!date?.from || !toDate) return false;
    const d = new Date(p.createdAt);
    return d >= date.from && d <= toDate;
  });

  const filteredSales = sales.filter(s => {
    if (!date?.from) return true;
    const saleDate = new Date(s.createdAt);
    const toDate = date.to || date.from;
    return saleDate >= date.from && saleDate <= toDate;
  });

  const salesByDate = filteredSales.reduce((acc, sale) => {
    const dateStr = format(new Date(sale.createdAt), 'dd/MM', { locale: ptBR });
    if (!acc[dateStr]) {
      acc[dateStr] = 0;
    }
    acc[dateStr] += parseFloat(sale.total);
    return acc;
  }, {} as Record<string, number>);

  const timeChartData = Object.entries(salesByDate).map(([date, total]) => ({
    date,
    total
  })).sort((a, b) => {
    return 0; 
  });

  const salesByCategory = filteredSales.reduce((acc, sale) => {
    sale.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const category = categories.find(c => c.id === product.categoryId);
        const catName = category ? category.name : 'Outros';
        if (!acc[catName]) acc[catName] = 0;
        acc[catName] += item.priceAtSale * item.quantity;
      }
    });
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(salesByCategory).map(([name, value]) => ({
    name,
    value
  }));

  const totalRevenue = filteredSales.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
  const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  // Performance por Vendedor
  const sellerPerformance = sales.reduce((acc, sale) => {
    const seller = users.find(u => u.id === sale.userId);
    const existing = acc.find(s => s.id === sale.userId);
    if (existing) {
      existing.vendas += 1;
      existing.total += parseFloat(sale.total);
    } else {
      acc.push({ id: sale.userId, nome: seller?.name || 'Desconhecido', vendas: 1, total: parseFloat(sale.total) });
    }
    return acc;
  }, [] as any[])
    .map(s => ({ ...s, percentual: ((s.total / (sales.reduce((a, c) => a + parseFloat(c.total), 0) || 1)) * 100).toFixed(1) }))
    .sort((a, b) => b.total - a.total);

  const isLoading = salesLoading || productsLoading || categoriesLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada de vendas e desempenho.</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={handleExportExcel} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
           <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
                data-testid="button-date-range"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd 'de' MMM", { locale: ptBR })} -{" "}
                      {format(date.to, "dd 'de' MMM", { locale: ptBR })}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Selecione um período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sales">{filteredSales.length}</div>
            <p className="text-xs text-muted-foreground">Transações</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-ticket">{formatCurrency(averageTicket)}</div>
            <p className="text-xs text-muted-foreground">Por venda</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1">
          <TabsTrigger value="entrada" className="gap-1"><Package className="h-4 w-4" /> Entrada</TabsTrigger>
          <TabsTrigger value="saida" className="gap-1"><ShoppingCart className="h-4 w-4" /> Saída</TabsTrigger>
          <TabsTrigger value="graficos" className="gap-1">Gráficos</TabsTrigger>
          <TabsTrigger value="vendedores" className="gap-1"><Users className="h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="importacoes" className="gap-1"><FileUp className="h-4 w-4" /> Importações</TabsTrigger>
          <TabsTrigger value="tendencias" className="gap-1"><TrendingUp className="h-4 w-4" /> Tendências</TabsTrigger>
        </TabsList>

        <TabsContent value="entrada" className="space-y-4">
          <Card className="border-0 shadow-xl bg-gradient-to-b from-white to-emerald-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-emerald-600" />
                </div>
                Relatório de Entrada — Produtos Registados
              </CardTitle>
              <CardDescription>Produtos criados no período (manual ou importação). Use o calendário acima para filtrar por datas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <p className="text-2xl font-bold text-emerald-700">{filteredProductsEntrada.length} produtos</p>
                <p className="text-sm text-muted-foreground">Período: {date?.from && format(date.from, 'dd/MM/yyyy', { locale: ptBR })} – {toDate && format(toDate, 'dd/MM/yyyy', { locale: ptBR })}</p>
              </div>
              {filteredProductsEntrada.length === 0 ? (
                <div className="text-center py-16 rounded-xl bg-muted/30 border border-dashed">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Nenhum produto registado no período</p>
                </div>
              ) : (
                <>
                <div className="rounded-xl border overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-emerald-50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-semibold">Produto</th>
                          <th className="text-left p-3 font-semibold">SKU</th>
                          <th className="text-left p-3 font-semibold">Categoria</th>
                          <th className="text-right p-3 font-semibold">Preço</th>
                          <th className="text-right p-3 font-semibold">Estoque</th>
                          <th className="text-left p-3 font-semibold">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProductsEntrada
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(pageEntrada * ITEMS_PER_PAGE, pageEntrada * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
                          .map((p) => (
                            <tr key={p.id} className="border-t hover:bg-muted/30">
                              <td className="p-3 font-medium">{p.name}</td>
                              <td className="p-3 text-muted-foreground">{p.sku}</td>
                              <td className="p-3">{categories.find(c => c.id === p.categoryId)?.name || '-'}</td>
                              <td className="p-3 text-right font-medium">{formatCurrency(parseFloat(p.price))}</td>
                              <td className="p-3 text-right">{p.stock} {p.unit}</td>
                              <td className="p-3 text-muted-foreground">{format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {pageEntrada + 1} de {Math.ceil(filteredProductsEntrada.length / ITEMS_PER_PAGE) || 1} · 20 por página
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pageEntrada === 0} onClick={() => setPageEntrada(p => Math.max(0, p - 1))}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={pageEntrada >= Math.ceil(filteredProductsEntrada.length / ITEMS_PER_PAGE) - 1} onClick={() => setPageEntrada(p => p + 1)}>
                      Próximo <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saida" className="space-y-4">
          <Card className="border-0 shadow-xl bg-gradient-to-b from-white to-orange-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-orange-600" />
                </div>
                Relatório de Saída — Vendas
              </CardTitle>
              <CardDescription>Vendas realizadas no período. Use o calendário acima para filtrar por datas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-xs font-medium text-orange-800">Receita Total</p>
                  <p className="text-xl font-bold text-orange-700">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-xs font-medium text-orange-800">Vendas</p>
                  <p className="text-xl font-bold text-orange-700">{filteredSales.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-xs font-medium text-orange-800">Ticket Médio</p>
                  <p className="text-xl font-bold text-orange-700">{formatCurrency(averageTicket)}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-xs font-medium text-orange-800">Período</p>
                  <p className="text-sm font-semibold text-orange-700">{date?.from && format(date.from, 'dd/MM', { locale: ptBR })} – {toDate && format(toDate, 'dd/MM', { locale: ptBR })}</p>
                </div>
              </div>
              {filteredSales.length === 0 ? (
                <div className="text-center py-16 rounded-xl bg-muted/30 border border-dashed">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Nenhuma venda no período</p>
                </div>
              ) : (
                <>
                <div className="rounded-xl border overflow-hidden">
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-orange-50 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-semibold">Data</th>
                          <th className="text-left p-3 font-semibold">Vendedor</th>
                          <th className="text-right p-3 font-semibold">Total</th>
                          <th className="text-right p-3 font-semibold">Itens</th>
                          <th className="text-left p-3 font-semibold">Pagamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...filteredSales]
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(pageSaida * ITEMS_PER_PAGE, pageSaida * ITEMS_PER_PAGE + ITEMS_PER_PAGE)
                          .map((s) => (
                            <tr key={s.id} className="border-t hover:bg-muted/30">
                              <td className="p-3">{format(new Date(s.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                              <td className="p-3">{users.find(u => u.id === s.userId)?.name || '-'}</td>
                              <td className="p-3 text-right font-semibold">{formatCurrency(parseFloat(s.total))}</td>
                              <td className="p-3 text-right">{s.items.length}</td>
                              <td className="p-3 text-muted-foreground">{s.paymentMethod}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {pageSaida + 1} de {Math.ceil(filteredSales.length / ITEMS_PER_PAGE) || 1} · 20 por página
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={pageSaida === 0} onClick={() => setPageSaida(p => Math.max(0, p - 1))}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={pageSaida >= Math.ceil(filteredSales.length / ITEMS_PER_PAGE) - 1} onClick={() => setPageSaida(p => p + 1)}>
                      Próximo <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graficos" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Evolução de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeChartData}>
                   <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(150 60% 35%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(150 60% 35%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `MT ${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(val: number) => formatCurrency(val)}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(150 60% 35%)" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Vendas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(val: number) => formatCurrency(val)}
                  />
                  <Bar dataKey="value" fill="hsl(32 95% 55%)" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="vendedores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Vendedores</CardTitle>
              <CardDescription>Performance de vendas por vendedor</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sellerPerformance.map((seller, idx) => (
                  <div key={seller.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="font-bold text-2xl text-primary/60">#{idx + 1}</div>
                      <div>
                        <p className="font-semibold text-gray-800">{seller.nome}</p>
                        <p className="text-sm text-muted-foreground">{seller.vendas} vendas realizadas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{formatCurrency(seller.total)}</p>
                      <p className="text-xs text-muted-foreground">{seller.percentual}% do total</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sellerPerformance}
                      dataKey="total"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({nome, percentual}) => `${nome} (${percentual}%)`}
                      colors={['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']}
                    />
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importacoes" className="space-y-4">
          <Card className="border-0 shadow-xl bg-gradient-to-b from-white to-primary/5">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileUp className="h-5 w-5 text-primary" />
                    </div>
                    Histórico de Importações
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Filtrar por período e baixar relatório de auditoria
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {presets.map((p) => {
                    const now = new Date();
                    const from = p.from(now);
                    const to = p.to(now);
                    return (
                      <Button
                        key={p.label}
                        variant="outline"
                        size="sm"
                        onClick={() => setImportDate({ from, to })}
                      >
                        {p.label}
                      </Button>
                    );
                  })}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn(!importDate && "text-muted-foreground")}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Personalizado
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar mode="range" selected={importDate} onSelect={(r) => r && setImportDate(r)} numberOfMonths={2} />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      try {
                        const impLogs = await auditLogsApi.getImportsByDateRange(importStart, importEnd);
                        const rows = impLogs.map((log: any) => {
                          const fmt = formatAuditLog(log.action, log.entityType, log.details);
                          const author = users.find((u: any) => u.id === log.userId)?.name || 'Sistema';
                          return [format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }), fmt.summary, author, (fmt.detailsText || '').replace(/\n/g, ' | ')];
                        });
                        const csv = ['Data/Hora;Resumo;Autor;Detalhes', ...rows.map((r: string[]) => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
                        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `importacoes_${importStart}_${importEnd}.csv`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                        toast({ title: 'Sucesso', description: 'Relatório de importações exportado!' });
                      } catch (e) {
                        toast({ title: 'Erro', description: 'Erro ao exportar', variant: 'destructive' });
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {importLogs.length === 0 ? (
                <div className="text-center py-16 rounded-xl bg-muted/30 border border-dashed">
                  <FileUp className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Nenhuma importação no período selecionado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {importLogs.map((log) => {
                    const fmt = formatAuditLog(log.action, log.entityType, log.details);
                    const author = users.find(u => u.id === log.userId)?.name || 'Sistema';
                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-primary/10 bg-white p-5 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <FileUp className="h-6 w-6 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground text-lg">{fmt.summary}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {author} · {format(new Date(log.createdAt), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              {fmt.detailsText && (
                                <pre className="text-sm text-muted-foreground mt-4 p-4 rounded-lg bg-muted/40 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto border border-primary/5">
                                  {fmt.detailsText}
                                </pre>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-primary bg-primary/10 px-4 py-2 rounded-lg shrink-0">
                            {fmt.actionLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tendencias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Tendências</CardTitle>
              <CardDescription>Evolução de vendas e recomendações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-semibold text-green-800">Tendência de Crescimento</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">+12.5%</p>
                  <p className="text-xs text-muted-foreground mt-1">Comparado ao período anterior</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800">Melhor Dia</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(Math.max(...Object.values(salesByDate) as number[]) || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Receita máxima no período</p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="font-semibold text-yellow-800 mb-3">💡 Recomendações de Reordenação</p>
                <ul className="space-y-2 text-sm">
                  {products
                    .filter(p => parseFloat(p.stock) <= parseFloat(p.minStock) * 1.5)
                    .sort((a, b) => parseFloat(a.stock) - parseFloat(b.stock))
                    .slice(0, 5)
                    .map(p => (
                      <li key={p.id} className="flex justify-between items-center p-2 bg-white rounded border border-yellow-100">
                        <span className="text-gray-700">{p.name}</span>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold">
                          {parseFloat(p.stock)} / {parseFloat(p.minStock)} {p.unit}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
