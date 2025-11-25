import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  ShoppingBag, 
  Package, 
  AlertTriangle, 
  TrendingUp,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { Link } from 'wouter';
import { formatCurrency } from '@/lib/utils';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { state } = useApp();
  const { sales, products, notifications } = state;

  // Metrics
  const totalSalesToday = sales
    .filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalOrdersToday = sales
    .filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString())
    .length;

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  // Chart Data (Last 7 days)
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'dd/MM', { locale: ptBR });
    const daySales = sales
      .filter(s => new Date(s.timestamp).toDateString() === date.toDateString())
      .reduce((acc, curr) => acc + curr.total, 0);
    
    return { date: dateStr, total: daySales };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da sua mercearia hoje.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pos">
            <Button size="lg" className="shadow-lg shadow-primary/20 font-semibold">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Nova Venda
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow border-primary/10 bg-gradient-to-br from-card to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalSalesToday)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-500 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +12%
              </span>
              vs ontem
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Hoje</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrdersToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Transações realizadas</p>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-md transition-shadow border-primary/10 ${lowStockCount > 0 ? 'border-l-4 border-l-destructive bg-destructive/5' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${lowStockCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-destructive' : ''}`}>{lowStockCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Produtos precisam de atenção</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Produtos</CardTitle>
            <Package className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Cadastrados no sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Chart Section */}
        <Card className="lg:col-span-4 border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Vendas da Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(150 60% 35%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(150 60% 35%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `R$${value}`} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Vendas']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(150 60% 35%)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales / Notifications */}
        <Card className="lg:col-span-3 border-primary/10 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Atividades Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto pr-2">
            <div className="space-y-6">
              {notifications.slice(0, 5).map((notif) => (
                <div key={notif.id} className="flex gap-4 items-start">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                    notif.type === 'warning' ? 'bg-yellow-500' : 
                    notif.type === 'success' ? 'bg-green-500' : 
                    notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{notif.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(notif.timestamp), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              
              {sales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      Venda #{sale.id.slice(-4)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sale.items.length} itens • {sale.paymentMethod === 'card' ? 'Cartão' : sale.paymentMethod === 'cash' ? 'Dinheiro' : 'Pix'}
                    </p>
                  </div>
                  <div className="font-bold text-sm">
                    {formatCurrency(sale.total)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
