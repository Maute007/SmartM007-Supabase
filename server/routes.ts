import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertProductSchema, insertCategorySchema, insertSaleSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

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
  
  app.get("/api/categories", requireAuth, async (req: Request, res: Response) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });

  app.post("/api/categories", requireAuth, async (req: Request, res: Response) => {
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
  
  app.get("/api/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/products", requireAuth, async (req: Request, res: Response) => {
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

  app.patch("/api/products/:id", requireAuth, async (req: Request, res: Response) => {
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
        message: `Venda realizada com sucesso! Total: R$ ${newSale.total}`,
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

  const httpServer = createServer(app);

  return httpServer;
}
