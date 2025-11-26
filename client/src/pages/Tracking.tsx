import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Download, Search, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  createdAt: Date;
}

interface User {
  id: string;
  name: string;
  username: string;
}

export default function Tracking() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState(user?.id || '');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [startHour, setStartHour] = useState<number | undefined>();
  const [endHour, setEndHour] = useState<number | undefined>();
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Fetch all users for selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao buscar usuários');
      return res.json();
    }
  });

  const filterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/audit-logs/filter', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          startDate,
          endDate,
          startHour: startHour !== undefined ? startHour : undefined,
          endHour: endHour !== undefined ? endHour : undefined
        })
      });
      if (!res.ok) throw new Error('Erro ao filtrar logs');
      return res.json();
    },
    onSuccess: (data) => {
      setFilteredLogs(data);
      setShowResults(true);
      toast({ title: 'Sucesso', description: `${data.length} registros encontrados` });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/audit-logs/filter?format=csv', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          startDate,
          endDate,
          startHour: startHour !== undefined ? startHour : undefined,
          endHour: endHour !== undefined ? endHour : undefined
        })
      });
      if (!res.ok) throw new Error('Erro ao baixar arquivo');
      return res.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'Sucesso', description: 'Arquivo baixado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rastreamento & Auditoria</h1>
        <p className="text-muted-foreground">Visualize o histórico completo de ações dos usuários com filtros por data e hora</p>
      </div>

      {/* Filtros */}
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-600" />
            Filtrar Histórico
          </CardTitle>
          <CardDescription>Escolha o usuário e o intervalo de datas para consultar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seleção de Usuário */}
          <div>
            <label className="block text-sm font-medium mb-2">Usuário</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
              ))}
            </select>
          </div>

          {/* Data Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Data Inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Hora (Opcional) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Hora Inicial (Opcional)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={startHour !== undefined ? startHour : ''}
                onChange={(e) => setStartHour(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="00-23"
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hora Final (Opcional)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={endHour !== undefined ? endHour : ''}
                onChange={(e) => setEndHour(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="00-23"
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => filterMutation.mutate()}
              disabled={filterMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending || !showResults}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {showResults && (
        <Card className="border-emerald-100">
          <CardHeader>
            <CardTitle>Resultados ({filteredLogs.length} registros)</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum registro encontrado para o período selecionado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Data/Hora</th>
                      <th className="px-4 py-2 text-left font-semibold">Ação</th>
                      <th className="px-4 py-2 text-left font-semibold">Tipo</th>
                      <th className="px-4 py-2 text-left font-semibold">ID Entidade</th>
                      <th className="px-4 py-2 text-left font-semibold">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-emerald-600">{log.action}</td>
                        <td className="px-4 py-3 text-gray-600">{log.entityType}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{log.entityId || '-'}</td>
                        <td className="px-4 py-3 text-xs">
                          <details className="cursor-pointer">
                            <summary className="text-emerald-600 hover:underline">Ver detalhes</summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                              {JSON.stringify(log.details || {}, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
