import { useApp } from '@/lib/store';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Tasks() {
  const { state, dispatch } = useApp();
  const { todos, currentUser } = state;
  const [newTodoText, setNewTodoText] = useState('');

  const filteredTodos = todos.filter(t => 
    t.assignedTo === 'all' || 
    (currentUser?.role === 'seller' && t.assignedTo === 'seller') ||
    (currentUser?.role === 'manager' && t.assignedTo === 'manager')
    // simplified logic for prototype
  );

  const handleAddTodo = () => {
    if (!newTodoText.trim() || !currentUser) return;
    
    dispatch({
      type: 'ADD_TODO',
      payload: {
        id: `t-${Date.now()}`,
        text: newTodoText,
        completed: false,
        assignedTo: 'all',
        createdBy: currentUser.id
      }
    });
    setNewTodoText('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie as atividades da loja.</p>
        </div>
      </div>

      <Card className="border-primary/10 shadow-lg">
        <CardHeader className="bg-muted/30 border-b border-border">
          <div className="flex gap-2">
            <Input 
              placeholder="Nova tarefa..." 
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
              className="bg-background"
            />
            <Button onClick={handleAddTodo}>
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
                <div key={todo.id} className="flex items-center p-4 hover:bg-muted/20 transition-colors group">
                  <Checkbox 
                    checked={todo.completed} 
                    onCheckedChange={() => dispatch({ type: 'TOGGLE_TODO', payload: todo.id })}
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
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => dispatch({ type: 'DELETE_TODO', payload: todo.id })}
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
