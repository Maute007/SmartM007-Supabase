import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  ShoppingBag, 
  Package, 
  AlertTriangle, 
  TrendingUp,
  ArrowRight,
  Calendar,
  Users,
  Activity,
  Zap
} from 'lucide-react';
import { Link } from 'wouter';
import { formatCurrency } from '@/lib/utils';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from 'recharts';
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

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'dd/MM', { locale: ptBR });
    const daySales = sales
      .filter(s => new Date(s.createdAt).toDateString() === date.toDateString())
      .reduce((acc, curr) => acc + parseFloat(curr.total), 0);
    
    return { date: dateStr, total: daySales, orders: sales.filter(s => new Date(s.createdAt).toDateString() === date.toDateString()).length };
  });

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/90 to-primary/70 p-8 md:p-12 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-black/10 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-heading font-bold tracking-tight">
              Bem-vindo, {user?.name.split(' ')[0]}! 👋
            </h1>
            <p className="text-primary-foreground/80 text-lg max-w-xl">
              Aqui está o resumo das atividades da sua mercearia hoje. 
              Você tem <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full">{lowStockCount} alertas</span> precisando de atenção.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/reports">
              <Button variant="secondary" className="shadow-lg bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-sm">
                <Activity className="mr-2 h-4 w-4" />
                Ver Relatórios
              </Button>
            </Link>
            <Link href="/pos">
              <Button size="lg" className="shadow-xl bg-white text-primary hover:bg-white/90 font-bold border-none">
                <Zap className="mr-2 h-4 w-4 fill-current" />
                Nova Venda
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-gray-50 hover:scale-[1.02] transition-transform duration-300 group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-green-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-green-500/20"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Hoje</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-gray-800" data-testid="text-sales-today">{formatCurrency(totalSalesToday)}</div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <span className="text-green-500 font-bold flex items-center bg-green-100 px-1.5 py-0.5 rounded-md">
                <TrendingUp className="h-3 w-3 mr-1" /> +12.5%
              </span>
              <span className="opacity-70">vs ontem</span>
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-gray-50 hover:scale-[1.02] transition-transform duration-300 group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-blue-500/20"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-gray-800" data-testid="text-orders-today">{totalOrdersToday}</div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <span className="text-blue-500 font-bold flex items-center bg-blue-100 px-1.5 py-0.5 rounded-md">
                +{Math.floor(Math.random() * 5)}
              </span>
              <span className="opacity-70">na última hora</span>
            </p>
          </CardContent>
        </Card>

        <Card className={`relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-gray-50 hover:scale-[1.02] transition-transform duration-300 group ${lowStockCount > 0 ? 'ring-2 ring-destructive/20' : ''}`}>
          <div className="absolute right-0 top-0 h-24 w-24 bg-red-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-red-500/20"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas Estoque</CardTitle>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${lowStockCount > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className={`text-3xl font-bold ${lowStockCount > 0 ? 'text-destructive' : 'text-gray-800'}`} data-testid="text-low-stock">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {lowStockCount > 0 ? 'Produtos abaixo do mínimo' : 'Estoque saudável'}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-gray-50 hover:scale-[1.02] transition-transform duration-300 group">
          <div className="absolute right-0 top-0 h-24 w-24 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-orange-500/20"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-muted-foreground">Equipe Ativa</CardTitle>
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-gray-800" data-testid="text-active-users">{activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Usuários cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Desempenho Semanal</CardTitle>
                <CardDescription>Receita diária vs. meta esperada</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full text-xs h-7">7 Dias</Button>
                <Button variant="ghost" size="sm" className="rounded-full text-xs h-7 text-muted-foreground">30 Dias</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(150 60% 35%)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(150 60% 35%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `MT ${value}`} 
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: number) => [`MT ${value.toFixed(2)}`, 'Vendas']}
                    labelStyle={{ color: '#666', marginBottom: '0.5rem' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(150 60% 35%)" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Feed de Atividades
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden relative">
              <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-100"></div>
              <div className="space-y-6 relative">
                {notifications.slice(0, 4).map((notif, idx) => (
                  <div key={notif.id} className="flex gap-4 items-start group">
                    <div className={`relative z-10 mt-1 h-3 w-3 rounded-full shrink-0 ring-4 ring-white transition-all duration-300 group-hover:scale-125 ${
                      notif.type === 'warning' ? 'bg-yellow-500' : 
                      notif.type === 'success' ? 'bg-green-500' : 
                      notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <div className="space-y-1 bg-gray-50/50 p-3 rounded-lg flex-1 transition-colors group-hover:bg-gray-100">
                      <p className="text-sm font-medium leading-snug text-gray-800">{notif.message}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {format(new Date(notif.createdAt), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {sales.slice(0, 3).map((sale) => (
                  <div key={sale.id} className="flex gap-4 items-start group">
                    <div className="relative z-10 mt-1 h-3 w-3 rounded-full shrink-0 bg-primary ring-4 ring-white transition-all duration-300 group-hover:scale-125" />
                    <div className="space-y-1 bg-gray-50/50 p-3 rounded-lg flex-1 transition-colors group-hover:bg-gray-100">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-gray-800">Venda #{sale.id.slice(-4)}</p>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 rounded">{formatCurrency(parseFloat(sale.total))}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sale.items.length} itens • {sale.paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <Button variant="ghost" className="w-full text-primary text-sm hover:bg-primary/5">Ver todo o histórico</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
