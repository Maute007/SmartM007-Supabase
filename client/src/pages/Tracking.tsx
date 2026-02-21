import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Download, Search, ChevronDown, ChevronUp, AlertTriangle, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatAuditLog } from '@/lib/auditFormat';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: number;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: any;
  previousSnapshot?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  riskFlags?: string[] | null;
  createdAt: Date;
}

interface User {
  id: string;
  name: string;
  username: string;
}

const SENSITIVE_ACTIONS = ['DELETE_PRODUCT', 'DELETE_USER', 'DELETE_CATEGORY', 'SALE_RETURN', 'LOGIN_FAILED'];
const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'anomalies', label: 'Anomalias (com risk flags)' },
  { value: 'CREATE_PRODUCT', label: 'Produto adicionado' },
  { value: 'UPDATE_PRODUCT', label: 'Produto atualizado' },
  { value: 'DELETE_PRODUCT', label: 'Produto removido' },
  { value: 'INCREASE_STOCK', label: 'Estoque aumentado' },
  { value: 'CREATE_SALE', label: 'Venda' },
  { value: 'SALE_RETURN', label: 'Devolução' },
  { value: 'PRODUCT_IMPORT', label: 'Importação' },
  { value: 'CREATE_USER', label: 'Usuário criado' },
  { value: 'UPDATE_USER', label: 'Usuário atualizado' },
  { value: 'DELETE_USER', label: 'Usuário removido' },
  { value: 'APPROVE_ORDER', label: 'Pedido aprovado' },
  { value: 'CANCEL_ORDER', label: 'Pedido cancelado' },
  { value: 'LOGIN_SUCCESS', label: 'Login (sucesso)' },
  { value: 'LOGIN_FAILED', label: 'Login (falha)' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'RECEIPT_SETTINGS_UPDATED', label: 'Config. recibo' },
  { value: 'RECEIPT_VIEWED', label: 'Recibo visualizado' },
  { value: 'RECEIPT_ACCESS_DENIED', label: 'Acesso recibo negado' },
];

const ITEMS_PER_PAGE = 20;

