import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Package, Phone, User, Plus, Minus, Check, Clock, X, Store, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Product, Category } from '@/lib/api';

interface CartItem {
  productId: string;
  product?: Product;
  quantity: number;
  priceAtSale: number;
}

interface OrderData {
  orderCode?: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  status?: 'pending' | 'approved' | 'cancelled';
  paymentMethod: 'cash' | 'transfer';
  paymentProof?: string;
  createdAt?: string;
  approvedAt?: string;
}

export default function ClientOrders() {
  const [location, setLocation] = useLocation();
  const [step, setStep] = useState<'browse' | 'checkout' | 'tracking'>('browse');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [trackingCode, setTrackingCode] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [formData, setFormData] = useState({ customerName: '', customerPhone: '', paymentMethod: 'cash' as const });
  const [selectedCategory, setSelectedCategory] = useState('0');

  // Fetch products and categories
  const { data: productsData = [] } = useQuery({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Erro ao buscar produtos');
      return res.json();
    }
  });

  const { data: categoriesData = [] } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Erro ao buscar categorias');
      return res.json();
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!formData.customerName || !formData.customerPhone || cart.length === 0) {
        throw new Error('Preencha todos os campos');
      }
      
      const total = cart.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          items: cart,
          total: total.toString(),
          paymentMethod: formData.paymentMethod
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar pedido');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setOrder(data);
      setStep('tracking');
      toast({ title: 'Sucesso!', description: `Pedido criado: ${data.orderCode}` });
      setCart([]);
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const trackOrderMutation = useMutation({
    mutationFn: async () => {
      if (!trackingCode) throw new Error('Digite o código de rastreamento');
      const res = await fetch(`/api/orders/${trackingCode}`);
      if (!res.ok) throw new Error('Pedido não encontrado');
      return res.json();
    },
    onSuccess: (data) => {
      setOrder(data);
      setStep('tracking');
      toast({ title: 'Pedido encontrado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const products = productsData as Product[];
  const categories = categoriesData as Category[];
  
  const filteredProducts = selectedCategory === '0' 
    ? products 
    : products.filter(p => p.categoryId === selectedCategory);

  const total = cart.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      existing.quantity += 1;
      setCart([...cart]);
    } else {
      setCart([...cart, {
        productId: product.id,
        product,
        quantity: 1,
        priceAtSale: parseFloat(product.price)
      }]);
    }
    toast({ title: 'Adicionado!', description: `${product.name} foi adicionado ao carrinho` });
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const item = cart.find(i => i.productId === productId);
    if (item) {
      item.quantity = Math.max(0.1, Math.max(1, quantity));
      setCart([...cart]);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'approved': return <Check className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500/10 via-orange-500/5 to-emerald-500/10 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Fresh Market</h1>
              <p className="text-sm text-muted-foreground">Faça seu pedido online</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setLocation('/login')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Login
          </Button>
        </div>

        {step === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Products */}
            <div className="lg:col-span-3 space-y-4">
              {/* Category Filter */}
              <Card className="border-emerald-200">
                <CardContent className="pt-6">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Todas as Categorias</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map(product => (
                  <Card key={product.id} className="border-emerald-100 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <CardDescription>SKU: {product.sku}</CardDescription>
                        </div>
                        <Badge variant="outline" className="ml-2">{product.unit}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(parseFloat(product.price))}</div>
                        <div className={`text-xs px-2 py-1 rounded ${parseFloat(product.stock) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {parseFloat(product.stock) > 0 ? `${product.stock} disponível` : 'Fora de estoque'}
                        </div>
                      </div>
                      <Button 
                        onClick={() => addToCart(product)}
                        disabled={parseFloat(product.stock) === 0}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 gap-2"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Adicionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Cart Sidebar */}
            <Card className="h-fit border-emerald-200 shadow-lg sticky top-4">
              <CardHeader className="pb-3 border-b border-emerald-100">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-emerald-600" />
                  Meu Carrinho
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Carrinho vazio</p>
                ) : (
                  <>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {cart.map(item => (
                        <div key={item.productId} className="p-3 bg-gray-50 rounded-lg space-y-2">
                          <div className="flex justify-between items-start">
                            <p className="font-medium text-sm">{item.product?.name}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.productId)}
                              className="h-6 w-6"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="h-6 w-6"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="h-6 w-6"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{formatCurrency(item.priceAtSale)}</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(item.priceAtSale * item.quantity)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-emerald-100 pt-3 space-y-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span className="text-emerald-600">{formatCurrency(total)}</span>
                      </div>
                      <Button
                        onClick={() => setStep('checkout')}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 gap-2 h-11"
                      >
                        <Package className="h-4 w-4" />
                        Finalizar Pedido
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'checkout' && (
          <div className="max-w-2xl mx-auto">
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle>Finalizar Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      placeholder="Seu nome"
                      value={formData.customerName}
                      onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                      className="border-emerald-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="+258 84 xxx xxxx"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                      className="border-emerald-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={formData.paymentMethod} onValueChange={(val: any) => setFormData({...formData, paymentMethod: val})}>
                    <SelectTrigger className="border-emerald-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">💵 Dinheiro (ao levantar)</SelectItem>
                      <SelectItem value="transfer">🏦 Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-emerald-50 p-4 rounded-lg space-y-2">
                  <p className="font-semibold">Resumo do Pedido:</p>
                  <div className="space-y-1 text-sm">
                    {cart.map(item => (
                      <div key={item.productId} className="flex justify-between">
                        <span>{item.product?.name} x {item.quantity}</span>
                        <span className="font-medium">{formatCurrency(item.priceAtSale * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-emerald-200 pt-2 flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-emerald-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('browse')}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={() => createOrderMutation.mutate()}
                    disabled={createOrderMutation.isPending}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {createOrderMutation.isPending ? 'Criando...' : 'Confirmar Pedido'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'tracking' && order && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <Check className="h-6 w-6 text-green-600" />
                  Pedido Confirmado!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-6 rounded-lg border-2 border-green-300 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Seu código de rastreamento:</p>
                  <p className="text-4xl font-bold text-emerald-600 tracking-wider font-mono">{order.orderCode}</p>
                  <p className="text-xs text-muted-foreground">Guarde este código para acompanhar seu pedido</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-emerald-100">
                    <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                    <p className="font-semibold">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-emerald-100">
                    <p className="text-xs text-muted-foreground mb-1">Total do Pedido</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(parseFloat(order.total))}</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900 mb-2">Status:</p>
                  <Badge className={`${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span className="ml-2">
                      {order.status === 'pending' && 'Aguardando Aprovação'}
                      {order.status === 'approved' && 'Aprovado'}
                      {order.status === 'cancelled' && 'Cancelado'}
                    </span>
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {order.status === 'pending' && 'Seu pedido foi recebido e está aguardando aprovação do lojista.'}
                    {order.status === 'approved' && 'Seu pedido foi aprovado! Você pode levantar seus produtos.'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setStep('browse'); setOrder(null); }}
                    className="flex-1"
                  >
                    Fazer Novo Pedido
                  </Button>
                  <Button
                    onClick={() => setLocation('/login')}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                  >
                    Ir para Login
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step !== 'tracking' && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-emerald-600" />
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">Já tem um código de rastreamento?</p>
                  <p className="text-muted-foreground">Clique abaixo para acompanhar seu pedido</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  placeholder="Digite seu código (ex: ABC12345)"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                  className="border-emerald-200"
                  maxLength={8}
                />
                <Button
                  onClick={() => trackOrderMutation.mutate()}
                  disabled={trackOrderMutation.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  Rastrear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
