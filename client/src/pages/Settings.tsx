import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, UserPlus, Lock, Eye, ShoppingCart, Package, Trash2, Edit, Plus, Users, Printer, Store, ImagePlus, Loader2, FolderOpen, FileText, Download, ExternalLink, Wifi, RefreshCw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { formatCurrency, cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, salesApi, productsApi, receiptSettingsApi, receiptsApi, networkApi, type ReceiptPaperSize, type ReceiptStoreBranding } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

function ReceiptFilesList() {
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['/api/receipts/list'],
    queryFn: receiptsApi.list,
  });

  const byFolder = files.reduce((acc, f) => {
    const folder = f.path.split('/').slice(0, -1).join('/') || '/';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(f);
    return acc;
  }, {} as Record<string, typeof files>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground rounded-lg border border-dashed">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum recibo guardado ainda.</p>
        <p className="text-sm mt-1">Os recibos são criados ao finalizar vendas com impressão ativa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-96 overflow-y-auto">
      {Object.entries(byFolder).sort().map(([folder, items]) => (
        <div key={folder} className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            {folder || 'raiz'}
          </p>
          <div className="space-y-1 pl-4 border-l-2 border-primary/20">
            {items.map((f) => (
              <div key={f.path} className="flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-muted/50 group">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">recibo-{f.saleId.slice(0, 8)}.html</p>
                  <p className="text-xs text-muted-foreground">
                    {f.createdAt ? new Date(f.createdAt).toLocaleString('pt-BR') : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={receiptsApi.getFileUrl(f.saleId)} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <ExternalLink className="h-4 w-4" title="Abrir" />
                    </Button>
                  </a>
                  <a href={receiptsApi.getFileUrl(f.saleId, true)} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Download className="h-4 w-4" title="Download" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-2 border-t">
        Cada recibo está vinculado a uma venda (ID). O histórico de vendas tem ligação direta a cada recibo.
      </p>
    </div>
  );
}

function NetworkAccessCard() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['/api/network/local-access'],
    queryFn: networkApi.getLocalAccess,
    refetchInterval: false,
    retry: 1,
  });

  return (
    <Card className="border-2 border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5 text-primary" /> Acesso na rede local</CardTitle>
        <p className="text-sm text-muted-foreground">
          IP dinâmico atual. Use este endereço no celular ou em outro dispositivo na mesma rede Wi‑Fi. Atualize sempre que o IP mudar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>A obter endereço...</span>
          </div>
        ) : data?.baseUrl ? (
          <>
            <div className="flex gap-2 items-center">
              <Input readOnly value={data.baseUrl} className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(data.baseUrl!);
                  toast({ title: 'Copiado!', description: 'Endereço copiado para a área de transferência.' });
                }}
              >
                Copiar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.ips.map((ip) => (
                <Badge key={ip} variant="secondary">{ip}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Abra este URL no navegador do celular para aceder ao sistema. O link do scanner é gerado automaticamente com o IP atual.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Não foi possível obter o IP da rede.</p>
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
          Atualizar IP
        </Button>
      </CardContent>
    </Card>
  );
}

function ReceiptBrandingForm({
  branding,
  onSave,
  isSaving,
}: {
  branding?: ReceiptStoreBranding;
  onSave: (b: ReceiptStoreBranding) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<ReceiptStoreBranding>({
    storeName: branding?.storeName ?? '',
    storeTagline: branding?.storeTagline ?? '',
    storeAddress: branding?.storeAddress ?? '',
    storePhone: branding?.storePhone ?? '',
    storeEmail: branding?.storeEmail ?? '',
    logoBase64: branding?.logoBase64 ?? '',
    footerText: branding?.footerText ?? 'Obrigado pela preferência!',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (branding != null) {
      setForm({
        storeName: branding.storeName ?? '',
        storeTagline: branding.storeTagline ?? '',
        storeAddress: branding.storeAddress ?? '',
        storePhone: branding.storePhone ?? '',
        storeEmail: branding.storeEmail ?? '',
        logoBase64: branding.logoBase64 ?? '',
        footerText: branding.footerText ?? 'Obrigado pela preferência!',
      });
    }
  }, [branding]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione uma imagem (PNG, JPG, etc.)' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Imagem muito grande. Use até 3MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((f) => ({ ...f, logoBase64: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => setForm((f) => ({ ...f, logoBase64: '' }));

  const handleSave = () => {
    onSave(form);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-6">
            <div className="h-36 w-36 min-h-[9rem] min-w-[9rem] rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30">
              {form.logoBase64 ? (
                <img src={form.logoBase64.startsWith('data:') ? form.logoBase64 : `data:image/png;base64,${form.logoBase64}`} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <ImagePlus className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Carregar logo
              </Button>
              {form.logoBase64 && (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={removeLogo}>
                  Remover
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">PNG ou JPG, máx. 3MB. Recomendado: quadrado, fundo transparente.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="storeName">Nome da Loja</Label>
          <Input
            id="storeName"
            placeholder="Ex: Mercearia do João"
            value={form.storeName}
            onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="storeTagline">Slogan ou Tagline</Label>
          <Input
            id="storeTagline"
            placeholder="Ex: Soluções em Negócios"
            value={form.storeTagline}
            onChange={(e) => setForm((f) => ({ ...f, storeTagline: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storePhone">Telefone</Label>
          <Input
            id="storePhone"
            placeholder="Ex: +258 84 123 4567"
            value={form.storePhone}
            onChange={(e) => setForm((f) => ({ ...f, storePhone: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="storeAddress">Endereço</Label>
        <Input
          id="storeAddress"
          placeholder="Ex: Av. Principal, 123 - Maputo"
          value={form.storeAddress}
          onChange={(e) => setForm((f) => ({ ...f, storeAddress: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="storeEmail">Email</Label>
          <Input
            id="storeEmail"
            type="email"
            placeholder="Ex: contacto@minhaloja.co.mz"
            value={form.storeEmail}
            onChange={(e) => setForm((f) => ({ ...f, storeEmail: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="footerText">Texto do rodapé</Label>
        <Textarea
          id="footerText"
          placeholder="Ex: Obrigado pela preferência!&#10;Volte sempre."
          value={form.footerText}
          onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
          rows={2}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">Use Enter para quebras de linha. Aparece no final do recibo.</p>
      </div>
      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salvar identidade da loja
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("users");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: receiptSettings, refetch: refetchReceiptSettings } = useQuery({
    queryKey: ['/api/settings/receipt'],
    queryFn: receiptSettingsApi.get
  });

  const updateReceiptMutation = useMutation({
    mutationFn: receiptSettingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings/receipt'] });
      toast({ title: "Sucesso", description: "Configurações de recibo salvas!" });
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Erro", description: error.message })
  });

  const [newUser, setNewUser] = useState({
    username: '',
    name: '',
    password: '',
    role: 'seller' as 'admin' | 'manager' | 'seller'
  });

  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsAddUserOpen(false);
      setNewUser({ username: '', name: '', password: '', role: 'seller' });
      toast({ title: "Sucesso", description: "Usuário criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditOpen(false);
      setEditingUser(null);
      toast({ title: "Sucesso", description: "Usuário atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setDeletingUserId(null);
      toast({ title: "Sucesso", description: "Usuário deletado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const [permissions, setPermissions] = useState({
    admin: { canEditProducts: true, canViewReports: true, canManageUsers: true, canSell: true, canDiscount: true },
    manager: { canEditProducts: true, canViewReports: true, canManageUsers: false, canSell: true, canDiscount: true },
    seller: { canEditProducts: false, canViewReports: false, canManageUsers: false, canSell: true, canDiscount: false },
  });

  const handlePermissionChange = (role: 'admin' | 'manager' | 'seller', key: string, value: boolean) => {
    setPermissions({
      ...permissions,
      [role]: { ...permissions[role as keyof typeof permissions], [key]: value }
    });
  };

  const handleSaveUser = () => {
    if (!newUser.username || !newUser.name || !newUser.password) {
      toast({ 
        title: "Erro", 
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (user?.role !== 'admin') {
      toast({ 
        title: "Acesso negado", 
        description: "Apenas administradores podem criar usuários",
        variant: "destructive"
      });
      return;
    }

    createUserMutation.mutate({
      username: newUser.username,
      name: newUser.name,
      password: newUser.password,
      role: newUser.role
    });
  };

  const isLoading = usersLoading || salesLoading || productsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Administração</h1>
          <p className="text-muted-foreground">Gerenciamento de usuários, permissões e auditoria.</p>
        </div>
      </div>

      <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2" data-testid="tab-users"><UserPlus className="h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2" data-testid="tab-permissions"><Shield className="h-4 w-4" /> Permissões</TabsTrigger>
          <TabsTrigger value="receipt" className="gap-2"><Printer className="h-4 w-4" /> Impressão</TabsTrigger>
          <TabsTrigger value="network" className="gap-2"><Wifi className="h-4 w-4" /> Rede</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
             <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-lg shadow-primary/20" disabled={user?.role !== 'admin'} data-testid="button-add-user">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Usuário</DialogTitle>
                  <DialogDescription>Crie um novo perfil de acesso ao sistema.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Nome Completo</Label>
                    <Input 
                      placeholder="Ex: João Silva" 
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      data-testid="input-user-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nome de Usuário</Label>
                    <Input 
                      placeholder="Ex: joao.silva" 
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      data-testid="input-username"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Senha</Label>
                    <Input 
                      type="password" 
                      placeholder="Senha inicial" 
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      data-testid="input-password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Função (Grupo)</Label>
                    <Select value={newUser.role} onValueChange={(val: any) => setNewUser({...newUser, role: val})}>
                      <SelectTrigger data-testid="select-user-role">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gestor</SelectItem>
                        <SelectItem value="seller">Vendedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveUser} disabled={createUserMutation.isPending} data-testid="button-save-user">
                    {createUserMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Usuários do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-bold">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {u.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {u.role === 'manager' ? 'Gestor' : u.role === 'seller' ? 'Vendedor' : 'Admin'}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="bg-green-100 text-green-800">Ativo</Badge></TableCell>
                      <TableCell className="text-right gap-2 flex justify-end">
                        <Dialog open={isEditOpen && editingUser?.id === u.id} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingUser(null); }}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => { setEditingUser({...u}); setIsEditOpen(true); }}
                            data-testid={`button-edit-user-${u.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Usuário: {editingUser?.name}</DialogTitle>
                            </DialogHeader>
                            {editingUser && (
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label>Nome Completo</Label>
                                  <Input 
                                    value={editingUser.name}
                                    onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                                    data-testid="input-edit-name"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Nome de Usuário</Label>
                                  <Input 
                                    value={editingUser.username}
                                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                                    data-testid="input-edit-username"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Nova Senha (deixe em branco para manter)</Label>
                                  <Input 
                                    type="password" 
                                    placeholder="Nova senha"
                                    onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                                    data-testid="input-edit-password"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Função</Label>
                                  <Select value={editingUser.role} onValueChange={(val) => setEditingUser({...editingUser, role: val})}>
                                    <SelectTrigger data-testid="select-edit-role">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Administrador</SelectItem>
                                      <SelectItem value="manager">Gestor</SelectItem>
                                      <SelectItem value="seller">Vendedor</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button onClick={() => updateUserMutation.mutate({ id: editingUser.id, data: editingUser })} disabled={updateUserMutation.isPending} data-testid="button-save-edit-user">
                                {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Dialog open={deletingUserId === u.id} onOpenChange={(open) => { if (!open) setDeletingUserId(null); }}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingUserId(u.id)}
                            data-testid={`button-delete-user-${u.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Confirmar Exclusão</DialogTitle>
                              <DialogDescription>
                                Tem certeza que deseja deletar o usuário "{u.name}"? Esta ação não pode ser desfeita.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setDeletingUserId(null)}>Cancelar</Button>
                              <Button variant="destructive" onClick={() => deleteUserMutation.mutate(u.id)} disabled={deleteUserMutation.isPending} data-testid="button-confirm-delete-user">
                                {deleteUserMutation.isPending ? 'Deletando...' : 'Deletar'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Acesso por Grupo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permissão</TableHead>
                    <TableHead className="text-center">Administrador</TableHead>
                    <TableHead className="text-center">Gestor</TableHead>
                    <TableHead className="text-center">Vendedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Editar Produtos</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canEditProducts} onCheckedChange={(c) => handlePermissionChange('admin', 'canEditProducts', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canEditProducts} onCheckedChange={(c) => handlePermissionChange('manager', 'canEditProducts', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canEditProducts} onCheckedChange={(c) => handlePermissionChange('seller', 'canEditProducts', !!c)} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Ver Relatórios Financeiros</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canViewReports} onCheckedChange={(c) => handlePermissionChange('admin', 'canViewReports', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canViewReports} onCheckedChange={(c) => handlePermissionChange('manager', 'canViewReports', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canViewReports} onCheckedChange={(c) => handlePermissionChange('seller', 'canViewReports', !!c)} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Gerenciar Usuários</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canManageUsers} onCheckedChange={(c) => handlePermissionChange('admin', 'canManageUsers', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canManageUsers} onCheckedChange={(c) => handlePermissionChange('manager', 'canManageUsers', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canManageUsers} onCheckedChange={(c) => handlePermissionChange('seller', 'canManageUsers', !!c)} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Aplicar Descontos no PDV</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canDiscount} onCheckedChange={(c) => handlePermissionChange('admin', 'canDiscount', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canDiscount} onCheckedChange={(c) => handlePermissionChange('manager', 'canDiscount', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canDiscount} onCheckedChange={(c) => handlePermissionChange('seller', 'canDiscount', !!c)} /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt" className="space-y-6">
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Identidade da Loja</CardTitle>
              <p className="text-sm text-muted-foreground">Configure logo, nome e informações que aparecem nos recibos. Deixe em branco para usar valores padrão.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <ReceiptBrandingForm
                key={receiptSettings ? 'ready' : 'loading'}
                branding={receiptSettings?.branding}
                onSave={(b) => updateReceiptMutation.mutate({ branding: b })}
                isSaving={updateReceiptMutation.isPending}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Impressão</CardTitle>
              <p className="text-sm text-muted-foreground">Tamanho do papel e preferências de impressão.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Tamanho do Papel</Label>
                <Select
                  value={receiptSettings?.paperSize ?? '80x80'}
                  onValueChange={(v: ReceiptPaperSize) => updateReceiptMutation.mutate({ paperSize: v })}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80x60">80 mm × 60 mm</SelectItem>
                    <SelectItem value="80x70">80 mm × 70 mm</SelectItem>
                    <SelectItem value="80x80">80 mm × 80 mm</SelectItem>
                    <SelectItem value="a6">A6 (105 mm × 148 mm) - Máximo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Tamanhos comuns para impressoras térmicas.</p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="printOnConfirm"
                  checked={receiptSettings?.printOnConfirm ?? false}
                  onCheckedChange={(c) => updateReceiptMutation.mutate({ printOnConfirm: !!c })}
                />
                <Label htmlFor="printOnConfirm" className="cursor-pointer">
                  Imprimir recibo automaticamente ao confirmar venda
                </Label>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium text-primary mb-2">Onde ficam os recibos?</p>
                <p className="text-muted-foreground">Pasta <code className="bg-muted px-1 rounded">receipts/</code> organizados por ano, mês e semana.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5 text-primary" /> Ficheiros de Recibos</CardTitle>
              <CardDescription>Lista de recibos guardados. Cada recibo está vinculado a uma venda no histórico — não é possível apagar um recibo sem a venda correspondente.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReceiptFilesList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-6">
          <NetworkAccessCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
