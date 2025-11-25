import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Product, User, Category, Sale, Notification, Todo, CartItem, UnitType } from './types';
import { initialProducts, initialUsers, initialCategories, initialSales, initialTodos } from './initialData';
import { toast } from '@/hooks/use-toast';

interface AppState {
  currentUser: User | null;
  users: User[];
  products: Product[];
  categories: Category[];
  sales: Sale[];
  cart: CartItem[];
  notifications: Notification[];
  todos: Todo[];
}

type Action =
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'CLEAR_CART' }
  | { type: 'UPDATE_CART_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'CHECKOUT'; payload: { paymentMethod: Sale['paymentMethod']; amountReceived?: number; change?: number } }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'IMPORT_PRODUCTS'; payload: Product[] }
  | { type: 'ADD_TODO'; payload: Todo }
  | { type: 'TOGGLE_TODO'; payload: string }
  | { type: 'DELETE_TODO'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string };

const initialState: AppState = {
  currentUser: null, // Start logged out
  users: initialUsers,
  products: initialProducts,
  categories: initialCategories,
  sales: initialSales,
  cart: [],
  notifications: [],
  todos: initialTodos,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  login: (userId: string) => void;
  logout: () => void;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  checkout: (paymentMethod: Sale['paymentMethod'], amountReceived?: number, change?: number) => void;
} | undefined>(undefined);

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, currentUser: action.payload };
    case 'LOGOUT':
      return { ...state, currentUser: null };
    case 'ADD_TO_CART': {
      const existingItemIndex = state.cart.findIndex(item => item.productId === action.payload.productId);
      if (existingItemIndex > -1) {
        const newCart = [...state.cart];
        newCart[existingItemIndex].quantity += action.payload.quantity;
        return { ...state, cart: newCart };
      }
      return { ...state, cart: [...state.cart, action.payload] };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(item => item.productId !== action.payload) };
    case 'UPDATE_CART_QUANTITY': {
      const newCart = state.cart.map(item => 
        item.productId === action.payload.productId 
          ? { ...item, quantity: action.payload.quantity } 
          : item
      );
      return { ...state, cart: newCart };
    }
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'CHECKOUT': {
      const total = state.cart.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
      const newSale: Sale = {
        id: `sale-${Date.now()}`,
        userId: state.currentUser?.id || 'unknown',
        items: [...state.cart],
        total,
        amountReceived: action.payload.amountReceived,
        change: action.payload.change,
        paymentMethod: action.payload.paymentMethod,
        timestamp: new Date(),
      };

      // Update stock
      const newProducts = state.products.map(product => {
        const cartItem = state.cart.find(item => item.productId === product.id);
        if (cartItem) {
          return { ...product, stock: product.stock - cartItem.quantity };
        }
        return product;
      });

      // Check for low stock alerts
      const newNotifications = [...state.notifications];
      newProducts.forEach(p => {
        if (p.stock <= p.minStock) {
          newNotifications.unshift({
            id: `notif-${Date.now()}-${p.id}`,
            type: 'warning',
            message: `Estoque baixo: ${p.name} (${p.stock} ${p.unit} restantes)`,
            timestamp: new Date(),
            read: false
          });
        }
      });
      
      // Add success notification
      newNotifications.unshift({
        id: `notif-sale-${Date.now()}`,
        type: 'success',
        message: `Venda realizada com sucesso! Total: MT ${total.toFixed(2)}`,
        timestamp: new Date(),
        read: false
      });

      return {
        ...state,
        sales: [newSale, ...state.sales],
        products: newProducts,
        cart: [],
        notifications: newNotifications
      };
    }
    case 'ADD_PRODUCT':
      return { ...state, products: [...state.products, action.payload] };
    case 'UPDATE_PRODUCT':
      return { ...state, products: state.products.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PRODUCT':
      return { ...state, products: state.products.filter(p => p.id !== action.payload) };
    case 'IMPORT_PRODUCTS':
      // Merge logic could be more complex, but for now just append
      return { ...state, products: [...state.products, ...action.payload] };
    case 'ADD_TODO':
      return { ...state, todos: [action.payload, ...state.todos] };
    case 'TOGGLE_TODO':
      return { ...state, todos: state.todos.map(t => t.id === action.payload ? { ...t, completed: !t.completed } : t) };
    case 'DELETE_TODO':
      return { ...state, todos: state.todos.filter(t => t.id !== action.payload) };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initial load effect (simulating data fetch)
  useEffect(() => {
    // Could load from localStorage here
  }, []);

  const login = (userId: string) => {
    const user = state.users.find(u => u.id === userId);
    if (user) {
      dispatch({ type: 'LOGIN', payload: user });
      toast({
        title: `Bem-vindo, ${user.name}!`,
        description: `Perfil: ${user.role.toUpperCase()}`,
      });
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  const addToCart = (product: Product, quantity: number) => {
    if (product.stock < quantity) {
      toast({
        variant: "destructive",
        title: "Estoque insuficiente",
        description: `Apenas ${product.stock} ${product.unit} disponíveis.`,
      });
      return;
    }
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        productId: product.id,
        quantity,
        priceAtSale: product.price
      }
    });
    toast({
      title: "Adicionado ao carrinho",
      description: `${quantity}${product.unit} de ${product.name}`,
    });
  };

  const removeFromCart = (productId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: productId });
  };

  const checkout = (paymentMethod: Sale['paymentMethod'], amountReceived?: number, change?: number) => {
    if (state.cart.length === 0) return;
    dispatch({ type: 'CHECKOUT', payload: { paymentMethod, amountReceived, change } });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, login, logout, addToCart, removeFromCart, checkout }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
