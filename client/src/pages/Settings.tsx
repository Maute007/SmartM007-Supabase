import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usersApi, User } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';

export function EditUserForm({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const [formData, setFormData] = useState({
    name: user.name,
    username: user.username,
    role: user.role,
    password: ''
  });

  const updateMutation = useMutation({
    mutationFn: (data) => usersApi.update(user.id, data),
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Usuário atualizado!" });
      onSuccess();
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.username) {
      toast({
        title: "Erro",
        description: "Nome e usuário são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const data: any = {
      name: formData.name,
      username: formData.username,
      role: formData.role
    };

    if (formData.password) {
      data.password = formData.password;
    }

    updateMutation.mutate(data);
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-2">
        <Label>Nome Completo</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          data-testid="input-edit-user-name"
        />
      </div>
      <div className="grid gap-2">
        <Label>Nome de Usuário</Label>
        <Input
          value={formData.username}
          onChange={(e) => setFormData({...formData, username: e.target.value})}
          data-testid="input-edit-username"
        />
      </div>
      <div className="grid gap-2">
        <Label>Nova Senha (deixe em branco para não alterar)</Label>
        <Input
          type="password"
          placeholder="Deixe em branco para manter senha atual"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          data-testid="input-edit-password"
        />
      </div>
      <div className="grid gap-2">
        <Label>Função</Label>
        <Select value={formData.role} onValueChange={(val: any) => setFormData({...formData, role: val})}>
          <SelectTrigger data-testid="select-edit-user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="manager">Gestor</SelectItem>
            <SelectItem value="seller">Vendedor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleSubmit} disabled={updateMutation.isPending} className="w-full">
        {updateMutation.isPending ? 'Atualizando...' : 'Atualizar'}
      </Button>
    </div>
  );
}
