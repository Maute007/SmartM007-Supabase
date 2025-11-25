export type Role = 'admin' | 'manager' | 'seller';

export type UnitType = 'un' | 'kg' | 'g' | 'pack' | 'box' | 'l' | 'ml';

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  price: number;
  costPrice: number;
  unit: UnitType;
  stock: number;
  minStock: number;
  image?: string;
}

export interface CartItem {
  productId: string;
  quantity: number; // For kg, this can be decimal (e.g. 0.5 for 500g)
  priceAtSale: number;
}

export interface Sale {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  paymentMethod: 'cash' | 'card' | 'pix';
  timestamp: Date;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  timestamp: Date;
  read: boolean;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  assignedTo?: Role | 'all'; // null = personal? No, user asked for "all or seller"
  createdBy: string;
}
