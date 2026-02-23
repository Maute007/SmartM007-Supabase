import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckSquare, MessageSquare, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, usersApi } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function Tasks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState<'all' | 'admin' | 'manager' | 'seller' | 'user'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.getAll,
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: !!user && (user.role === 'admin' || user.role === 'manager'),
  });

  const createTaskMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTaskTitle('');
      setAssignedTo('all');
      setSelectedUserId('');
      toast({
        title: "Tarefa criada",
        description: "A tarefa foi adicionada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar tarefa",
        description: error.message,
      });
    }
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, completed, completionComment }: { id: string; completed: boolean; completionComment?: string }) => 
      tasksApi.update(id, { completed, completionComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, completionComment }: { id: string; completionComment: string }) =>
      tasksApi.update(id, { completionComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: "Tarefa removida",
      });
    },
  });

  if (!user) return null;

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Digite o título da tarefa.",
      });
      return;
    }

    if (assignedTo === 'user' && !selectedUserId) {
      toast({
        variant: "destructive",
        title: "Selecione um usuário",
        description: "Escolha um usuário para atribuir a tarefa.",
      });
      return;
    }

    createTaskMutation.mutate({
      title: newTaskTitle,
      assignedTo,
      assignedToId: assignedTo === 'user' ? selectedUserId : undefined,
    });
  };

  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [showCommentInput, setShowCommentInput] = useState<string | null>(null);

  const handleToggleTask = (id: string, completed: boolean) => {
    if (!completed) {
      toggleTaskMutation.mutate({ id, completed: true });
      setShowCommentInput(id);
    } else {
      toggleTaskMutation.mutate({ id, completed: false });
      setShowCommentInput(null);
      setCommentDraft(prev => ({ ...prev, [id]: '' }));
    }
  };

  const handleSaveComment = (id: string, comment: string) => {
    if (comment.trim()) {
      updateCommentMutation.mutate({ id, completionComment: comment.trim() });
    }
    setShowCommentInput(null);
  };

  const handleDeleteTask = (id: string) => {
    deleteTaskMutation.mutate(id);
  };

  const getAssignedToLabel = (task: typeof tasks[0]) => {
    if (task.assignedTo === 'all') return 'Todos';
    if (task.assignedTo === 'user' && task.assignedToId) {
      const assignedUser = users.find(u => u.id === task.assignedToId);
      return assignedUser ? assignedUser.name : 'Usuário';
    }
    if (task.assignedTo === 'admin') return 'Admins';
    if (task.assignedTo === 'manager') return 'Gerentes';
    if (task.assignedTo === 'seller') return 'Vendedores';
    return task.assignedTo;
  };

  const pendingCount = tasks.filter(t => !t.completed).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">
            {user.role === 'admin' ? 'Todas as Tarefas' : 'Minhas Tarefas'}
          </h1>
          <p className="text-muted-foreground">
            {user.role === 'admin' 
              ? 'Visualize e gerencie todas as tarefas da equipe' 
              : 'Gerencie suas atividades diárias'}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {pendingCount} pendentes
        </Badge>
      </div>

      <Card className="border-emerald-200 shadow-lg">
        {(user.role === 'admin' || user.role === 'manager') && (
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50 border-b border-emerald-100 space-y-4">
          <div className="flex gap-2">
            <Input 
              data-testid="input-new-task"
              placeholder="Nova tarefa..." 
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="bg-background border-emerald-200"
            />
            <Button 
              data-testid="button-add-task"
              onClick={handleAddTask}
              className="bg-emerald-500 hover:bg-emerald-600"
              disabled={createTaskMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Atribuir tarefa para:</Label>
            <RadioGroup value={assignedTo} onValueChange={(value: any) => setAssignedTo(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal cursor-pointer">Todos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="admin" id="admin" />
                <Label htmlFor="admin" className="font-normal cursor-pointer">Administradores</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manager" id="manager" />
                <Label htmlFor="manager" className="font-normal cursor-pointer">Gerentes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="seller" id="seller" />
                <Label htmlFor="seller" className="font-normal cursor-pointer">Vendedores</Label>
              </div>
              {user.role === 'admin' && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="user" id="user" />
                  <Label htmlFor="user" className="font-normal cursor-pointer">Usuário específico</Label>
                </div>
              )}
            </RadioGroup>

            {assignedTo === 'user' && user.role === 'admin' && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-background border-emerald-200">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        )}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando tarefas...
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma tarefa pendente. Bom trabalho!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tasks.map((task) => {
                const creator = users.find(u => u.id === task.createdBy);
                return (
                <div 
                  key={task.id} 
                  data-testid={`task-${task.id}`}
                  className="p-4 hover:bg-muted/20 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <Checkbox 
                      data-testid={`checkbox-${task.id}`}
                      checked={task.completed} 
                      onCheckedChange={() => handleToggleTask(task.id, task.completed)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1 items-center">
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {getAssignedToLabel(task)}
                        </Badge>
                        {(user.role === 'admin' || user.role === 'manager') && creator && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> Atribuído por {creator.name}
                          </span>
                        )}
                      </div>
                      {task.completed && task.completionComment && (
                        <div className="mt-2 p-2 rounded-lg bg-muted/50 text-sm flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{task.completionComment}</span>
                        </div>
                      )}
                      {task.completed && (showCommentInput === task.id || !task.completionComment) && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            placeholder="Adicionar comentário (opcional)..."
                            value={commentDraft[task.id] ?? task.completionComment ?? ''}
                            onChange={(e) => setCommentDraft(prev => ({ ...prev, [task.id]: e.target.value }))}
                            className="min-h-[60px] text-sm"
                            onBlur={() => handleSaveComment(task.id, commentDraft[task.id] ?? task.completionComment ?? '')}
                          />
                          <Button size="sm" variant="outline" onClick={() => handleSaveComment(task.id, commentDraft[task.id] ?? task.completionComment ?? '')}>
                            Guardar comentário
                          </Button>
                        </div>
                      )}
                      {task.completed && task.completionComment && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 text-xs h-7"
                          onClick={() => setShowCommentInput(showCommentInput === task.id ? null : task.id)}
                        >
                          {showCommentInput === task.id ? 'Ocultar' : 'Editar comentário'}
                        </Button>
                      )}
                    </div>
                    {(user.role === 'admin' || user.role === 'manager') && (
                    <Button 
                      data-testid={`button-delete-${task.id}`}
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    )}
                  </div>
                </div>
              );})}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
