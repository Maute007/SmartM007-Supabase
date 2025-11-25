import { useApp } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';
import { DateRange } from "react-day-picker"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function Reports() {
  const { state } = useApp();
  const { sales, categories, products } = state;
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Filter sales by date range
  const filteredSales = sales.filter(s => {
    if (!date?.from) return true;
    const saleDate = new Date(s.timestamp);
    const toDate = date.to || date.from;
    return saleDate >= date.from && saleDate <= toDate;
  });

  // Aggregate sales by date
  const salesByDate = filteredSales.reduce((acc, sale) => {
    const dateStr = format(new Date(sale.timestamp), 'dd/MM', { locale: ptBR });
    if (!acc[dateStr]) {
      acc[dateStr] = 0;
    }
    acc[dateStr] += sale.total;
    return acc;
  }, {} as Record<string, number>);

  const timeChartData = Object.entries(salesByDate).map(([date, total]) => ({
    date,
    total
  })).sort((a, b) => {
    // Simplified sort assuming simple dd/MM format within same year for prototype
    return 0; 
  });

  // Aggregate sales by category
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

  const totalRevenue = filteredSales.reduce((acc, curr) => acc + curr.total, 0);
  const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada de vendas e desempenho.</p>
        </div>
        <div className="flex gap-2">
           <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
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
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSales.length}</div>
            <p className="text-xs text-muted-foreground">Transações</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageTicket)}</div>
            <p className="text-xs text-muted-foreground">Por venda</p>
          </CardContent>
        </Card>
      </div>

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
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
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
    </div>
  );
}
