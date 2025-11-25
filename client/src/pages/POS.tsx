import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, QrCode, AlertCircle, ShoppingBag, ArrowRight, Percent, Scale } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Product, productsApi, categoriesApi, salesApi } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export default function POS() {
  const { user } = useAuth();
  const { cart, addToCart, removeFromCart, updateCartQuantity, clearCart, getCartTotal } = useCart();
  const queryClient = useQueryClient();
  
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll
  });

  const createSaleMutation = useMutation({
    mutationFn: salesApi.create,
    onSuccess: () => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      toast({ 
        title: "Sucesso", 
        description: "Venda registrada com sucesso!" 
      });
      setCheckoutOpen(false);
      setActiveDiscount({ type: 'none', value: 0 });
      setAmountReceived(0);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [selectedWeightProduct, setSelectedWeightProduct] = useState<Product | null>(null);
  const [weightInGrams, setWeightInGrams] = useState(0);
  
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [activeDiscount, setActiveDiscount] = useState({ type: 'none', value: 0 });

  const canApplyDiscount = user?.role === 'admin' || user?.role === 'manager';

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const subtotal = cart.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
  
  let discountAmount = 0;
  if (activeDiscount.type === 'percentage') {
    discountAmount = subtotal * (activeDiscount.value / 100);
  } else if (activeDiscount.type === 'fixed') {
    discountAmount = activeDiscount.value;
  }

  const [amountReceived, setAmountReceived] = useState(0);
  
  const cartTotal = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, amountReceived - cartTotal);

  const cartCount = cart.reduce((acc, item) => acc + 1, 0);

  const handleApplyDiscount = () => {
    setActiveDiscount({ type: discountType, value: discountValue });
    setDiscountOpen(false);
  };
  
  const openCheckout = () => {
     setAmountReceived(0);
     setCheckoutOpen(true);
  }

  const handleQuantityChange = (productId: string, change: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    let step = 1;
    if (product.unit === 'kg') step = 0.1;

    const newQuantity = Math.max(0, Number((item.quantity + (change * step)).toFixed(3)));
    
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      if (change > 0) {
        const parsedStock = parseFloat(product.stock);
        if (parsedStock < newQuantity) {
           return;
        }
      }
      updateCartQuantity(productId, newQuantity);
    }
  };

  const handleAddProduct = (product: Product) => {
    if (product.unit === 'kg') {
      setSelectedWeightProduct(product);
      setWeightInGrams(0);
      setWeightOpen(true);
    } else {
      try {
        addToCart(product, 1);
        toast({ 
          title: "Adicionado", 
          description: `${product.name} adicionado ao carrinho` 
        });
      } catch (error: any) {
        toast({ 
          title: "Erro", 
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const confirmWeightAdd = () => {
    if (selectedWeightProduct && weightInGrams > 0) {
      const quantityInKg = weightInGrams / 1000;
      try {
        addToCart(selectedWeightProduct, quantityInKg);
        toast({ 
          title: "Adicionado", 
          description: `${selectedWeightProduct.name} (${weightInGrams}g) adicionado ao carrinho` 
        });
        setWeightOpen(false);
        setSelectedWeightProduct(null);
        setWeightInGrams(0);
      } catch (error: any) {
        toast({ 
          title: "Erro", 
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleCheckout = (method: 'cash' | 'card' | 'pix' | 'mpesa' | 'emola' | 'pos' | 'bank') => {
    if (cart.length === 0 || !user) return;

    createSaleMutation.mutate({
      userId: user.id,
      total: cartTotal.toString(),
      amountReceived: amountReceived > 0 ? amountReceived.toString() : undefined,
      change: change > 0 ? change.toString() : undefined,
      paymentMethod: method,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale
      }))
    });
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex flex-col min-w-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button 
              variant={selectedCategory === 'all' ? "default" : "outline"} 
              className="rounded-full text-xs h-8"
              onClick={() => setSelectedCategory('all')}
              data-testid="button-category-all"
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                className={`rounded-full text-xs h-8 ${selectedCategory === cat.id ? cat.color : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou código (SKU)..." 
              className="pl-9 bg-muted/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => {
              const parsedStock = parseFloat(product.stock);
              const parsedMinStock = parseFloat(product.minStock);
              const parsedPrice = parseFloat(product.price);

              return (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group ${parsedStock <= 0 ? 'opacity-60 pointer-events-none' : ''}`}
                  onClick={() => parsedStock > 0 && handleAddProduct(product)}
                  data-testid={`card-product-${product.id}`}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="aspect-square rounded-lg bg-muted/50 relative overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-8 w-8 opacity-20" />
                        </div>
                      )}
                      {parsedStock <= parsedMinStock && parsedStock > 0 && (
                        <Badge variant="destructive" className="absolute top-2 right-2 text-[10px] px-1.5 h-5">
                          Pouco Estoque
                        </Badge>
                      )}
                      {parsedStock <= 0 && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center font-bold text-destructive text-sm">
                          ESGOTADO
                        </div>
                      )}
                      {product.unit === 'kg' && (
                        <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] bg-white/90 backdrop-blur text-foreground border-none shadow-sm">
                          <Scale className="h-3 w-3 mr-1" /> Pesável
                        </Badge>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm leading-tight line-clamp-2 h-10">{product.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-bold text-primary">{formatCurrency(parsedPrice)}</span>
                        <span className="text-xs text-muted-foreground">/{product.unit}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Estoque: {parsedStock.toFixed(product.unit === 'kg' ? 3 : 0)} {product.unit}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="w-full lg:w-[400px] bg-card rounded-xl border border-border shadow-xl flex flex-col h-full">
        <div className="p-4 border-b border-border bg-primary/5">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Carrinho Atual
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="text-cart-count">{cartCount} itens adicionados</p>
        </div>

        <ScrollArea className="flex-1 p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-50">
              <ShoppingBag className="h-16 w-16" />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return null;
                return (
                  <div key={item.productId} className="flex gap-3 p-3 bg-muted/30 rounded-lg border border-transparent hover:border-border transition-colors" data-testid={`cart-item-${item.productId}`}>
                    <div className="h-12 w-12 rounded-md bg-white overflow-hidden shrink-0">
                       {product.image && <img src={product.image} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{product.name}</h4>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(item.priceAtSale)} x {item.quantity.toFixed(product.unit === 'kg' ? 3 : 0)}{product.unit}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-sm">{formatCurrency(item.priceAtSale * item.quantity)}</span>
                      <div className="flex items-center bg-background rounded-md border border-input h-7">
                        <button 
                          className="px-2 hover:bg-muted h-full flex items-center"
                          onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.productId, -1); }}
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-12 text-center text-xs font-medium tabular-nums">{item.quantity.toFixed(product.unit === 'kg' ? 3 : 0)}</span>
                        <button 
                          className="px-2 hover:bg-muted h-full flex items-center"
                          onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.productId, 1); }}
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border bg-muted/20 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                Descontos
                {canApplyDiscount && cart.length > 0 && (
                  <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" data-testid="button-open-discount">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Aplicar Desconto</DialogTitle>
                        <DialogDescription>Defina o valor ou porcentagem.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="flex gap-2">
                          <Button 
                            variant={discountType === 'percentage' ? 'default' : 'outline'} 
                            className="flex-1"
                            onClick={() => setDiscountType('percentage')}
                            data-testid="button-discount-percentage"
                          >
                            <Percent className="h-4 w-4 mr-2" /> % Porcentagem
                          </Button>
                          <Button 
                            variant={discountType === 'fixed' ? 'default' : 'outline'} 
                            className="flex-1"
                            onClick={() => setDiscountType('fixed')}
                            data-testid="button-discount-fixed"
                          >
                            <Banknote className="h-4 w-4 mr-2" /> MT Fixo
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          <Label>Valor do Desconto</Label>
                          <Input 
                            type="number" 
                            value={discountValue} 
                            onChange={(e) => setDiscountValue(Number(e.target.value))}
                            data-testid="input-discount-value"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleApplyDiscount} data-testid="button-apply-discount">Aplicar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </span>
              <span className="text-green-600" data-testid="text-discount">-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-primary pt-2 border-t border-border">
              <span>Total</span>
              <span data-testid="text-total">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <Button 
              variant="outline" 
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => clearCart()}
              disabled={cart.length === 0}
              data-testid="button-clear-cart"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button 
              className="w-full font-bold shadow-md shadow-primary/20" 
              disabled={cart.length === 0}
              onClick={openCheckout}
              data-testid="button-checkout"
            >
              Finalizar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Informar Peso (Gramas)</DialogTitle>
            <DialogDescription>
              Produto: {selectedWeightProduct?.name} ({formatCurrency(parseFloat(selectedWeightProduct?.price || '0'))}/kg)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => setWeightInGrams(100)} data-testid="button-weight-100">100g</Button>
              <Button variant="outline" onClick={() => setWeightInGrams(250)} data-testid="button-weight-250">250g</Button>
              <Button variant="outline" onClick={() => setWeightInGrams(500)} data-testid="button-weight-500">500g</Button>
              <Button variant="outline" onClick={() => setWeightInGrams(1000)} data-testid="button-weight-1000">1kg</Button>
            </div>
            <div className="grid gap-2">
              <Label>Peso Manual (g)</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={weightInGrams} 
                  onChange={(e) => setWeightInGrams(Number(e.target.value))}
                  className="pr-8"
                  data-testid="input-weight-grams"
                />
                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">g</span>
              </div>
            </div>
            <div className="bg-muted/30 p-3 rounded text-center">
              <p className="text-sm text-muted-foreground">Preço calculado</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(((parseFloat(selectedWeightProduct?.price || '0')) * weightInGrams) / 1000)}
              </p>
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setWeightOpen(false)} data-testid="button-cancel-weight">Cancelar</Button>
             <Button onClick={confirmWeightAdd} disabled={weightInGrams <= 0} data-testid="button-confirm-weight">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold">Finalizar Venda</DialogTitle>
            <DialogDescription>
              Revise os itens e escolha o método de pagamento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/10 h-[300px] overflow-y-auto">
                <h4 className="font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
                  <ShoppingBag className="h-4 w-4" /> Resumo do Pedido
                </h4>
                <div className="space-y-3">
                  {cart.map((item, idx) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <div key={idx} className="flex justify-between items-start text-sm border-b border-dashed border-border pb-2 last:border-0">
                        <div>
                           <p className="font-medium">{product?.name}</p>
                           <p className="text-xs text-muted-foreground">
                             {item.quantity.toFixed(product?.unit === 'kg' ? 3 : 0)}{product?.unit} x {formatCurrency(item.priceAtSale)}
                           </p>
                        </div>
                        <span className="font-bold">{formatCurrency(item.quantity * item.priceAtSale)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <span className="font-bold text-lg">Total a Pagar</span>
                  <span className="font-bold text-2xl text-primary">{formatCurrency(cartTotal)}</span>
                </div>
                
                <div className="p-4 bg-muted/20 rounded-lg border border-border space-y-3">
                   <div className="flex justify-between items-center">
                     <Label className="text-base">Valor Recebido</Label>
                     <div className="relative w-32">
                        <Input 
                          type="number" 
                          className="text-right pr-8 font-bold" 
                          value={amountReceived === 0 ? '' : amountReceived}
                          onChange={(e) => setAmountReceived(Number(e.target.value))}
                          placeholder="0,00"
                          data-testid="input-amount-received"
                        />
                        <span className="absolute right-3 top-2.5 text-muted-foreground text-xs">MZN</span>
                     </div>
                   </div>
                   {amountReceived > 0 && (
                     <div className="flex justify-between items-center pt-2 border-t border-border">
                       <span className="font-bold text-muted-foreground">Troco</span>
                       <span className={`font-bold text-xl ${change < 0 ? 'text-destructive' : 'text-green-600'}`} data-testid="text-change">
                         {formatCurrency(change)}
                       </span>
                     </div>
                   )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Método de Pagamento</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="flex flex-col h-20 gap-1 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('cash')}
                  disabled={amountReceived < cartTotal && amountReceived > 0}
                  data-testid="button-payment-cash"
                >
                  <Banknote className="h-5 w-5" />
                  Dinheiro
                </Button>
                <Button 
                  variant="outline" 
                  className="flex flex-col h-20 gap-1 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('card')}
                  data-testid="button-payment-card"
                >
                  <CreditCard className="h-5 w-5" />
                  Cartão (POS)
                </Button>
                <Button 
                  variant="outline" 
                  className="flex flex-col h-20 gap-1 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('pix')}
                  data-testid="button-payment-pix"
                >
                  <QrCode className="h-5 w-5" />
                  PIX / M-Pesa
                </Button>
                <Button 
                  variant="outline" 
                  className="flex flex-col h-20 gap-1 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('emola')}
                  data-testid="button-payment-emola"
                >
                  <CreditCard className="h-5 w-5" />
                  e-Mola
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
