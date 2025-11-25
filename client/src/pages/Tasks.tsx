import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  assignedTo: 'all' | 'seller' | 'manager' | 'admin';
  createdBy: string;
  userId: string;
  userName: string;
}

const TASKS_STORAGE_KEY = 'fresh_market_tasks_global';

export default function Tasks() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');

  useEffect(() => {
    const storedTodos = localStorage.getItem(TASKS_STORAGE_KEY);
    if (storedTodos) {
      setTodos(JSON.parse(storedTodos));
    }
  }, []);

  useEffect(() => {
    if (todos.length > 0) {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(todos));
    }
  }, [todos]);

  if (!user) return null;

  const filteredTodos = user.role === 'admin' 
    ? todos
    : todos.filter(t => 
        t.assignedTo === 'all' || 
        t.assignedTo === user.role ||
        t.userId === user.id
      );

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    
    const newTodo: Todo = {
      id: `t-${Date.now()}`,
      text: newTodoText,
      completed: false,
      assignedTo: 'all',
      createdBy: user.name,
      userId: user.id,
      userName: user.name
    };
    
    setTodos(prev => [newTodo, ...prev]);
    setNewTodoText('');
    
    toast({
      title: "Tarefa adicionada",
      description: newTodoText,
    });
  };

  const handleToggleTodo = (id: string) => {
    setTodos(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const handleDeleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    toast({
      title: "Tarefa removida",
    });
  };

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
          {filteredTodos.filter(t => !t.completed).length} pendentes
        </Badge>
      </div>

      <Card className="border-emerald-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50 border-b border-emerald-100">
          <div className="flex gap-2">
            <Input 
              data-testid="input-new-task"
              placeholder="Nova tarefa..." 
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
              className="bg-background border-emerald-200"
            />
            <Button 
              data-testid="button-add-task"
              onClick={handleAddTodo}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTodos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma tarefa pendente. Bom trabalho!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTodos.map((todo) => (
                <div 
                  key={todo.id} 
                  data-testid={`task-${todo.id}`}
                  className="flex items-center p-4 hover:bg-muted/20 transition-colors group"
                >
                  <Checkbox 
                    data-testid={`checkbox-${todo.id}`}
                    checked={todo.completed} 
                    onCheckedChange={() => handleToggleTodo(todo.id)}
                    className="mr-4"
                  />
                  <div className="flex-1">
                    <p className={`font-medium ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {todo.text}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {todo.assignedTo === 'all' ? 'Geral' : todo.assignedTo}
                      </Badge>
                      {user.role === 'admin' && todo.userId !== user.id && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          por {todo.userName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button 
                    data-testid={`button-delete-${todo.id}`}
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => handleDeleteTodo(todo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
