import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertProductSchema, insertCategorySchema, insertSaleSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { seedDatabase } from "../db/init";

// Session augmentation
declare module 'express-session' {
  interface SessionData {
    userId: string;
    username: string;
    role: 'admin' | 'manager' | 'seller';
    name: string;
  }
}

// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

// Middleware to check admin role
function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores podem realizar esta ação." });
  }
  next();
}

// Middleware to check admin or manager role
function requireAdminOrManager(req: Request, res: Response, next: Function) {
  if (!req.session.userId || (req.session.role !== 'admin' && req.session.role !== 'manager')) {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores e gerentes podem realizar esta ação." });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ==================== AUTH ROUTES ====================
  
  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
      }

      const user = await storage.verifyPassword(username, password);
      
      if (!user) {
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.name = user.name;

      res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.json({ success: true });
    });
  });

  // Get current user
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    res.json({
      id: req.session.userId,
      username: req.session.username,
      name: req.session.name,
      role: req.session.role
    });
  });

  // ==================== USER ROUTES ====================
  
  // Get all users (admin only)
  app.get("/api/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({ ...u, password: undefined }))); // Remove passwords
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  // Update user (admin only)
  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateUser(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "UPDATE_USER",
        entityType: "user",
        entityId: updated.id,
        details: { changes: req.body }
      });

      res.json(updated);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/users/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userToDelete = await storage.getUser(req.params.id);
      if (!userToDelete) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      await storage.deleteUser(req.params.id);

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_USER",
        entityType: "user",
        entityId: req.params.id,
        details: { username: userToDelete.username }
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Erro ao deletar usuário" });
    }
  });

  // Create user (admin only)
  app.post("/api/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(data);

      // Create audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_USER",
        entityType: "user",
        entityId: newUser.id,
        details: { username: newUser.username, role: newUser.role }
      });

      res.json({ ...newUser, password: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create user error:", error);
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });

  // ==================== CATEGORY ROUTES ====================
  
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });

  app.post("/api/categories", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const newCategory = await storage.createCategory(data);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_CATEGORY",
        entityType: "category",
        entityId: newCategory.id,
        details: { name: newCategory.name }
      });

      res.json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create category error:", error);
      res.status(500).json({ error: "Erro ao criar categoria" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCategory(req.params.id);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_CATEGORY",
        entityType: "category",
        entityId: req.params.id,
        details: {}
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Erro ao deletar categoria" });
    }
  });

  // ==================== PRODUCT ROUTES ====================
  
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/products", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      // Check edit permission
      const canEdit = await storage.canUserEdit(req.session.userId!, req.session.role!);
      if (!canEdit) {
        return res.status(403).json({ 
          error: "Limite diário de edições atingido. Vendedores podem fazer 5 edições por dia." 
        });
      }

      const data = insertProductSchema.parse(req.body);
      const newProduct = await storage.createProduct(data);

      // Increment edit count for non-admins
      if (req.session.role !== 'admin') {
        const today = new Date().toISOString().split('T')[0];
        await storage.incrementDailyEdits(req.session.userId!, today);
      }

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_PRODUCT",
        entityType: "product",
        entityId: newProduct.id,
        details: { name: newProduct.name, sku: newProduct.sku }
      });

      // Create notifications for sellers when admin creates product
      if (req.session.role === 'admin') {
        await storage.createNotification({
          userId: null, // Broadcast to all
          type: "info",
          message: `Novo produto adicionado: ${newProduct.name}`,
          metadata: { productId: newProduct.id }
        });
      }

      res.json(newProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create product error:", error);
      res.status(500).json({ error: "Erro ao criar produto" });
    }
  });

  app.patch("/api/products/:id", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      // Check edit permission
      const canEdit = await storage.canUserEdit(req.session.userId!, req.session.role!);
      if (!canEdit) {
        return res.status(403).json({ 
          error: "Limite diário de edições atingido. Vendedores podem fazer 5 edições por dia." 
        });
      }

      const updated = await storage.updateProduct(req.params.id, req.body);
      
      if (!updated) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      // Increment edit count for non-admins
      if (req.session.role !== 'admin') {
        const today = new Date().toISOString().split('T')[0];
        await storage.incrementDailyEdits(req.session.userId!, today);
      }

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "UPDATE_PRODUCT",
        entityType: "product",
        entityId: updated.id,
        details: { changes: req.body }
      });

      // Create notifications for sellers when admin updates product
      if (req.session.role === 'admin') {
        await storage.createNotification({
          userId: null,
          type: "info",
          message: `Produto atualizado: ${updated.name}`,
          metadata: { productId: updated.id }
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ error: "Erro ao atualizar produto" });
    }
  });

  // Increase product stock (admin/manager only)
  app.post("/api/products/:id/increase-stock", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const { quantity, price } = req.body;
      
      if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: "Quantidade deve ser maior que 0" });
      }

      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      const newStock = parseFloat(product.stock) + parseFloat(String(quantity));
      const updateData: any = { stock: String(newStock) };
      if (price !== undefined && price > 0) {
        updateData.price = String(price);
      }
      const updated = await storage.updateProduct(req.params.id, updateData);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "INCREASE_STOCK",
        entityType: "product",
        entityId: updated!.id,
        details: { 
          productName: product.name,
          quantityAdded: quantity,
          previousStock: product.stock,
          newStock: String(newStock),
          ...(price && { priceChanged: true, previousPrice: product.price, newPrice: String(price) })
        }
      });

      // Notify all users
      const priceMsg = price ? ` | Preço: ${product.price} → ${price}` : '';
      await storage.createNotification({
        userId: null,
        type: "info",
        message: `Estoque aumentado: ${product.name} (+${quantity} ${product.unit})${priceMsg}`,
        metadata: { productId: product.id, action: "stock_increased" }
      });

      res.json(updated);
    } catch (error) {
      console.error("Increase stock error:", error);
      res.status(500).json({ error: "Erro ao aumentar estoque" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      
      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      await storage.deleteProduct(req.params.id);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_PRODUCT",
        entityType: "product",
        entityId: req.params.id,
        details: { name: product.name }
      });

      // Notify all users
      await storage.createNotification({
        userId: null,
        type: "warning",
        message: `Produto removido: ${product.name}`,
        metadata: { productId: product.id }
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ error: "Erro ao deletar produto" });
    }
  });

  // ==================== SALES ROUTES ====================
  
  app.get("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      // Sellers only see their own sales, admins/managers see all
      const sales = req.session.role === 'seller' 
        ? await storage.getSalesByUser(req.session.userId!)
        : await storage.getAllSales();
      
      res.json(sales);
    } catch (error) {
      console.error("Get sales error:", error);
      res.status(500).json({ error: "Erro ao buscar vendas" });
    }
  });

  app.post("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertSaleSchema.parse({
        ...req.body,
        userId: req.session.userId
      });

      const newSale = await storage.createSale(data);

      // Audit log
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_SALE",
        entityType: "sale",
        entityId: newSale.id,
        details: { 
          total: newSale.total,
          paymentMethod: newSale.paymentMethod,
          itemCount: newSale.items.length
        }
      });

      // Create notification for the seller (their own action)
      await storage.createNotification({
        userId: req.session.userId!,
        type: "success",
        message: `Venda realizada com sucesso! Total: MT ${newSale.total}`,
        metadata: { saleId: newSale.id }
      });

      res.json(newSale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create sale error:", error);
      res.status(500).json({ error: "Erro ao criar venda" });
    }
  });

  // ==================== NOTIFICATION ROUTES ====================
  
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.session.userId!);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification error:", error);
      res.status(500).json({ error: "Erro ao marcar notificação" });
    }
  });

  // ==================== AUDIT LOG ROUTES ====================
  
  app.get("/api/audit-logs", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAllAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ error: "Erro ao buscar logs de auditoria" });
    }
  });

  // ==================== SYSTEM ROUTES ====================
  
  // Get edit count for current user
  app.get("/api/system/edit-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyEdit = await storage.getDailyEdits(req.session.userId!, today);
      const canEdit = await storage.canUserEdit(req.session.userId!, req.session.role!);
      
      const limit = req.session.role === 'seller' ? 5 : req.session.role === 'manager' ? 20 : 999;
      
      res.json({
        count: dailyEdit?.editCount || 0,
        limit,
        canEdit
      });
    } catch (error) {
      console.error("Get edit count error:", error);
      res.status(500).json({ error: "Erro ao buscar contagem de edições" });
    }
  });

  // ==================== TASKS ROUTES ====================
  
  app.get("/api/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasksByUser(req.session.userId!, req.session.role!);
      res.json(tasks);
    } catch (error) {
      console.error("Get tasks error:", error);
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const taskData = {
        ...req.body,
        createdBy: req.session.userId!
      };
      const newTask = await storage.createTask(taskData);
      
      // Criar notificação para usuários afetados
      const assignees = new Set<string>();
      if (taskData.assignedTo === 'admin') {
        const allUsers = await storage.getAllUsers();
        allUsers.filter(u => u.role === 'admin').forEach(u => assignees.add(u.id));
      } else if (taskData.assignedTo === 'manager') {
        const allUsers = await storage.getAllUsers();
        allUsers.filter(u => u.role === 'manager').forEach(u => assignees.add(u.id));
      } else if (taskData.assignedTo === 'seller') {
        const allUsers = await storage.getAllUsers();
        allUsers.filter(u => u.role === 'seller').forEach(u => assignees.add(u.id));
      } else if (taskData.assignedTo === 'user' && taskData.assignedToId) {
        assignees.add(taskData.assignedToId);
      } else if (taskData.assignedTo === 'all') {
        const allUsers = await storage.getAllUsers();
        allUsers.forEach(u => assignees.add(u.id));
      }
      
      // Broadcast notification to assigned users
      for (const userId of assignees) {
        await storage.createNotification({
          userId,
          type: "info",
          message: `Nova tarefa atribuída: ${newTask.title}`,
          metadata: { taskId: newTask.id }
        });
      }
      
      res.json(newTask);
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Erro ao criar tarefa" });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateTask(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Tarefa não encontrada" });
      }
      
      // Notificar quando tarefa é completada
      if (updated.completed) {
        await storage.createNotification({
          userId: null,
          type: "success",
          message: `Tarefa concluída: ${updated.title}`,
          metadata: { taskId: updated.id }
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Erro ao atualizar tarefa" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({ error: "Erro ao deletar tarefa" });
    }
  });

  // ==================== ORDERS ROUTES (Cliente - Pedidos) ====================

  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const { customerName, customerPhone, items, total, paymentMethod } = req.body;
      
      if (!customerName || !customerPhone || !items || !total) {
        return res.status(400).json({ error: "Dados incompletos" });
      }

      const orderCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const newOrder = await storage.createOrder({ 
        customerName, 
        customerPhone, 
        items, 
        total: total.toString(),
        paymentMethod 
      }, orderCode);

      // Check for over-stock orders and notify
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (product && item.quantity > parseFloat(product.stock)) {
          await storage.createNotification({
            userId: null,
            type: "warning",
            message: `⚠️ Pedido ${orderCode}: ${product.name} - Quantidade (${item.quantity}) acima do estoque (${product.stock})`,
            metadata: { orderId: newOrder.id, productId: product.id, overstock: true }
          });
        }
      }

      // Notify all admins/managers about new order
      await storage.createNotification({
        userId: null,
        type: "info",
        message: `📦 Novo pedido: ${customerName} - Código: ${orderCode}`,
        metadata: { orderId: newOrder.id, action: "new_order" }
      });

      res.json(newOrder);
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({ error: "Erro ao criar pedido" });
    }
  });

  app.get("/api/orders/:code", async (req: Request, res: Response) => {
    try {
      const order = await storage.getOrderByCode(req.params.code.toUpperCase());
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
      res.json(order);
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ error: "Erro ao buscar pedido" });
    }
  });

  app.get("/api/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      if (req.session.role === 'seller') {
        return res.status(403).json({ error: "Acesso negado" });
      }
      const orders = await storage.getAllOrders();
      
      // Enrich orders with product names and stock info
      const enrichedOrders = await Promise.all(orders.map(async (order: any) => {
        const enrichedItems = await Promise.all(order.items.map(async (item: any) => {
          const product = await storage.getProduct(item.productId);
          return {
            ...item,
            productName: product?.name || 'Produto desconhecido',
            currentStock: product?.stock || '0',
            hasInsufficientStock: product ? item.quantity > parseFloat(product.stock) : true
          };
        }));
        return {
          ...order,
          items: enrichedItems,
          hasAnyInsufficientStock: enrichedItems.some(item => item.hasInsufficientStock)
        };
      }));
      
      res.json(enrichedOrders);
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ error: "Erro ao buscar pedidos" });
    }
  });

  app.patch("/api/orders/:id/approve", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const order = await storage.getAllOrders().then(orders => orders.find(o => o.id === req.params.id));
      if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
      
      // Validate stock for all items
      const insufficientItems = [];
      for (const item of order.items) {
        const product = await storage.getProduct(item.productId);
        if (!product || item.quantity > parseFloat(product.stock)) {
          insufficientItems.push({
            productId: item.productId,
            productName: product?.name || 'Produto desconhecido',
            requested: item.quantity,
            available: product?.stock || '0'
          });
        }
      }
      
      // Se há itens com estoque insuficiente, recusar aprovação
      if (insufficientItems.length > 0) {
        return res.status(400).json({ 
          error: "Não é possível aprovar pedido com estoque insuficiente",
          insufficientItems 
        });
      }

      const updated = await storage.approveOrder(req.params.id, req.session.userId!);
      
      await storage.createNotification({
        userId: null,
        type: "success",
        message: `✅ Pedido ${updated.orderCode} foi aprovado!`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "APPROVE_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode, total: updated.total }
      });

      res.json(updated);
    } catch (error) {
      console.error("Approve order error:", error);
      res.status(500).json({ error: "Erro ao aprovar pedido" });
    }
  });

  app.patch("/api/orders/:id/cancel", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const updated = await storage.cancelOrder(req.params.id);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });
      
      await storage.createNotification({
        userId: null,
        type: "error",
        message: `❌ Pedido ${updated.orderCode} foi cancelado`,
        metadata: { orderId: updated.id }
      });

      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CANCEL_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode }
      });

      res.json(updated);
    } catch (error) {
      console.error("Cancel order error:", error);
      res.status(500).json({ error: "Erro ao cancelar pedido" });
    }
  });

  // ==================== ADMIN ROUTES (Sistema) ====================
  
  // Verifica se banco está vazio (para setup initial)
  app.get("/api/admin/check-empty", async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ isEmpty: users.length === 0 });
    } catch (error) {
      res.json({ isEmpty: false }); // Assume not empty on error
    }
  });
  
  // Rota para forçar inicialização do banco (apenas em produção, sem autenticação para permitir setup inicial)
  app.post("/api/admin/force-seed", async (req: Request, res: Response) => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Verificar se há usuários no banco
      const users = await storage.getAllUsers();
      
      if (users.length > 0) {
        return res.status(400).json({ 
          error: "Banco de dados já contém usuários",
          message: "Para segurança, esta operação só pode ser executada em um banco vazio. Use a interface de administração para gerenciar usuários.",
          userCount: users.length
        });
      }

      console.log(`🔧 ADMIN: Forçando inicialização do banco (${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'})...`);
      
      await seedDatabase();
      
      res.json({ 
        success: true,
        message: "Banco de dados inicializado com sucesso! Você pode fazer login com: admin/senha123"
      });
    } catch (error) {
      console.error("Force seed error:", error);
      res.status(500).json({ 
        error: "Erro ao inicializar banco de dados",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
