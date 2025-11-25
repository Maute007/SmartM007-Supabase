import { useApp } from '@/lib/store';
import { useState, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, FileDown, FileUp, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Product, UnitType } from '@/lib/types';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

export default function Products() {
  const { state, dispatch } = useApp();
  const { products, categories } = state;
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock Add/Edit logic state (simplified for prototype)
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    sku: '',
    price: 0,
    stock: 0,
    unit: 'un',
    categoryId: '',
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(products);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "produtos.xlsx");
    toast({ title: "Sucesso", description: "Produtos exportados com sucesso!" });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      
      // Map excel data to product structure (simplified mapping)
      const importedProducts: Product[] = data.map((row: any, index) => ({
        id: `import-${Date.now()}-${index}`,
        name: row.name || row.Nome || 'Produto Importado',
        sku: row.sku || row.SKU || `IMP-${index}`,
        price: Number(row.price || row.Preço) || 0,
        costPrice: Number(row.costPrice || row.Custo) || 0,
        stock: Number(row.stock || row.Estoque) || 0,
        minStock: Number(row.minStock || row.Minimo) || 5,
        unit: (row.unit || row.Unidade || 'un') as UnitType,
        categoryId: 'cat1', // Default category
        image: ''
      }));

      dispatch({ type: 'IMPORT_PRODUCTS', payload: importedProducts });
      toast({ title: "Sucesso", description: `${importedProducts.length} produtos importados!` });
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveProduct = () => {
    if (!newProduct.name || !newProduct.price) return;
    
    const product: Product = {
      id: `p-${Date.now()}`,
      name: newProduct.name,
      sku: newProduct.sku || `SKU-${Date.now()}`,
      categoryId: newProduct.categoryId || categories[0].id,
      price: Number(newProduct.price),
      costPrice: 0, // Simplified
      stock: Number(newProduct.stock),
      minStock: 5,
      unit: newProduct.unit as UnitType || 'un',
      image: ''
    };

    dispatch({ type: 'ADD_PRODUCT', payload: product });
    setIsAddOpen(false);
    setNewProduct({ name: '', sku: '', price: 0, stock: 0, unit: 'un', categoryId: '' });
    toast({ title: "Sucesso", description: "Produto cadastrado!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu estoque e catálogo.</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
          <Button variant="outline" onClick={handleImportClick}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Produto</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nome do Produto</Label>
                  <Input 
                    value={newProduct.name} 
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Preço (R$)</Label>
                    <Input 
                      type="number" 
                      value={newProduct.price} 
                      onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidade</Label>
                    <Select 
                      value={newProduct.unit} 
                      onValueChange={(val: UnitType) => setNewProduct({...newProduct, unit: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">Unidade (un)</SelectItem>
                        <SelectItem value="kg">Quilograma (kg)</SelectItem>
                        <SelectItem value="g">Grama (g)</SelectItem>
                        <SelectItem value="pack">Pacote</SelectItem>
                        <SelectItem value="box">Caixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Estoque Inicial</Label>
                    <Input 
                      type="number" 
                      value={newProduct.stock} 
                      onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                    />
                  </div>
                   <div className="grid gap-2">
                    <Label>Categoria</Label>
                    <Select 
                      value={newProduct.categoryId} 
                      onValueChange={(val) => setNewProduct({...newProduct, categoryId: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button onClick={handleSaveProduct}>Salvar Produto</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-primary/10">
        <CardHeader className="pb-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar produtos..." 
              className="pl-9" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const category = categories.find(c => c.id === product.categoryId);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {product.stock <= product.minStock && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        {product.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={category?.color}>
                        {category?.name || 'Geral'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>
                      <span className={product.stock <= product.minStock ? "text-destructive font-bold" : ""}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell className="uppercase">{product.unit}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => dispatch({ type: 'DELETE_PRODUCT', payload: product.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