export default function Tracking() {
  const { user } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();

  const [startDate, setStartDate] = useState(lastWeek);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [page, setPage] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const maxTimeToday = `${String(currentHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const startHour = startTime ? parseInt(startTime.split(':')[0], 10) : undefined;
  const endHour = endTime ? parseInt(endTime.split(':')[0], 10) : undefined;
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [showResults, setShowResults] = useState(false);

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
          userId: selectedUserId === 'all' ? 'all' : selectedUserId,
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
      setPage(0);
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
          userId: selectedUserId === 'all' ? 'all' : selectedUserId,
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

  const filteredByAction = actionFilter === 'all'
    ? filteredLogs
    : actionFilter === 'anomalies'
      ? filteredLogs.filter(l => Array.isArray(l.riskFlags) && l.riskFlags.length > 0)
      : filteredLogs.filter(l => l.action === actionFilter);
  const paginatedLogs = filteredByAction.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredByAction.length / ITEMS_PER_PAGE);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="border-l-4 border-amber-500 pl-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-amber-600" />
          Rastreamento & Auditoria
        </h1>
        <p className="text-muted-foreground mt-1">
          Histórico completo para identificar anomalias, rastrear ações e detectar possíveis burlas. Todos os eventos ficam registados.
        </p>
      </div>

      <Card className="border-amber-200/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-amber-600" />
            Filtrar Histórico
          </CardTitle>
          <CardDescription>Filtros por usuário, data, hora e tipo de acção para análise forense</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Usuário</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">Todos os usuários</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de acção</label>
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {ACTION_FILTER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hora Inicial (opcional)</label>
              <input
                type="time"
                max={startDate === endDate && endTime ? endTime : startDate === today ? maxTimeToday : undefined}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hora Final (opcional)</label>
              <input
                type="time"
                min={startDate === endDate && startTime ? startTime : undefined}
                max={endDate === today ? maxTimeToday : undefined}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => filterMutation.mutate()}
              disabled={filterMutation.isPending}
              className="flex-1 bg-amber-600 hover:bg-amber-700 gap-2"
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

      {showResults && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Resultados ({filteredByAction.length} registros)</CardTitle>
                <CardDescription>ID, timestamp, autor, acção, entidade e detalhes. Expanda para ver JSON completo.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Pág. {page + 1} / {totalPages || 1}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {paginatedLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">Nenhum registro encontrado</p>
            ) : (
              <div className="space-y-3">
                {paginatedLogs.map((log) => {
                  const fmt = formatAuditLog(log.action, log.entityType ?? '', log.details);
                  const logUser = users.find(u => u.id === log.userId);
                  const isSensitive = SENSITIVE_ACTIONS.includes(log.action);
                  const isExpanded = expandedIds.has(log.id);
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "rounded-xl border overflow-hidden transition-all",
                        isSensitive ? "border-amber-300/60 bg-amber-50/30" : "bg-card"
                      )}
                    >
                      <div
                        className="flex flex-col gap-3 p-4 cursor-pointer hover:bg-muted/20"
                        onClick={() => toggleExpand(log.id)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">#{log.id}</span>
                            <span className="text-sm font-mono text-muted-foreground">
                              {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </span>
                            {isSensitive && (
                              <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Sensível
                              </Badge>
                            )}
                            {Array.isArray(log.riskFlags) && log.riskFlags.length > 0 && (
                              <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Risco ({log.riskFlags.join(', ')})
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{logUser?.name ?? (log.userId ?? 'Sistema')}</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                          <p className="font-semibold text-foreground">{fmt.actionLabel}</p>
                          <p className="text-sm text-muted-foreground">{fmt.summary}</p>
                        </div>
                        {(log.entityId || log.action) && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {log.entityId && (
                              <span className="font-mono bg-muted px-2 py-0.5 rounded">Entidade: {log.entityId.slice(0, 8)}…</span>
                            )}
                            <span className="font-mono bg-muted px-2 py-0.5 rounded">{log.action}</span>
                          </div>
                        )}
                        {fmt.detailsText && (
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans max-h-32 overflow-y-auto bg-muted/50 p-2 rounded">
                            {fmt.detailsText}
                          </pre>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="border-t bg-slate-900 text-slate-100 p-4 space-y-3">
                          {(log.ipAddress || log.userAgent || (Array.isArray(log.riskFlags) && log.riskFlags.length > 0) || log.previousSnapshot) && (
                            <div className="space-y-2">
                              {log.ipAddress != null && log.ipAddress !== '' && (
                                <p className="text-xs"><span className="text-slate-400">IP:</span> {log.ipAddress}</p>
                              )}
                              {log.userAgent != null && log.userAgent !== '' && (
                                <p className="text-xs"><span className="text-slate-400">User-Agent:</span> {log.userAgent}</p>
                              )}
                              {Array.isArray(log.riskFlags) && log.riskFlags.length > 0 && (
                                <p className="text-xs"><span className="text-slate-400">Risk flags:</span> {log.riskFlags.join(', ')}</p>
                              )}
                              {log.previousSnapshot != null && (
                                <div>
                                  <p className="text-xs font-medium text-slate-300 mb-1">Estado anterior (previous_snapshot)</p>
                                  <pre className="text-xs font-mono overflow-x-auto max-h-24 overflow-y-auto bg-slate-800 p-2 rounded">
                                    {JSON.stringify(log.previousSnapshot, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-xs font-medium mb-2 text-slate-300">JSON completo (auditoria)</p>
                          <pre className="text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
                            {JSON.stringify({
                              id: log.id,
                              userId: log.userId,
                              action: log.action,
                              entityType: log.entityType,
                              entityId: log.entityId,
                              details: log.details,
                              previousSnapshot: log.previousSnapshot,
                              ipAddress: log.ipAddress,
                              userAgent: log.userAgent,
                              riskFlags: log.riskFlags,
                              createdAt: log.createdAt
                            }, null, 2)}
                          </pre>
                        </div>
                      )}
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
