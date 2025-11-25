import { useApp } from '@/lib/store';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, QrCode, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Product } from '@/lib/types';

export default function POS() {
  const { state, addToCart, removeFromCart, dispatch, checkout } = useApp();
  const { products, categories, cart } = state;
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  // Cart calculations
  const cartTotal = cart.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
  const cartCount = cart.reduce((acc, item) => acc + 1, 0); // Count unique items lines

  const handleQuantityChange = (productId: string, change: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;
    
    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      // Check stock limit for addition
      if (change > 0) {
        const product = products.find(p => p.id === productId);
        if (product && product.stock < newQuantity) {
          // Notification handled by store roughly, but let's just block here silently or rely on store toast
          return; 
        }
      }
      dispatch({ 
        type: 'UPDATE_CART_QUANTITY', 
        payload: { productId, quantity: newQuantity } 
      });
    }
  };

  const handleAddProduct = (product: Product) => {
    addToCart(product, 1);
  };

  const handleCheckout = (method: 'cash' | 'card' | 'pix') => {
    checkout(method);
    setCheckoutOpen(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
      {/* Left Side: Product Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button 
              variant={selectedCategory === 'all' ? "default" : "outline"} 
              className="rounded-full text-xs h-8"
              onClick={() => setSelectedCategory('all')}
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                className={`rounded-full text-xs h-8 ${selectedCategory === cat.id ? cat.color : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
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
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <Card 
                key={product.id} 
                className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group ${product.stock <= 0 ? 'opacity-60 pointer-events-none' : ''}`}
                onClick={() => product.stock > 0 && handleAddProduct(product)}
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
                    {product.stock <= product.minStock && product.stock > 0 && (
                      <Badge variant="destructive" className="absolute top-2 right-2 text-[10px] px-1.5 h-5">
                        Pouco Estoque
                      </Badge>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center font-bold text-destructive text-sm">
                        ESGOTADO
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 h-10">{product.name}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-primary">{formatCurrency(product.price)}</span>
                      <span className="text-xs text-muted-foreground">/{product.unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Estoque: {product.stock} {product.unit}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Side: Cart */}
      <div className="w-full lg:w-[400px] bg-card rounded-xl border border-border shadow-xl flex flex-col h-full">
        <div className="p-4 border-b border-border bg-primary/5">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Carrinho Atual
          </h2>
          <p className="text-sm text-muted-foreground">{cartCount} itens adicionados</p>
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
                  <div key={item.productId} className="flex gap-3 p-3 bg-muted/30 rounded-lg border border-transparent hover:border-border transition-colors">
                    <div className="h-12 w-12 rounded-md bg-white overflow-hidden shrink-0">
                       {product.image && <img src={product.image} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{product.name}</h4>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(item.priceAtSale)} x {item.quantity}{product.unit}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-sm">{formatCurrency(item.priceAtSale * item.quantity)}</span>
                      <div className="flex items-center bg-background rounded-md border border-input h-7">
                        <button 
                          className="px-2 hover:bg-muted h-full flex items-center"
                          onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.productId, -1); }}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                        <button 
                          className="px-2 hover:bg-muted h-full flex items-center"
                          onClick={(e) => { e.stopPropagation(); handleQuantityChange(item.productId, 1); }}
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
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Descontos</span>
              <span>R$ 0,00</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-primary pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <Button 
              variant="outline" 
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => dispatch({ type: 'CLEAR_CART' })}
              disabled={cart.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button 
              className="w-full font-bold shadow-md shadow-primary/20" 
              disabled={cart.length === 0}
              onClick={() => setCheckoutOpen(true)}
            >
              Finalizar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-bold text-center">Finalizar Venda</DialogTitle>
            <DialogDescription className="text-center">
              Confirme o valor total e escolha o método de pagamento.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 text-center space-y-2 bg-muted/30 rounded-lg my-2 border border-dashed border-primary/20">
            <p className="text-sm text-muted-foreground">Total a pagar</p>
            <p className="text-4xl font-bold text-primary tracking-tight">{formatCurrency(cartTotal)}</p>
            <p className="text-xs text-muted-foreground">{cartCount} itens no pedido</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
              onClick={() => handleCheckout('cash')}
            >
              <Banknote className="h-6 w-6" />
              Dinheiro
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
              onClick={() => handleCheckout('card')}
            >
              <CreditCard className="h-6 w-6" />
              Cartão
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
              onClick={() => handleCheckout('pix')}
            >
              <QrCode className="h-6 w-6" />
              PIX
            </Button>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
