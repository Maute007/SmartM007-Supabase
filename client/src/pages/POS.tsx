import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useState, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, QrCode, AlertCircle, ShoppingBag, ArrowRight, Percent, Scale, Check, LayoutGrid, List, Printer } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Product, productsApi, categoriesApi, salesApi, receiptSettingsApi } from '@/lib/api';
import { useReceiptPrint } from '@/hooks/useReceiptPrint';
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

  const { data: receiptSettings } = useQuery({
    queryKey: ['/api/settings/receipt'],
    queryFn: () => receiptSettingsApi.get().catch(() => ({ paperSize: '80x80' as const, printOnConfirm: false }))
  });

  const { printAndSaveReceipt } = useReceiptPrint();

  const createSaleMutation = useMutation({
    mutationFn: salesApi.create,
    onSuccess: async (newSale) => {
      const shouldPrint = printReceiptRef.current;
      if (shouldPrint && newSale?.id) {
        try {
          await printAndSaveReceipt(newSale.id);
          toast({ title: "Sucesso", description: "Venda registrada! Recibo impresso e guardado." });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro ao imprimir/guardar recibo";
          toast({ variant: "destructive", title: "Aviso", description: `Venda registrada. ${msg}` });
        }
      } else {
        toast({ title: "Sucesso", description: "Venda registrada com sucesso!" });
      }
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'pix' | 'mpesa' | 'emola' | 'pos' | 'bank' | null>(null);
  const [showPreviewConfirm, setShowPreviewConfirm] = useState(false);
  
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [activeDiscount, setActiveDiscount] = useState({ type: 'none', value: 0 });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [printReceiptOnConfirm, setPrintReceiptOnConfirm] = useState(false);
  const printReceiptRef = useRef(false);

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
    if (method === 'cash' && amountReceived < cartTotal) {
      toast({ title: "Erro", description: "Valor insuficiente para completar a venda", variant: "destructive" });
      return;
    }
    setPrintReceiptOnConfirm(receiptSettings?.printOnConfirm ?? false);
    setSelectedPaymentMethod(method);
    setShowPreviewConfirm(true);
  };

  const handleConfirmPreview = () => {
    printReceiptRef.current = printReceiptOnConfirm;
    setShowPreviewConfirm(false);
    confirmSale();
  };

  const confirmSale = () => {
    if (cart.length === 0 || !user || !selectedPaymentMethod) return;

    createSaleMutation.mutate({
      userId: user.id,
      total: cartTotal.toString(),
      amountReceived: amountReceived > 0 ? amountReceived.toString() : undefined,
      change: change > 0 ? change.toString() : undefined,
      paymentMethod: selectedPaymentMethod,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale
      })),
      preview: {
        items: cart.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            productName: product?.name || '',
            productUnit: product?.unit || ''
          };
        }),
        subtotal,
        discount: activeDiscount,
        discountAmount,
        total: cartTotal,
        paymentMethod: selectedPaymentMethod,
        amountReceived: amountReceived > 0 ? amountReceived : undefined,
        change: change > 0 ? change : undefined
      }
    });
    setConfirmOpen(false);
    setSelectedPaymentMethod(null);
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
    <div className="h-[calc(100dvh-4rem)] md:h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-3 lg:gap-6 p-3 lg:p-4">
      {/* MOBILE: Tabs Produtos / Carrinho */}
      <div className="lg:hidden shrink-0">
        <div className="flex gap-2">
          <Button 
            variant="outline"
            className="flex-1 h-12 rounded-xl border-2 font-semibold"
            onClick={() => setSelectedCategory(cart.length > 0 ? 'all' : selectedCategory)}
            data-testid="button-tab-produtos"
          >
            <ShoppingBag className="h-5 w-5 mr-2" />
            Produtos
          </Button>
          {cart.length > 0 && (
            <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="default"
                  className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 shadow-lg font-semibold"
                  data-testid="button-tab-carrinho"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Carrinho ({cartCount})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Carrinho ({cart.length})</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-3 py-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Carrinho vazio</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {cart.map((item) => {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) return null;
                        return (
                          <div key={item.productId} className="p-4 bg-gradient-to-r from-emerald-50 to-orange-50 rounded-lg border-2 border-orange-200 shadow-sm">
                            <div className="flex gap-4 mb-3">
                              <div className="h-20 w-20 rounded-md overflow-hidden shrink-0 flex items-center justify-center border-2 border-orange-200">
                                {product.image ? (
                                  <img src={product.image} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 font-bold text-2xl">
                                    {product.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="text-base font-bold text-gray-800">{product.name}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <span className="font-bold text-orange-600 text-lg">{formatCurrency(item.priceAtSale)}</span>
                                </p>
                                <p className="text-sm font-semibold text-orange-600 mt-2">
                                  Total: {formatCurrency(item.priceAtSale * item.quantity)}
                                </p>
                              </div>
                            </div>
                            
                            <div className="bg-white rounded-lg p-3 border border-orange-100">
                              <p className="text-xs text-muted-foreground mb-3">Editar Quantidade ({product.unit})</p>
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <button 
                                  className="h-12 px-4 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-md active:scale-95"
                                  onClick={() => handleQuantityChange(item.productId, -1)}
                                  data-testid={`button-decrease-mobile-${item.productId}`}
                                >
                                  <Minus className="h-6 w-6" />
                                </button>
                                <Input
                                  type="number"
                                  step={product.unit === 'kg' ? '0.1' : product.unit === 'g' ? '1' : '1'}
                                  value={item.quantity.toFixed(product.unit === 'kg' ? 1 : product.unit === 'g' ? 0 : 0)}
                                  onChange={(e) => {
                                    const newQty = parseFloat(e.target.value) || 0;
                                    if (newQty > 0) {
                                      updateCartQuantity(item.productId, newQty);
                                    }
                                  }}
                                  className="flex-1 h-12 text-center text-xl font-bold border-2 border-orange-300 bg-orange-50 text-orange-600"
                                  data-testid={`input-quantity-${item.productId}`}
                                />
                                <button 
                                  className="h-12 px-4 flex items-center justify-center rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold transition-colors shadow-md active:scale-95"
                                  onClick={() => handleQuantityChange(item.productId, 1)}
                                  data-testid={`button-increase-mobile-${item.productId}`}
                                >
                                  <Plus className="h-6 w-6" />
                                </button>
                              </div>
                              <button 
                                className="w-full h-10 flex items-center justify-center rounded-lg bg-red-100 hover:bg-red-200 text-red-600 font-bold transition-colors border border-red-300 active:scale-95"
                                onClick={() => removeFromCart(item.productId)}
                                data-testid={`button-remove-mobile-${item.productId}`}
                              >
                                <Trash2 className="h-5 w-5 mr-2" /> Remover
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="border-t pt-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      {activeDiscount.type !== 'none' && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Desconto</span>
                          <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total</span>
                        <span className="text-orange-600">{formatCurrency(cartTotal)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={() => clearCart()} data-testid="button-clear-mobile">
                        <Trash2 className="h-4 w-4 mr-2" /> Limpar
                      </Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setCheckoutOpen(false); openCheckout(); }} data-testid="button-checkout-mobile">
                        Finalizar <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Produtos - Desktop sempre, Mobile em aba */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden lg:block">
        <div className="p-3 lg:p-4 border-b border-border space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button 
              variant={selectedCategory === 'all' ? "default" : "outline"} 
              className="rounded-full text-xs h-8 flex-shrink-0"
              onClick={() => setSelectedCategory('all')}
              data-testid="button-category-all"
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                className={`rounded-full text-xs h-8 flex-shrink-0 ${selectedCategory === cat.id ? cat.color : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome ou código..." 
                className="pl-9 bg-muted/30 text-sm h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-products"
              />
            </div>
            <div className="hidden sm:flex border rounded-md shrink-0">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
                className="rounded-r-none"
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-l-none"
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className={cn("flex-1 p-3 lg:p-4", cart.length > 0 && "pb-24")}>
          {viewMode === 'list' ? (
            <div className="space-y-2">
              {filteredProducts.map(product => {
                const parsedStock = parseFloat(product.stock);
                const parsedMinStock = parseFloat(product.minStock);
                const parsedPrice = parseFloat(product.price);

                const isLowStock = parsedStock > 0 && parsedStock <= parsedMinStock;
                return (
                  <div 
                    key={product.id} 
                    className={`flex items-center gap-3 p-3 sm:p-3 rounded-xl border cursor-pointer transition-all min-h-[72px] lg:min-h-0 ${parsedStock <= 0 ? 'opacity-50 pointer-events-none bg-card' : isLowStock ? 'bg-amber-50/80 border-amber-300 hover:border-amber-400 hover:shadow-amber-200/50 hover:shadow-md active:scale-[0.99] ring-1 ring-amber-200/50' : 'bg-card hover:border-primary/50 hover:shadow-md active:scale-[0.99]'}`}
                    onClick={() => parsedStock > 0 && handleAddProduct(product)}
                    data-testid={`card-product-${product.id}`}
                  >
                    <div className={`h-14 w-14 rounded-lg flex items-center justify-center shrink-0 border relative overflow-hidden ${isLowStock ? 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200/50'}`}>
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-emerald-600 text-xl font-bold">
                          {product.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {parsedStock <= 0 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">Esgotado</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm leading-tight truncate">{product.name}</h3>
                        <span className="font-bold text-orange-600 text-base shrink-0">{formatCurrency(parsedPrice)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5">{product.unit}</Badge>
                        {product.unit === 'kg' && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            <Scale className="h-3 w-3 mr-1" /> Pesável
                          </Badge>
                        )}
                        {isLowStock && (
                          <Badge className="text-[10px] h-5 bg-amber-600 text-white animate-pulse">⚠ Estoque baixo</Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          Est: {parsedStock.toFixed(product.unit === 'kg' ? 3 : 0)}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="default"
                      className="shrink-0 h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (parsedStock > 0) handleAddProduct(product);
                      }}
                      disabled={parsedStock <= 0}
                      data-testid={`button-add-${product.id}`}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
              {filteredProducts.map(product => {
                const parsedStock = parseFloat(product.stock);
                const parsedMinStock = parseFloat(product.minStock);
                const parsedPrice = parseFloat(product.price);

                const isLowStock = parsedStock > 0 && parsedStock <= parsedMinStock;
                return (
                  <Card 
                    key={product.id} 
                    className={`cursor-pointer transition-all group rounded-lg ${parsedStock <= 0 ? 'opacity-50 pointer-events-none' : isLowStock ? 'bg-amber-50/90 border-amber-300 hover:border-amber-400 hover:shadow-amber-200/60 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 ring-1 ring-amber-200' : 'hover:shadow-lg hover:border-primary/50 hover:scale-105 hover:-translate-y-1'}`}
                    onClick={() => parsedStock > 0 && handleAddProduct(product)}
                    data-testid={`card-product-${product.id}`}
                  >
                    <CardContent className="p-2 lg:p-3 space-y-2">
                      <div className={`aspect-square rounded-lg relative overflow-hidden border ${isLowStock ? 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200/50'}`}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-emerald-600 text-4xl lg:text-5xl font-bold bg-emerald-50">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isLowStock && (
                          <Badge className="absolute top-2 right-2 text-[10px] px-1.5 h-5 bg-amber-600 text-white shadow-md">
                            ⚠ Baixo
                          </Badge>
                        )}
                        {parsedStock <= 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                            <span className="text-white font-bold text-sm">Sem Estoque</span>
                          </div>
                        )}
                        {product.unit === 'kg' && (
                          <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] bg-white/90 backdrop-blur text-foreground border-none shadow-sm">
                            <Scale className="h-3 w-3 mr-1" /> Pesável
                          </Badge>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-xs lg:text-sm leading-tight line-clamp-2 text-gray-800">{product.name}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-bold text-orange-600 text-sm lg:text-base">{formatCurrency(parsedPrice)}</span>
                          <Badge variant="outline" className="text-[10px]">{product.unit}</Badge>
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                          Est: {parsedStock.toFixed(product.unit === 'kg' ? 3 : 0)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* MOBILE: Barra inferior fixa com resumo do carrinho */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{cartCount} {cartCount === 1 ? 'item' : 'itens'}</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(cartTotal)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => clearCart()} className="shrink-0">
                Limpar
              </Button>
              <Button className="bg-primary shrink-0 font-semibold px-6" onClick={() => { setCheckoutOpen(true); openCheckout(); }}>
                Finalizar <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:flex w-full lg:w-[420px] bg-gradient-to-b from-orange-50 to-orange-100/50 rounded-xl border border-orange-200 shadow-2xl flex-col h-full">
        <div className="p-4 border-b border-orange-200 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-xl">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2 text-white">
            <ShoppingCart className="h-5 w-5" />
            Carrinho ({cartCount})
          </h2>
          <p className="text-sm text-orange-100" data-testid="text-cart-count">{cart.length} itens · {formatCurrency(cartTotal)}</p>
        </div>

        <ScrollArea className="flex-1 p-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-40">
              <ShoppingBag className="h-16 w-16 text-orange-400" />
              <p className="font-semibold">Carrinho Vazio</p>
              <p className="text-xs">Clique em um produto para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return null;
                return (
                  <div key={item.productId} className="flex gap-3 p-3 bg-gradient-to-r from-emerald-50 to-orange-50 rounded-lg border border-orange-100 hover:border-orange-300 transition-all hover:shadow-md" data-testid={`cart-item-${item.productId}`}>
                    <div className="h-14 w-14 rounded-md overflow-hidden shrink-0 flex items-center justify-center border border-orange-200">
                       {product.image ? (
                         <img src={product.image} alt="" className="h-full w-full object-cover" />
                       ) : (
                         <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 font-bold text-lg">
                           {product.name.charAt(0).toUpperCase()}
                         </div>
                       )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-800 truncate">{product.name}</h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold text-orange-600">{formatCurrency(item.priceAtSale)}</span> × {item.quantity.toFixed(product.unit === 'kg' ? 3 : 0)}{product.unit}
                      </div>
                      <div className="flex gap-1 mt-2">
                        <button 
                          className="px-2 h-7 flex items-center rounded border border-orange-200 bg-white hover:bg-orange-50 transition-colors"
                          onClick={() => handleQuantityChange(item.productId, -1)}
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="h-4 w-4 text-orange-600" />
                        </button>
                        <span className="px-2 h-7 flex items-center rounded border border-gray-200 bg-gray-50 text-xs font-bold">
                          {item.quantity.toFixed(product.unit === 'kg' ? 3 : 0)}
                        </span>
                        <button 
                          className="px-2 h-7 flex items-center rounded border border-orange-200 bg-white hover:bg-orange-50 transition-colors"
                          onClick={() => handleQuantityChange(item.productId, 1)}
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="h-4 w-4 text-orange-600" />
                        </button>
                        <button 
                          className="px-2 h-7 flex items-center rounded border border-red-200 bg-white hover:bg-red-50 transition-colors"
                          onClick={() => removeFromCart(item.productId)}
                          data-testid={`button-remove-${item.productId}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right min-w-fit">
                      <p className="font-bold text-orange-600 text-sm">{formatCurrency(item.priceAtSale * item.quantity)}</p>
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

      {/* Modal de Preview antes de Confirmar */}
      <Dialog open={showPreviewConfirm} onOpenChange={setShowPreviewConfirm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold">Revisar Venda</DialogTitle>
            <DialogDescription>Verifique todos os detalhes antes de confirmar</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Itens */}
            <div className="border rounded-lg p-4 bg-muted/5">
              <h4 className="font-bold mb-3 text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Itens ({cart.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map((item, idx) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <div key={idx} className="flex justify-between items-center p-2 bg-background rounded border border-border text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{product?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity.toFixed(product?.unit === 'kg' ? 3 : 0)} {product?.unit} × {formatCurrency(item.priceAtSale)}
                        </p>
                      </div>
                      <span className="font-bold">{formatCurrency(item.quantity * item.priceAtSale)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="border rounded-lg p-4 bg-muted/5 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {activeDiscount.type !== 'none' && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto ({activeDiscount.type === 'percentage' ? `${activeDiscount.value}%` : 'Fixo'})</span>
                  <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                <span>Total a Pagar</span>
                <span className="text-primary">{formatCurrency(cartTotal)}</span>
              </div>
            </div>

            {/* Imprimir recibo - destaque profissional */}
            <div className={cn(
              "rounded-xl p-4 flex items-center gap-4 transition-all",
              printReceiptOnConfirm
                ? "bg-primary/15 border-2 border-primary shadow-md shadow-primary/10"
                : "bg-primary/5 border-2 border-primary/30 hover:border-primary/50"
            )}>
              <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                printReceiptOnConfirm ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <Printer className="h-6 w-6" />
              </div>
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <Checkbox
                  id="print-receipt"
                  checked={printReceiptOnConfirm}
                  onCheckedChange={(v) => setPrintReceiptOnConfirm(v === true)}
                  className="h-5 w-5 rounded-md border-2 data-[state=checked]:bg-primary"
                />
                <span className="text-base font-semibold">Imprimir recibo ao confirmar</span>
              </label>
            </div>

            {/* Método e Pagamento */}
            <div className="border rounded-lg p-4 bg-muted/5 space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Método de Pagamento</p>
                <p className="font-bold text-lg capitalize">{selectedPaymentMethod?.replace('-', ' ')}</p>
              </div>
              {selectedPaymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Valor Recebido</span>
                    <span className="font-medium">{formatCurrency(amountReceived)}</span>
                  </div>
                  <div className={`flex justify-between text-sm font-bold ${change >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    <span>Troco</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setShowPreviewConfirm(false)}
              className="w-full"
            >
              Voltar ao Carrinho
            </Button>
            <Button 
              onClick={handleConfirmPreview}
              className="w-full bg-green-600 hover:bg-green-700 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar e Pagar
            </Button>
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
