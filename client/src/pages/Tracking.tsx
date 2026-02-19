import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatAuditLog } from '@/lib/auditFormat';

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
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();

  const [startDate, setStartDate] = useState(lastWeek);
  const [endDate, setEndDate] = useState(today);
  const [startHour, setStartHour] = useState<number | undefined>();
  const [endHour, setEndHour] = useState<number | undefined>();

  const maxStartHour = startDate === today ? currentHour : 23;
  const maxEndHour = endDate === today ? currentHour : 23;
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
                max={today}
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartDate(v);
                  if (v > endDate) setEndDate(v);
                }}
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data Final</label>
              <input
                type="date"
                min={startDate}
                max={today}
                value={endDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setEndDate(v);
                  if (v < startDate) setStartDate(v);
                }}
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Hora (Opcional) — não permite horas futuras */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Hora Inicial (opcional)</label>
              <input
                type="number"
                min={0}
                max={maxStartHour}
                value={startHour !== undefined ? startHour : ''}
                onChange={(e) => {
                  const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
                  setStartHour(v != null && !isNaN(v) ? Math.min(Math.max(0, v), maxStartHour) : undefined);
                }}
                placeholder={`0–${maxStartHour}`}
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {startDate === today && <p className="text-xs text-muted-foreground mt-1">Máx. {currentHour}h (agora)</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hora Final (opcional)</label>
              <input
                type="number"
                min={startHour ?? 0}
                max={maxEndHour}
                value={endHour !== undefined ? endHour : ''}
                onChange={(e) => {
                  const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
                  setEndHour(v != null && !isNaN(v) ? Math.min(Math.max(startHour ?? 0, v), maxEndHour) : undefined);
                }}
                placeholder={`0–${maxEndHour}`}
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {endDate === today && <p className="text-xs text-muted-foreground mt-1">Máx. {currentHour}h (agora)</p>}
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
        <Card>
          <CardHeader>
            <CardTitle>Resultados ({filteredLogs.length} registros)</CardTitle>
            <CardDescription>Histórico de atividades em linguagem clara</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">Nenhum registro encontrado para o período selecionado</p>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  const fmt = formatAuditLog(log.action, log.entityType ?? '', log.details);
                  const logUser = users.find(u => u.id === log.userId);
                  return (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="sm:w-40 shrink-0 text-sm text-muted-foreground">
                        {format(new Date(log.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{fmt.actionLabel}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {fmt.summary}
                        </p>
                        {fmt.detailsText && (
                          <p className="text-xs text-muted-foreground mt-1">{fmt.detailsText}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-sm text-muted-foreground">
                        por {logUser?.name ?? 'Sistema'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
