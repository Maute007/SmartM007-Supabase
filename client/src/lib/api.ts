// API client for backend communication
const API_BASE = '/api';

interface LoginRequest {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'manager' | 'seller';
  avatar?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  price: string;
  costPrice: string;
  stock: string;
  minStock: string;
  unit: 'un' | 'kg' | 'g' | 'pack' | 'box';
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface Sale {
  id: string;
  userId: string;
  total: string;
  amountReceived?: string;
  change?: string;
  paymentMethod: 'cash' | 'card' | 'pix' | 'mpesa' | 'emola' | 'pos' | 'bank';
  items: Array<{
    productId: string;
    quantity: number;
    priceAtSale: number;
  }>;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId?: string;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  read: boolean;
  metadata?: any;
  createdAt: Date;
}

export interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  createdAt: Date;
}

export interface EditCount {
  count: number;
  limit: number;
  canEdit: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  assignedTo: 'all' | 'admin' | 'manager' | 'seller' | 'user';
  assignedToId?: string;
  createdBy: string;
  createdAt: Date;
}

// Auth API
export const authApi = {
  login: async (data: LoginRequest): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao fazer login');
    }
    return res.json();
  },

  logout: async (): Promise<void> => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao fazer logout');
  },

  getMe: async (): Promise<User> => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  }
};

// Users API
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE}/users`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar usuários');
    return res.json();
  },

  create: async (data: Omit<User, 'id' | 'avatar'> & { password: string }): Promise<User> => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao criar usuário');
    }
    return res.json();
  },

  update: async (id: string, data: Partial<Omit<User, 'id'> & { password?: string }>): Promise<User> => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao atualizar usuário');
    }
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao deletar usuário');
    }
  }
};

// Products API
export const productsApi = {
  getAll: async (): Promise<Product[]> => {
    const res = await fetch(`${API_BASE}/products`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar produtos');
    return res.json();
  },

  create: async (data: any): Promise<Product> => {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao criar produto');
    }
    return res.json();
  },

  update: async (id: string, data: any): Promise<Product> => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao atualizar produto');
    }
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao deletar produto');
    }
  },

  increaseStock: async (id: string, quantity: number, price?: number): Promise<Product> => {
    const res = await fetch(`${API_BASE}/products/${id}/increase-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, ...(price && { price }) }),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao aumentar estoque');
    }
    return res.json();
  }
};

// Categories API
export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const res = await fetch(`${API_BASE}/categories`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar categorias');
    return res.json();
  },

  create: async (data: { name: string; color: string }): Promise<Category> => {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao criar categoria');
    }
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao deletar categoria');
    }
  }
};

// Sales API
export const salesApi = {
  getAll: async (): Promise<Sale[]> => {
    const res = await fetch(`${API_BASE}/sales`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar vendas');
    return res.json();
  },

  create: async (data: any): Promise<Sale> => {
    const res = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao criar venda');
    }
    return res.json();
  }
};

// Notifications API
export const notificationsApi = {
  getAll: async (): Promise<Notification[]> => {
    const res = await fetch(`${API_BASE}/notifications`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar notificações');
    return res.json();
  },

  markAsRead: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao marcar notificação como lida');
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao deletar notificação');
  }
};

// Audit Logs API
export const auditLogsApi = {
  getAll: async (): Promise<AuditLog[]> => {
    const res = await fetch(`${API_BASE}/audit-logs`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar logs de auditoria');
    return res.json();
  }
};

// Receipt Settings API
export type ReceiptPaperSize = '80x60' | '80x70' | '80x80' | 'a6';

export interface ReceiptSettings {
  paperSize: ReceiptPaperSize;
  printOnConfirm: boolean;
}

export const receiptSettingsApi = {
  get: async (): Promise<ReceiptSettings> => {
    const res = await fetch(`${API_BASE}/settings/receipt`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar configurações');
    return res.json();
  },
  update: async (settings: Partial<ReceiptSettings>): Promise<ReceiptSettings> => {
    const res = await fetch(`${API_BASE}/settings/receipt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      credentials: 'include'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao salvar');
    }
    return res.json();
  }
};

export const receiptsApi = {
  save: async (saleId: string): Promise<{ success: boolean; path: string }> => {
    const res = await fetch(`${API_BASE}/receipts/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saleId }),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao guardar recibo');
    return res.json();
  },
};

// Webhooks API
export type WebhookEvent = 'sale.created' | 'notification.created' | 'order.approved' | 'order.cancelled' | 'product.updated' | 'stock.low';

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled: boolean;
}

export const webhooksApi = {
  getAll: async (): Promise<Webhook[]> => {
    const res = await fetch(`${API_BASE}/webhooks`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar webhooks');
    return res.json();
  },
  create: async (data: Omit<Webhook, 'id'>): Promise<Webhook> => {
    const res = await fetch(`${API_BASE}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao criar webhook');
    }
    return res.json();
  },
  update: async (id: string, data: Partial<Webhook>): Promise<Webhook> => {
    const res = await fetch(`${API_BASE}/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao atualizar webhook');
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/webhooks/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao deletar webhook');
  }
};

// System API
export const systemApi = {
  getEditCount: async (): Promise<EditCount> => {
    const res = await fetch(`${API_BASE}/system/edit-count`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar contagem de edições');
    return res.json();
  }
};

// Orders API
export interface Order {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    productId: string;
    quantity: number;
    priceAtSale: number;
  }>;
  total: string;
  status: 'pending' | 'approved' | 'cancelled';
  paymentMethod: 'cash' | 'transfer';
  paymentProof?: string;
  approvedBy?: string;
  createdAt: Date;
  approvedAt?: Date;
}

export const ordersApi = {
  create: async (data: Partial<Order>): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao criar pedido');
    }
    return res.json();
  },

  getByCode: async (code: string): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders/${code}`);
    if (!res.ok) throw new Error('Pedido não encontrado');
    return res.json();
  },

  getAll: async (): Promise<Order[]> => {
    const res = await fetch(`${API_BASE}/orders`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar pedidos');
    return res.json();
  },

  approve: async (id: string): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders/${id}/approve`, {
      method: 'PATCH',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao aprovar pedido');
    return res.json();
  },

  cancel: async (id: string): Promise<Order> => {
    const res = await fetch(`${API_BASE}/orders/${id}/cancel`, {
      method: 'PATCH',
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Erro ao cancelar pedido');
    return res.json();
  }
};

// Tasks API
export const tasksApi = {
  getAll: async (): Promise<Task[]> => {
    const res = await fetch(`${API_BASE}/tasks`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erro ao buscar tarefas');
    return res.json();
  },

  create: async (data: { title: string; assignedTo: Task['assignedTo']; assignedToId?: string }): Promise<Task> => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao criar tarefa');
    }
    return res.json();
  },

  update: async (id: string, data: { completed?: boolean; completionComment?: string }): Promise<Task> => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao atualizar tarefa');
    }
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erro ao deletar tarefa');
    }
  }
};
