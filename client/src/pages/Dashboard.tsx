import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  ShoppingBag, 
  Package, 
  AlertTriangle, 
  TrendingUp,
  Users,
  Activity,
  Zap,
  Star,
  Bell,
  Lightbulb,
  Target,
  Sparkles,
} from 'lucide-react';
import { Link } from 'wouter';
import { formatCurrency } from '@/lib/utils';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { salesApi, productsApi, usersApi, notificationsApi } from '@/lib/api';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: notificationsApi.getAll
  });

  const totalSalesToday = sales
    .filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + parseFloat(curr.total), 0);

  const totalOrdersToday = sales
    .filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .length;

  const lowStockCount = products.filter(p => parseFloat(p.stock) <= parseFloat(p.minStock)).length;
  const activeUsers = users.length;

  // Top 5 produtos mais vendidos
  const topProducts = sales
    .flatMap(s => s.items)
    .reduce((acc, item) => {
      const existing = acc.find(p => p.productId === item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.priceAtSale * item.quantity;
      } else {
        acc.push({ productId: item.productId, quantity: item.quantity, revenue: item.priceAtSale * item.quantity });
      }
      return acc;
    }, [] as any[])
    .map(item => {
      const product = products.find(p => p.id === item.productId);
      return { ...item, name: product?.name || 'Desconhecido', ...item };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Produtos com alerta de estoque baixo
  const lowStockProducts = products
    .filter(p => parseFloat(p.stock) <= parseFloat(p.minStock))
    .sort((a, b) => parseFloat(a.stock) - parseFloat(b.stock))
    .slice(0, 5);

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'dd/MM', { locale: ptBR });
    const daySales = sales
      .filter(s => new Date(s.createdAt).toDateString() === date.toDateString())
      .reduce((acc, curr) => acc + parseFloat(curr.total), 0);
    
    return { date: dateStr, total: daySales, orders: sales.filter(s => new Date(s.createdAt).toDateString() === date.toDateString()).length };
  });

  // Insights para crescimento — dados derivados
  const soldLast7Days = new Set(
    sales
      .filter(s => (Date.now() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 7)
      .flatMap(s => s.items.map(i => i.productId))
  );
  const productsNoSale7Days = products.filter(p => !soldLast7Days.has(p.id));
  const urgentReorder = lowStockProducts.filter(p => topProducts.some(t => t.productId === p.id));
  const avgDailySales = chartData.reduce((a, d) => a + d.total, 0) / 7;
  const todayVsAvg = avgDailySales > 0 ? ((totalSalesToday - avgDailySales) / avgDailySales) * 100 : 0;

  const insights: { type: 'urgent' | 'stale' | 'trend' | 'tip'; label: string; detail?: string }[] = [];
  if (urgentReorder.length > 0) {
    insights.push({ type: 'urgent', label: `${urgentReorder.length} produto(s) em falta que vendem bem`, detail: 'Repor prioritário para não perder vendas' });
  }
  if (productsNoSale7Days.length > 0 && productsNoSale7Days.length <= 20) {
    insights.push({ type: 'stale', label: `${productsNoSale7Days.length} produto(s) sem venda há 7 dias`, detail: 'Considere promoção ou reposicionamento' });
  } else if (productsNoSale7Days.length > 20) {
    insights.push({ type: 'stale', label: `${productsNoSale7Days.length} produtos parados`, detail: 'Avalie descontinuação ou oferta' });
  }
  if (todayVsAvg > 15) {
    insights.push({ type: 'trend', label: 'Hoje está acima da média semanal', detail: `+${todayVsAvg.toFixed(0)}% em relação à média` });
  } else if (todayVsAvg < -20 && totalOrdersToday > 0) {
    insights.push({ type: 'trend', label: 'Hoje abaixo da média', detail: `${todayVsAvg.toFixed(0)}% — bom momento para promoções` });
  }
  if (lowStockCount === 0 && products.length > 0) {
    insights.push({ type: 'tip', label: 'Estoque em dia', detail: 'Bom momento para negociar com fornecedores' });
  }
  if (insights.length === 0) {
    insights.push({ type: 'tip', label: 'Mantenha o ritmo', detail: 'Analise os relatórios para oportunidades' });
  }

  const isLoading = salesLoading || productsLoading || usersLoading || notificationsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const statsCards = [
    { title: 'Vendas Hoje', value: formatCurrency(totalSalesToday), icon: DollarSign, color: 'emerald', borderColor: 'border-l-emerald-500', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
    { title: 'Pedidos', value: totalOrdersToday, icon: ShoppingBag, color: 'blue', borderColor: 'border-l-blue-500', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-600' },
    { title: 'Alertas', value: lowStockCount, icon: AlertTriangle, color: 'amber', borderColor: 'border-l-amber-500', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-600' },
    { title: 'Equipe', value: activeUsers, icon: Users, color: 'violet', borderColor: 'border-l-violet-500', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600' },
  ];

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-emerald-800 p-8 md:p-10 text-primary-foreground shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-white/5 blur-2xl animate-float" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight">
              Bem-vindo, {user?.name.split(' ')[0]}! 👋
            </h1>
            <p className="mt-2 text-primary-foreground/90 text-base md:text-lg max-w-xl">
              Resumo do dia — {lowStockCount > 0 ? (
                <span className="font-semibold bg-amber-400/30 px-2 py-0.5 rounded">{lowStockCount} alertas</span>
              ) : (
                <span className="font-semibold bg-white/20 px-2 py-0.5 rounded">tudo ok</span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/reports">
              <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0 shadow-lg transition-all duration-300 hover:scale-105 hover:-translate-y-0.5">
                <Activity className="mr-2 h-4 w-4" />
                Relatórios
              </Button>
            </Link>
            <Link href="/pos">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-bold shadow-lg transition-all duration-300 hover:scale-105 hover:-translate-y-0.5">
                <Zap className="mr-2 h-4 w-4 fill-current" />
                Nova Venda
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((card, idx) => {
          const Icon = card.icon;
          const stagger = `stagger-${idx + 1}`;
          return (
            <Card
              key={idx}
              className={`overflow-hidden border-l-4 ${card.borderColor} bg-card shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${stagger}`}
              data-testid={idx === 0 ? 'text-sales-today' : idx === 2 ? 'text-low-stock' : undefined}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold mt-1 text-foreground">{card.value}</p>
                  </div>
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${card.iconBg} ${card.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Gráficos — largura total */}
      <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-b from-white to-slate-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Desempenho Semanal
            </CardTitle>
            <CardDescription>Receita diária</CardDescription>
          </CardHeader>
          <CardContent className="pl-0 pt-0">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(150 60% 35%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(150 60% 35%)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `MT ${v}`} width={50} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [`MT ${value.toFixed(2)}`, 'Vendas']}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(150 60% 35%)" strokeWidth={3} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="px-6 pb-4 pt-2">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="date" width={50} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Bar dataKey="orders" fill="hsl(150 60% 35%)" radius={[0, 4, 4, 0]} maxBarSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '8px' }} formatter={(v: number) => [v, 'Pedidos']} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center mt-1">Pedidos por dia</p>
            </div>
          </CardContent>
        </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-red-50/30 hover-lift transition-smooth">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-red-500" />
              ⚠️ Produtos com Alerta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta de estoque</p>
              ) : (
                lowStockProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-start p-2 bg-red-50 rounded-lg border border-red-200 hover:shadow-md hover:scale-[1.01] transition-all duration-300">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-red-600 font-bold">
                        {parseFloat(p.stock)} {p.unit} (min: {parseFloat(p.minStock)})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold">REORDENAR</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm hover-lift transition-smooth">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Top 5 Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div key={p.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:shadow-md hover:scale-[1.01] transition-all duration-300">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-bold text-lg text-primary/60">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} vendas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{formatCurrency(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-gradient-to-br from-white via-amber-50/30 to-orange-50/20 hover-lift transition-smooth border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              Insights para Crescer
            </CardTitle>
            <CardDescription className="text-xs">Sugestões e pontos de atenção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((item, idx) => {
                const style = item.type === 'urgent' ? 'bg-red-50 border-red-200 text-red-800' : item.type === 'stale' ? 'bg-amber-50 border-amber-200 text-amber-900' : item.type === 'trend' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700';
                const Icon = item.type === 'urgent' ? AlertTriangle : item.type === 'stale' ? Package : item.type === 'trend' ? TrendingUp : Sparkles;
                return (
                  <div key={idx} className={`flex gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${style}`}>
                    <div className="shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 opacity-80" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.detail && <p className="text-xs opacity-90 mt-0.5">{item.detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="w-full mt-3 text-amber-700 hover:bg-amber-100 text-xs">
                <Target className="h-3.5 w-3.5 mr-1.5" />
                Ver relatórios completos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
