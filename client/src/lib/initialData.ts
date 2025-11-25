import { Product, User, Category, Sale, Notification, Todo } from './types';
import { subDays, subMonths } from 'date-fns';

export const initialCategories: Category[] = [
  { id: 'cat1', name: 'Frutas & Verduras', color: 'bg-green-100 text-green-800' },
  { id: 'cat2', name: 'Laticínios', color: 'bg-blue-100 text-blue-800' },
  { id: 'cat3', name: 'Padaria', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'cat4', name: 'Bebidas', color: 'bg-purple-100 text-purple-800' },
  { id: 'cat5', name: 'Limpeza', color: 'bg-cyan-100 text-cyan-800' },
];

export const initialProducts: Product[] = [
  {
    id: 'p1',
    name: 'Maçã Fuji',
    sku: 'FRT-001',
    categoryId: 'cat1',
    price: 12.50, // per kg
    costPrice: 8.00,
    unit: 'kg',
    stock: 25.5, // kg
    minStock: 10,
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p2',
    name: 'Banana Prata',
    sku: 'FRT-002',
    categoryId: 'cat1',
    price: 6.90,
    costPrice: 3.50,
    unit: 'kg',
    stock: 100,
    minStock: 20,
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p3',
    name: 'Leite Integral 1L',
    sku: 'LAT-001',
    categoryId: 'cat2',
    price: 5.99,
    costPrice: 3.80,
    unit: 'un',
    stock: 48,
    minStock: 24,
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p4',
    name: 'Pão Francês',
    sku: 'PAD-001',
    categoryId: 'cat3',
    price: 14.90,
    costPrice: 5.00,
    unit: 'kg',
    stock: 5,
    minStock: 2,
    image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p5',
    name: 'Coca-Cola 2L',
    sku: 'BEB-001',
    categoryId: 'cat4',
    price: 10.50,
    costPrice: 7.50,
    unit: 'un',
    stock: 120,
    minStock: 30,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p6',
    name: 'Detergente Ypê',
    sku: 'LMP-001',
    categoryId: 'cat5',
    price: 2.99,
    costPrice: 1.80,
    unit: 'un',
    stock: 50,
    minStock: 10,
  }
];

export const initialUsers: User[] = [
  { id: 'u1', name: 'Carlos Silva', role: 'admin', avatar: 'https://github.com/shadcn.png' },
  { id: 'u2', name: 'Maria Oliveira', role: 'manager', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80' },
  { id: 'u3', name: 'João Santos', role: 'seller', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=100&q=80' },
];

export const initialTodos: Todo[] = [
  { id: 't1', text: 'Verificar validade dos laticínios', completed: false, assignedTo: 'all', createdBy: 'u1' },
  { id: 't2', text: 'Organizar prateleira de limpeza', completed: true, assignedTo: 'seller', createdBy: 'u2' },
];

// Generate some mock sales for reports
const generateMockSales = (): Sale[] => {
  const sales: Sale[] = [];
  // Last 30 days
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = subDays(new Date(), daysAgo);
    sales.push({
      id: `sale-${i}`,
      userId: Math.random() > 0.5 ? 'u3' : 'u2',
      items: [
        { productId: 'p1', quantity: 0.5 + Math.random(), priceAtSale: 12.50 },
        { productId: 'p3', quantity: Math.ceil(Math.random() * 3), priceAtSale: 5.99 }
      ],
      total: 20 + Math.random() * 50,
      paymentMethod: Math.random() > 0.6 ? 'card' : 'cash',
      timestamp: date
    });
  }
  return sales;
};

export const initialSales = generateMockSales();
