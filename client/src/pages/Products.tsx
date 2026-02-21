import { useAuth } from '@/lib/auth';
import { useState, useRef, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, FileDown, FileUp, AlertTriangle, Pencil, Trash2, AlertCircle, ArrowUp, FileSpreadsheet, Lightbulb, CheckCircle2, GitMerge, RefreshCw, ShieldCheck, Camera } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Product, productsApi, categoriesApi, systemApi } from '@/lib/api';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarcodeCameraScan } from '@/components/BarcodeCameraScan';

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', color: 'bg-blue-100 text-blue-800' });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll
  });

  const { data: editCount } = useQuery({
    queryKey: ['/api/system/edit-count'],
    queryFn: systemApi.getEditCount
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    costPrice: '',
    stock: '',
    unit: 'un' as 'un' | 'kg' | 'g' | 'pack' | 'box',
    categoryId: '',
    minStock: '5',
    image: '',
  });

  const createProductMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system/edit-count'] });
      setIsAddOpen(false);
      setNewProduct({ name: '', sku: '', barcode: '', price: '', costPrice: '', stock: '', unit: 'un', categoryId: '', minStock: '5', image: '' });
      toast({ title: "Sucesso", description: "Produto cadastrado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system/edit-count'] });
      toast({ title: "Sucesso", description: "Produto atualizado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "Sucesso", description: "Produto deletado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const [increaseStockOpen, setIncreaseStockOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [barcodeScanOpen, setBarcodeScanOpen] = useState<'add' | 'edit' | null>(null);
  const [increaseQuantity, setIncreaseQuantity] = useState('');
  const [increasePrice, setIncreasePrice] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const increaseStockMutation = useMutation({
    mutationFn: ({ id, quantity, price }: { id: string; quantity: number; price?: number }) => 
      productsApi.increaseStock(id, quantity, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIncreaseStockOpen(false);
      setIncreaseQuantity('');
      setIncreasePrice('');
      toast({ title: "Sucesso", description: "Estoque e preço atualizados!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: (createdCategory) => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setNewProduct({...newProduct, categoryId: createdCategory.id});
      setIsCategoryDialogOpen(false);
      setNewCategory({ name: '', color: 'bg-blue-100 text-blue-800' });
      toast({ title: "Sucesso", description: "Categoria criada!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  // Modelo oficial — nomes de colunas reconhecidos pelo importador
  const UNIT_OPTIONS = ['un', 'kg', 'g', 'pack', 'box'] as const;
  // Variações aceites na coluna Unidade (mapeia para o sistema)
  const UNIT_ALIASES: Record<string, string> = {
    un: 'un', unidade: 'un', unidades: 'un', unit: 'un', pç: 'un', pcs: 'un', peça: 'un', peças: 'un',
    kg: 'kg', quilograma: 'kg', quilogramas: 'kg', quilo: 'kg', quilos: 'kg', kilograma: 'kg',
    g: 'g', grama: 'g', gramas: 'g', gr: 'g',
    pack: 'pack', pacote: 'pack', pacotes: 'pack', pct: 'pack',
    box: 'box', caixa: 'box', caixas: 'box', cx: 'box',
  };

  const handleExportTemplate = () => {
    const exportData = products.length > 0
      ? products.map(p => ({
          Nome: p.name,
          SKU: p.sku,
          Preço: parseFloat(p.price),
          Custo: parseFloat(p.costPrice),
          Estoque: parseFloat(p.stock),
          Mínimo: parseFloat(p.minStock),
          Unidade: p.unit,
          Categoria: categories.find(c => c.id === p.categoryId)?.name || ''
        }))
      : [{
          Nome: 'Exemplo: Arroz 5kg',
          SKU: 'ARR-001',
          Preço: 250,
          Custo: 180,
          Estoque: 50,
          Mínimo: 10,
          Unidade: 'kg',
          Categoria: categories[0]?.name || 'Geral',
        }];
    const instrucoes = [
      { Campo: 'Unidade - Valores aceites:', Exemplo: 'un, kg, g, pack, box' },
      { Campo: 'Ou em português:', Exemplo: 'unidade, quilograma, grama, pacote, caixa' },
      { Campo: 'Abreviações:', Exemplo: 'pç, pct, cx, gr' },
    ];
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wsInstrucoes = XLSX.utils.json_to_sheet(instrucoes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Produtos');
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Unidades aceites');
    XLSX.writeFile(wb, products.length > 0 ? 'produtos_modelo.xlsx' : 'modelo_importacao_produtos.xlsx');
    toast({
      title: 'Modelo exportado',
      description: products.length > 0 ? 'Edite e importe para atualizar.' : 'Preencha os dados e importe no sistema.',
    });
  };

  const handleExport = () => {
    const exportData = products.map(p => ({
      Nome: p.name,
      SKU: p.sku,
      Preço: parseFloat(p.price),
      Custo: parseFloat(p.costPrice),
      Estoque: parseFloat(p.stock),
      Minimo: parseFloat(p.minStock),
      Unidade: p.unit,
      Categoria: categories.find(c => c.id === p.categoryId)?.name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "produtos.xlsx");
    toast({ title: "Sucesso", description: "Produtos exportados com sucesso!" });
  };

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<Record<string, any>> | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [importMode, setImportMode] = useState<'merge' | 'reset'>('merge');
  const [needsAgreePulse, setNeedsAgreePulse] = useState(false);
  const [importAgreeMerge, setImportAgreeMerge] = useState(false);
  const [importAgreeReset, setImportAgreeReset] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const parseRowToProduct = (row: any, index: number) => {
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return null;
    };
    const name = getVal(['Nome', 'name', 'nome']) || `Produto ${index + 1}`;
    const sku = getVal(['SKU', 'sku', 'codigo']) || `IMP-${Date.now()}-${index}`;
    const priceRaw = getVal(['Preço', 'Preco', 'price', 'preco']);
    const price = priceRaw != null ? String(priceRaw) : '';
    const costPriceRaw = getVal(['Custo', 'Custo', 'costPrice', 'custo']);
    const costPrice = costPriceRaw != null ? String(costPriceRaw) : '';
    const stockRaw = getVal(['Estoque', 'stock', 'estoque']);
    const stock = stockRaw != null ? String(stockRaw) : '';
    const minStockRaw = getVal(['Mínimo', 'Minimo', 'minStock', 'minimo']);
    const minStock = minStockRaw != null ? String(minStockRaw) : '';
    const unitRaw = String(getVal(['Unidade', 'unit', 'unidade']) ?? 'un').trim().toLowerCase();
    const unit = UNIT_ALIASES[unitRaw] || (UNIT_OPTIONS.includes(unitRaw as any) ? unitRaw : 'un');
    const categoryName = getVal(['Categoria', 'category', 'categoria']);
    const categoryId = categories.find(c => c.name === categoryName)?.id || categories[0]?.id || null;
    return { name: String(name), sku: String(sku), price, costPrice, stock, minStock, unit, categoryId, image: '' };
  };

  const catKey = (id: string | null | undefined) => id ?? '_';
  const matchKeyFull = (p: { name: string; unit: string; price: string; categoryId?: string | null }) =>
    `${String(p.name ?? '').trim().toLowerCase()}|${p.unit}|${parseFloat(String(p.price ?? 0))}|${catKey(p.categoryId)}`;
  const matchKeyMerge = (p: { name: string; unit: string; categoryId?: string | null }) =>
    `${String(p.name ?? '').trim().toLowerCase()}|${p.unit}|${catKey(p.categoryId)}`;

  const importStats = useMemo(() => {
    if (!importPreview?.length) return { toAdd: 0, toUpdate: 0, toRemove: 0 };
    if (importMode === 'merge') {
      const dbKeysMerge = new Set(products.map(p => matchKeyMerge({ name: p.name, unit: p.unit, categoryId: p.categoryId })));
      let toAdd = 0, toUpdate = 0;
      for (const p of importPreview) {
        const k = matchKeyMerge({ name: String(p.name ?? ''), unit: String(p.unit ?? 'un'), categoryId: p.categoryId });
        if (dbKeysMerge.has(k)) toUpdate++;
        else toAdd++;
      }
      return { toAdd, toUpdate, toRemove: 0 };
    }
    const fileKeysFull = new Set(importPreview.map(p => matchKeyFull({ name: String(p.name ?? ''), unit: String(p.unit ?? 'un'), price: String(p.price ?? 0), categoryId: p.categoryId })));
    const dbKeysFull = new Set(products.map(p => matchKeyFull({ name: p.name, unit: p.unit, price: p.price, categoryId: p.categoryId })));
    let toAdd = 0, toUpdate = 0;
    for (const p of importPreview) {
      const k = matchKeyFull({ name: String(p.name ?? ''), unit: String(p.unit ?? 'un'), price: String(p.price ?? 0), categoryId: p.categoryId });
      if (dbKeysFull.has(k)) toUpdate++;
      else toAdd++;
    }
    const toRemove = products.filter(p => !fileKeysFull.has(matchKeyFull({ name: p.name, unit: p.unit, price: p.price, categoryId: p.categoryId }))).length;
    return { toAdd, toUpdate, toRemove };
  }, [importPreview, products, importMode]);

  const importMutation = useMutation({
    mutationFn: (data: { products: any[]; mode: 'merge' | 'reset' }) => productsApi.import(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/audit-logs/recent-imports'] });
      setIsImportDialogOpen(false);
      setImportPreview(null);
      setImportFile(null);
      setImportAgreeMerge(false);
      setImportAgreeReset(false);
      setShowResetConfirmModal(false);
      const desc = [result.added > 0 && `${result.added} adicionados`, result.updated > 0 && `${result.updated} atualizados`, result.removed > 0 && `${result.removed} removidos`].filter(Boolean).join(', ') || 'Concluído';
      toast({
        title: 'Importação concluída',
        description: `${desc}. Consulte Relatórios → Importações para ver o detalhe.`,
      });
    },
    onError: (e: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    },
  });

  const handleImportClick = () => {
    setIsImportDialogOpen(true);
    setImportPreview(null);
    setImportFile(null);
    setImportStep('upload');
    setImportMode('merge');
    setImportAgreeMerge(false);
    setImportAgreeReset(false);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      const preview = data.map((row, i) => parseRowToProduct(row, i));
      setImportPreview(preview);
      setImportFile(file);
      setImportStep('preview');
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!importPreview || importPreview.length === 0) return;
    if (importMode === 'merge') {
      if (!importAgreeMerge) {
        setNeedsAgreePulse(true);
        toast({ variant: 'destructive', title: 'Confirme', description: 'Marque que leu e concorda com os efeitos.' });
        return;
      }
      setNeedsAgreePulse(false);
      runImport();
    } else {
      if (!importAgreeReset) {
        setNeedsAgreePulse(true);
        toast({ variant: 'destructive', title: 'Confirme', description: 'Marque que concorda em substituir os produtos.' });
        return;
      }
      setNeedsAgreePulse(false);
      setShowResetConfirmModal(true);
    }
  };

  const runImport = () => {
    if (!importPreview?.length) return;
    const payload = importPreview.map(p => ({
      name: p.name,
      sku: p.sku,
      price: p.price ?? '',
      costPrice: p.costPrice ?? '',
      stock: p.stock ?? '',
      minStock: p.minStock ?? '',
      unit: p.unit,
      categoryId: p.categoryId,
      image: p.image || '',
    }));
    importMutation.mutate({ products: payload, mode: importMode });
  };

  const handleSaveProduct = () => {
    if (!newProduct.name || !newProduct.price) {
      toast({ 
        title: "Erro", 
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editCount && !editCount.canEdit) {
      toast({ 
        title: "Limite atingido", 
        description: `Você atingiu o limite de ${editCount.limit} edições diárias`,
        variant: "destructive"
      });
      return;
    }
    
    const sku = newProduct.sku?.trim() || newProduct.barcode?.trim() || `SKU-${Date.now()}`;
    createProductMutation.mutate({
      name: newProduct.name,
      sku,
      ...(newProduct.barcode?.trim() && { barcode: newProduct.barcode.trim() }),
      categoryId: newProduct.categoryId || categories[0]?.id || null,
      price: newProduct.price,
      costPrice: newProduct.costPrice || '0',
      stock: newProduct.stock || '0',
      minStock: newProduct.minStock || '5',
      unit: newProduct.unit,
      image: newProduct.image || ''
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Tem certeza que deseja deletar este produto?')) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingProduct || !editingProduct.name || !editingProduct.price) {
      toast({ 
        title: "Erro", 
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editCount && !editCount.canEdit) {
      toast({ 
        title: "Limite atingido", 
        description: `Você atingiu o limite de ${editCount.limit} edições diárias`,
        variant: "destructive"
      });
      return;
    }

    updateProductMutation.mutate({
      id: editingProduct.id,
      data: {
        name: editingProduct.name,
        sku: editingProduct.sku,
        barcode: editingProduct.barcode || undefined,
        price: editingProduct.price,
        costPrice: editingProduct.costPrice,
        stock: editingProduct.stock,
        minStock: editingProduct.minStock,
        unit: editingProduct.unit,
        categoryId: editingProduct.categoryId,
        image: editingProduct.image
      }
    });
    setIsEditOpen(false);
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu estoque e catálogo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportTemplate} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Modelo
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={handleImportClick} data-testid="button-import" className="gap-2">
                <FileUp className="h-4 w-4" />
                Importar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="import-dialog-desc">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-primary" />
                  Importar Produtos
                </DialogTitle>
                <DialogDescription id="import-dialog-desc" className="sr-only">
                  Importe produtos a partir de um ficheiro Excel (.xlsx). Escolha o modo (Adicionar/atualizar ou Substituir tudo) e confirme que leu os efeitos antes de prosseguir.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {importStep === 'upload' && (
                  <>
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Recomendado: use o modelo do sistema</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Para garantir que os dados sejam reconhecidos, baixe o modelo, preencha com seus produtos e importe. 
                            O sistema reconhece automaticamente as colunas e ajusta os valores.
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleExportTemplate} className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Baixar modelo
                      </Button>
                      <div className="mt-2 pt-2 border-t border-primary/20">
                        <p className="text-xs font-medium text-muted-foreground">Coluna Unidade — valores aceites:</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <strong>un</strong> (unidade), <strong>kg</strong> (quilograma), <strong>g</strong> (grama), <strong>pack</strong> (pacote), <strong>box</strong> (caixa). 
                          Também aceita: unidade, quilograma, pacote, caixa, pç, pct, cx, gr.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>1. Baixou o modelo? Preencheu os dados?</Label>
                      <Label className="text-muted-foreground font-normal">2. Selecione o ficheiro Excel (.xlsx) para importar</Label>
                      <div
                        className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/10'); }}
                        onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/10'); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
                          const f = e.dataTransfer.files[0];
                          if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const wb = XLSX.read(ev.target?.result, { type: 'binary' });
                              const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
                              setImportPreview(data.map((r, i) => parseRowToProduct(r, i)));
                              setImportFile(f);
                              setImportStep('preview');
                            };
                            reader.readAsBinaryString(f);
                          }
                        }}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelected}
                          className="hidden"
                          accept=".xlsx,.xls"
                        />
                        <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm font-medium">Arraste o ficheiro ou clique para selecionar</p>
                        <p className="text-xs text-muted-foreground mt-1">Formatos: .xlsx, .xls</p>
                        <Button
                          variant="secondary"
                          className="mt-4"
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        >
                          Escolher ficheiro
                        </Button>
                      </div>
                    </div>
                  </>
                )}
                {importStep === 'preview' && importPreview && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Ficheiro carregado: {importFile?.name}</span>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-semibold text-foreground">Modo de importação — escolha com atenção</Label>
                      <RadioGroup value={importMode} onValueChange={(v: 'merge' | 'reset') => { setImportMode(v); setNeedsAgreePulse(false); }}>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label
                            htmlFor="merge"
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all hover:border-primary/50 ${importMode === 'merge' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-muted/20'}`}
                          >
                            <RadioGroupItem value="merge" id="merge" className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 font-semibold text-foreground">
                                <GitMerge className="h-5 w-5 text-primary" />
                                Adicionar/atualizar (Merge)
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Soma stock nos existentes, cria novos. Nada é eliminado.
                              </p>
                            </div>
                          </label>
                          <label
                            htmlFor="reset"
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all hover:border-destructive/50 ${importMode === 'reset' ? 'border-destructive bg-destructive/5 shadow-sm' : 'border-border bg-muted/20'}`}
                          >
                            <RadioGroupItem value="reset" id="reset" className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 font-semibold text-foreground">
                                <RefreshCw className="h-5 w-5 text-destructive" />
                                Substituir tudo (Reset)
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Ficheiro = fonte única. Produtos ausentes são eliminados.
                              </p>
                            </div>
                          </label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                      <p className="text-sm font-medium">Resumo previsto:</p>
                      <p className="text-sm text-muted-foreground">
                        {importStats.toAdd} a adicionar · {importStats.toUpdate} a atualizar
                        {importMode === 'reset' && importStats.toRemove > 0 && (
                          <span className="text-destructive font-medium"> · {importStats.toRemove} a eliminar</span>
                        )}
                      </p>
                    </div>

                    {importMode === 'merge' && (
                      <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription>
                          Produtos existentes (nome + unidade + categoria) são encontrados e actualizados. Deixe em branco os campos que não pretende alterar — ex.: só preço? Deixe Estoque vazio. Novos produtos serão criados. Nada será eliminado.
                        </AlertDescription>
                      </Alert>
                    )}
                    {importMode === 'reset' && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Atenção: produtos na base de dados que não estiverem no ficheiro serão eliminados. O ficheiro passa a ser a única fonte de verdade.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div
                      className={`rounded-xl border-2 p-4 transition-colors ${
                        needsAgreePulse
                          ? 'border-accent bg-accent/10 animate-agree-pulse'
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={importMode === 'merge' ? 'agree-merge' : 'agree-reset'}
                          checked={importMode === 'merge' ? importAgreeMerge : importAgreeReset}
                          onCheckedChange={(c) => {
                            const v = !!c;
                            if (importMode === 'merge') setImportAgreeMerge(v);
                            else setImportAgreeReset(v);
                            if (v) setNeedsAgreePulse(false);
                          }}
                          className="mt-0.5 h-5 w-5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={`h-5 w-5 shrink-0 ${needsAgreePulse ? 'text-accent' : 'text-primary'}`} />
                            <Label
                              htmlFor={importMode === 'merge' ? 'agree-merge' : 'agree-reset'}
                              className="cursor-pointer text-base font-semibold text-foreground"
                            >
                              Li e concordo — obrigatório para continuar
                            </Label>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {importMode === 'merge'
                              ? 'Li e concordo que os produtos existentes terão o stock somado e novos serão criados. Nada será eliminado.'
                              : 'Concordo que vou substituir todos os produtos pelos do ficheiro. Produtos ausentes no ficheiro serão eliminados.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border overflow-x-auto max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Estoque</TableHead>
                            <TableHead>Categoria</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.slice(0, 10).map((p, i) => (
                            <TableRow key={i}>
                              <TableCell>{i + 1}</TableCell>
                              <TableCell>{p.name}</TableCell>
                              <TableCell>{p.sku}</TableCell>
                              <TableCell>{formatCurrency(parseFloat(p.price))}</TableCell>
                              <TableCell>{p.stock}</TableCell>
                              <TableCell>{categories.find(c => c.id === p.categoryId)?.name || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {importPreview.length > 10 && (
                      <p className="text-sm text-muted-foreground">... e mais {importPreview.length - 10} produtos</p>
                    )}
                    {importPreview.some(p => !p.name?.trim()) && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Alguns produtos sem nome serão importados como "Produto 1", "Produto 2", etc.
                        </AlertDescription>
                      </Alert>
                    )}
                    <p className="text-sm font-medium">{importPreview.length} produtos prontos para importar</p>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setImportStep('upload'); setImportPreview(null); setNeedsAgreePulse(false); }}>
                        Voltar
                      </Button>
                      <Button onClick={handleConfirmImport} disabled={importMutation.isPending}>
                        Confirmar importação
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog open={showResetConfirmModal} onOpenChange={setShowResetConfirmModal}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem a certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acção irá eliminar {importStats.toRemove} produtos da base de dados. Não pode ser revertida.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={runImport}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sim, confirmo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" onClick={handleExport} data-testid="button-export" className="gap-2">
            <FileDown className="h-4 w-4" />
            Exportar
          </Button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20" data-testid="button-add-product">
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>Adicionar Produto</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {editCount && !editCount.canEdit && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Você atingiu o limite de {editCount.limit} edições diárias. Você já fez {editCount.count} edições hoje.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Nome do Produto</Label>
                    <Input 
                      value={newProduct.name} 
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                      data-testid="input-product-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Código (SKU ou Código de Barras)</Label>
                    <Input 
                      value={newProduct.sku} 
                      onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                      placeholder="Código interno ou EAN — gerado automaticamente se vazio"
                      data-testid="input-product-sku"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Código de Barras (opcional — escanear ou digitar)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={newProduct.barcode} 
                      onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                      placeholder="EAN-13, UPC — ou use o botão para escanear"
                      data-testid="input-product-barcode"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setBarcodeScanOpen('add')}
                      title="Escanear código de barras"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Pode registar barcode, SKU ou ambos. Se vazio, o sistema gera automaticamente — ambos servem para venda com scanner.</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Preço Venda (MT)</Label>
                    <Input 
                      type="number" 
                      value={newProduct.price} 
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                      data-testid="input-product-price"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Preço Custo (MT)</Label>
                    <Input 
                      type="number" 
                      value={newProduct.costPrice} 
                      onChange={e => setNewProduct({...newProduct, costPrice: e.target.value})}
                      data-testid="input-product-cost"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidade</Label>
                    <Select 
                      value={newProduct.unit} 
                      onValueChange={(val: any) => setNewProduct({...newProduct, unit: val})}
                    >
                      <SelectTrigger data-testid="select-product-unit">
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
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Estoque Inicial</Label>
                    <Input 
                      type="number" 
                      value={newProduct.stock} 
                      onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                      data-testid="input-product-stock"
                    />
                  </div>
                   <div className="grid gap-2">
                    <Label>Estoque Mínimo (Alerta)</Label>
                    <Input 
                      type="number" 
                      value={newProduct.minStock} 
                      onChange={e => setNewProduct({...newProduct, minStock: e.target.value})}
                      data-testid="input-product-minstock"
                    />
                  </div>
                   <div className="grid gap-2">
                    <Label>Categoria</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={newProduct.categoryId} 
                        onValueChange={(val) => setNewProduct({...newProduct, categoryId: val})}
                      >
                        <SelectTrigger data-testid="select-product-category" className="flex-1">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" type="button">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
                          <DialogHeader>
                            <DialogTitle>Nova Categoria</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Nome da Categoria</Label>
                              <Input 
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                placeholder="Ex: Bebidas, Limpeza..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Cor da Categoria</Label>
                              <Select 
                                value={newCategory.color}
                                onValueChange={(val) => setNewCategory({...newCategory, color: val})}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bg-blue-100 text-blue-800">Azul</SelectItem>
                                  <SelectItem value="bg-green-100 text-green-800">Verde</SelectItem>
                                  <SelectItem value="bg-yellow-100 text-yellow-800">Amarelo</SelectItem>
                                  <SelectItem value="bg-red-100 text-red-800">Vermelho</SelectItem>
                                  <SelectItem value="bg-purple-100 text-purple-800">Roxo</SelectItem>
                                  <SelectItem value="bg-orange-100 text-orange-800">Laranja</SelectItem>
                                  <SelectItem value="bg-pink-100 text-pink-800">Rosa</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button 
                            onClick={() => createCategoryMutation.mutate(newCategory)}
                            disabled={!newCategory.name || createCategoryMutation.isPending}
                          >
                            {createCategoryMutation.isPending ? 'Criando...' : 'Criar Categoria'}
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>URL da Imagem (Opcional)</Label>
                  <Input 
                    value={newProduct.image} 
                    onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                    placeholder="https://exemplo.com/imagem.jpg"
                    data-testid="input-product-image"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se não adicionar uma imagem, será exibida a primeira letra do nome do produto.
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleSaveProduct} 
                disabled={createProductMutation.isPending || (editCount && !editCount.canEdit)}
                data-testid="button-save-product"
              >
                {createProductMutation.isPending ? 'Salvando...' : 'Salvar Produto'}
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={!!barcodeScanOpen} onOpenChange={(o) => !o && setBarcodeScanOpen(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ler código de barras</DialogTitle>
                <DialogDescription>
                  Capte uma foto do código. O sistema converte em escala cinza e extrai o código para você verificar.
                </DialogDescription>
              </DialogHeader>
              <BarcodeCameraScan
                id="products-barcode-scan"
                onScan={(code) => {
                  if (barcodeScanOpen === 'add') {
                    setNewProduct(p => ({ ...p, barcode: code, sku: p.sku || code }));
                  } else if (barcodeScanOpen === 'edit' && editingProduct) {
                    setEditingProduct({ ...editingProduct, barcode: code });
                  }
                  setBarcodeScanOpen(null);
                }}
                onClose={() => setBarcodeScanOpen(null)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {editCount && editCount.count > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você fez {editCount.count} de {editCount.limit} edições permitidas hoje.
            {!editCount.canEdit && ' Limite atingido!'}
          </AlertDescription>
        </Alert>
      )}

      {/* Modal de Edição de Produtos */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Nome do Produto</Label>
                  <Input 
                    value={editingProduct.name} 
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                    data-testid="input-edit-product-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Código (SKU)</Label>
                  <Input 
                    value={editingProduct.sku} 
                    onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})}
                    data-testid="input-edit-product-sku"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Código de Barras (opcional)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={editingProduct.barcode || ''} 
                    onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value})}
                    placeholder="EAN-13, UPC — ou use o botão para escanear"
                    data-testid="input-edit-product-barcode"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setBarcodeScanOpen('edit')}
                    title="Escanear código de barras"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Preço Venda (MT)</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.price} 
                    onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                    data-testid="input-edit-product-price"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Preço Custo (MT)</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.costPrice} 
                    onChange={e => setEditingProduct({...editingProduct, costPrice: e.target.value})}
                    data-testid="input-edit-product-cost"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Estoque</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.stock} 
                    onChange={e => setEditingProduct({...editingProduct, stock: e.target.value})}
                    data-testid="input-edit-product-stock"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Estoque Mínimo</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.minStock} 
                    onChange={e => setEditingProduct({...editingProduct, minStock: e.target.value})}
                    data-testid="input-edit-product-minstock"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unidade</Label>
                  <Select value={editingProduct.unit} onValueChange={(val) => setEditingProduct({...editingProduct, unit: val as any})}>
                    <SelectTrigger data-testid="select-edit-product-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Un (Unidade)</SelectItem>
                      <SelectItem value="kg">Kg (Quilograma)</SelectItem>
                      <SelectItem value="g">g (Grama)</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select 
                  value={editingProduct.categoryId || ''} 
                  onValueChange={(val) => setEditingProduct({...editingProduct, categoryId: val})}
                >
                  <SelectTrigger data-testid="select-edit-product-category">
                    <SelectValue placeholder="Selecione categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>URL da Imagem (Opcional)</Label>
                <Input 
                  value={editingProduct.image || ''} 
                  onChange={e => setEditingProduct({...editingProduct, image: e.target.value})}
                  placeholder="https://exemplo.com/imagem.jpg"
                  data-testid="input-edit-product-image"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateProductMutation.isPending}
              data-testid="button-save-edit-product"
            >
              {updateProductMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-primary/10">
        <CardHeader className="pb-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar produtos..." 
              className="pl-9" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
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
                const parsedStock = parseFloat(product.stock);
                const parsedMinStock = parseFloat(product.minStock);

                return (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover border border-border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-border">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {parsedStock <= parsedMinStock && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                            {product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={category?.color}>
                        {category?.name || 'Geral'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatCurrency(parseFloat(product.price))}</span>
                        <span className="text-[10px] text-muted-foreground">Custo: {formatCurrency(parseFloat(product.costPrice))}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={parsedStock <= parsedMinStock ? "text-destructive font-bold" : ""}>
                        {parsedStock}
                      </span>
                    </TableCell>
                    <TableCell className="uppercase">{product.unit}</TableCell>
                    <TableCell className="text-right flex gap-2 justify-end">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEditProduct(product)}
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Pencil className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Dialog open={increaseStockOpen && selectedProductId === product.id} onOpenChange={(open) => { setIncreaseStockOpen(open); if (!open) setSelectedProductId(''); }}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => { setSelectedProductId(product.id); setIncreaseStockOpen(true); }}
                          data-testid={`button-increase-stock-${product.id}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <DialogContent aria-describedby={undefined}>
                          <DialogHeader>
                            <DialogTitle>Aumentar Estoque: {product.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                              <Label>Quantidade a Adicionar</Label>
                              <Input 
                                type="number" 
                                placeholder="Ex: 10"
                                value={increaseQuantity}
                                onChange={(e) => setIncreaseQuantity(e.target.value)}
                                data-testid="input-increase-quantity"
                              />
                              <p className="text-xs text-muted-foreground">
                                Estoque atual: {parsedStock} {product.unit}
                              </p>
                            </div>
                            <div className="grid gap-2">
                              <Label>Novo Preço (Opcional)</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                placeholder={formatCurrency(parseFloat(product.price))}
                                value={increasePrice}
                                onChange={(e) => setIncreasePrice(e.target.value)}
                                data-testid="input-increase-price"
                              />
                              <p className="text-xs text-muted-foreground">
                                Preço atual: {formatCurrency(parseFloat(product.price))}
                              </p>
                            </div>
                            <Button 
                              onClick={() => increaseStockMutation.mutate({ 
                                id: product.id, 
                                quantity: parseFloat(increaseQuantity),
                                price: increasePrice ? parseFloat(increasePrice) : undefined
                              })}
                              disabled={increaseStockMutation.isPending || !increaseQuantity}
                              className="w-full"
                              data-testid="button-save-increase-stock"
                            >
                              {increaseStockMutation.isPending ? 'Atualizando...' : 'Aumentar Estoque'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                        data-testid={`button-delete-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
