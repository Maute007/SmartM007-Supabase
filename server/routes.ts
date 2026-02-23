import type { Express, Request, Response } from "express";
import os from "node:os";
import { createServer as createHttpServer, type Server } from "http";
import { createServer as createHttpsServer } from "https";
import selfsigned from "selfsigned";
import { storage } from "./storage";
import { insertUserSchema, insertProductSchema, insertCategorySchema, insertSaleSchema, insertTaskSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { seedDatabase } from "../db/init";
import {
  getReceiptSettings,
  saveReceiptSettings,
  saveReceiptToDisk,
  generateReceiptHTML,
  getReceiptAbsolutePath,
  receiptExists,
  listReceiptFiles,
  type ReceiptSettings,
  type ReceiptPaperSize,
} from "./receipts";
import { attachWebSocket, wsEvents } from "./websocket";
import { triggerWebhook, getAllWebhooks, addWebhook, updateWebhook, deleteWebhook, type WebhookEvent } from "./webhooks";
import { getAuditContext } from "./auditContext";
import { computeRiskFlags } from "./auditAnomaly";
import { createScannerToken, consumeBarcodes, pushBarcode, pingToken, listSessions, revokeToken, renewToken, TOKEN_TTL_MS } from "./scannerToken";

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
      const ctx = getAuditContext(req);

      if (!user) {
        await storage.createAuditLog({
          userId: undefined,
          action: "LOGIN_FAILED",
          entityType: "auth",
          entityId: null,
          details: { username: String(username).slice(0, 100) },
          ...ctx,
          riskFlags: [],
        });
        return res.status(401).json({ error: "Usuário ou senha incorretos" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.name = user.name;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Erro ao salvar sessão" });
        }
        storage.createAuditLog({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          entityType: "auth",
          entityId: user.id,
          details: { username: user.username },
          ...ctx,
          riskFlags: [],
        }).catch(() => {});
        res.json({
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          avatar: user.avatar
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const userId = req.session.userId ?? undefined;
    const ctx = getAuditContext(req);
    req.session.destroy(async (err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      if (userId) {
        await storage.createAuditLog({
          userId,
          action: "LOGOUT",
          entityType: "auth",
          entityId: userId,
          details: {},
          ...ctx,
          riskFlags: [],
        }).catch(() => {});
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
  
  // Get all users (admin e manager)
  app.get("/api/users", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
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
      const previous = await storage.getUser(req.params.id);
      const updated = await storage.updateUser(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      const ctx = getAuditContext(req);
      const previousSnapshot = previous ? { name: previous.name, username: previous.username, role: previous.role } : undefined;
      const riskFlags = computeRiskFlags({
        action: "UPDATE_USER",
        details: { changes: req.body },
        previousSnapshot,
      });
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "UPDATE_USER",
        entityType: "user",
        entityId: updated.id,
        details: { changes: req.body },
        previousSnapshot: previousSnapshot ?? undefined,
        ...ctx,
        riskFlags,
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
      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_USER",
        entityType: "user",
        entityId: req.params.id,
        details: { username: userToDelete.username },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "DELETE_USER", details: { username: userToDelete.username } }),
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

      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_USER",
        entityType: "user",
        entityId: newUser.id,
        details: { username: newUser.username, role: newUser.role },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "CREATE_USER", details: { username: newUser.username, role: newUser.role } }),
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

      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_CATEGORY",
        entityType: "category",
        entityId: newCategory.id,
        details: { name: newCategory.name },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "CREATE_CATEGORY", details: { name: newCategory.name } }),
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
      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_CATEGORY",
        entityType: "category",
        entityId: req.params.id,
        details: {},
        ...ctx,
        riskFlags: computeRiskFlags({ action: "DELETE_CATEGORY" }),
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

  app.get("/api/products/by-barcode/:barcode", async (req: Request, res: Response) => {
    try {
      const product = await storage.getProductByBarcode(req.params.barcode);
      if (!product) return res.status(404).json({ error: "Produto não encontrado" });
      res.json(product);
    } catch (error) {
      console.error("Get product by barcode error:", error);
      res.status(500).json({ error: "Erro ao buscar produto" });
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
      if (!data.barcode?.trim() && data.sku?.trim()) data.barcode = data.sku.trim();
      if (!data.sku?.trim() && data.barcode?.trim()) data.sku = data.barcode.trim();
      const newProduct = await storage.createProduct(data);

      wsEvents.product(newProduct);
      wsEvents.invalidate(['/api/products', 'notifications', '/api/notifications']);
      void triggerWebhook('product.updated', { action: 'created', product: newProduct });

      // Increment edit count for non-admins
      if (req.session.role !== 'admin') {
        const today = new Date().toISOString().split('T')[0];
        await storage.incrementDailyEdits(req.session.userId!, today);
      }

      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_PRODUCT",
        entityType: "product",
        entityId: newProduct.id,
        details: { name: newProduct.name, sku: newProduct.sku },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "CREATE_PRODUCT", details: { name: newProduct.name, sku: newProduct.sku } }),
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

      const previous = await storage.getProduct(req.params.id);
      const updated = await storage.updateProduct(req.params.id, req.body);
      
      if (!updated) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      // Increment edit count for non-admins
      if (req.session.role !== 'admin') {
        const today = new Date().toISOString().split('T')[0];
        await storage.incrementDailyEdits(req.session.userId!, today);
      }

      const ctx = getAuditContext(req);
      const previousSnapshot = previous ? { name: previous.name, sku: previous.sku, price: previous.price, stock: previous.stock } : undefined;
      const riskFlags = computeRiskFlags({
        action: "UPDATE_PRODUCT",
        details: { changes: req.body },
        previousSnapshot,
      });
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "UPDATE_PRODUCT",
        entityType: "product",
        entityId: updated.id,
        details: { changes: req.body },
        previousSnapshot: previousSnapshot ?? undefined,
        ...ctx,
        riskFlags,
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

      wsEvents.product(updated);
      wsEvents.invalidate(['/api/products', 'notifications', '/api/notifications']);

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

      const ctx = getAuditContext(req);
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
        },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "INCREASE_STOCK", details: { productName: product.name, quantityAdded: quantity } }),
      });

      // Notify all users
      const priceMsg = price ? ` | Preço: ${product.price} → ${price}` : '';
      await storage.createNotification({
        userId: null,
        type: "info",
        message: `Estoque aumentado: ${product.name} (+${quantity} ${product.unit})${priceMsg}`,
        metadata: { productId: product.id, action: "stock_increased" }
      });

      wsEvents.product(updated);
      wsEvents.invalidate(['/api/products', 'notifications', '/api/notifications']);

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
      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "DELETE_PRODUCT",
        entityType: "product",
        entityId: req.params.id,
        details: { name: product.name },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "DELETE_PRODUCT", details: { name: product.name } }),
      });

      // Notify all users
      wsEvents.product(null);
      wsEvents.invalidate(['/api/products', 'notifications', '/api/notifications']);

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

  const UNIT_ALIASES: Record<string, string> = {
    un: 'un', unidade: 'un', unidades: 'un', unit: 'un', pç: 'un', pcs: 'un', peça: 'un', peças: 'un',
    kg: 'kg', quilograma: 'kg', quilogramas: 'kg', quilo: 'kg', quilos: 'kg', kilograma: 'kg',
    g: 'g', grama: 'g', gramas: 'g', gr: 'g',
    pack: 'pack', pacote: 'pack', pacotes: 'pack', pct: 'pack',
    box: 'box', caixa: 'box', caixas: 'box', cx: 'box',
  };
  const VALID_UNITS = ['un', 'kg', 'g', 'pack', 'box'];
  const normalizeUnit = (u: string) => {
    const key = String(u || 'un').trim().toLowerCase();
    return UNIT_ALIASES[key] || (VALID_UNITS.includes(key) ? key : 'un');
  };

  app.post("/api/products/import", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const { products: items, mode } = req.body;
      if (!Array.isArray(items) || !mode || !['merge', 'reset'].includes(mode)) {
        return res.status(400).json({ error: "Body deve ter { products: [...], mode: 'merge' | 'reset' }" });
      }
      const ctx = getAuditContext(req);
      const result = await storage.bulkImportProducts(
        items.map((p: any) => ({
          name: String(p.name || '').trim(),
          sku: String(p.sku || '').trim(),
          price: (p.price != null && String(p.price).trim() !== '') ? String(p.price) : '',
          costPrice: (p.costPrice != null && String(p.costPrice).trim() !== '') ? String(p.costPrice) : '',
          stock: (p.stock != null && String(p.stock).trim() !== '') ? String(p.stock) : '',
          minStock: (p.minStock != null && String(p.minStock).trim() !== '') ? String(p.minStock) : '',
          unit: normalizeUnit(p.unit),
          categoryId: p.categoryId || null,
          image: p.image || '',
        })),
        mode,
        req.session.userId!,
        { ...ctx, riskFlags: computeRiskFlags({ action: 'PRODUCT_IMPORT', details: { added: items.length, mode } }) }
      );
      wsEvents.product(null);
      wsEvents.invalidate(['/api/products', 'notifications', '/api/notifications']);
      await storage.createNotification({
        userId: null,
        type: "success",
        message: `Importação: ${result.added} adicionados, ${result.updated} atualizados${result.removed ? `, ${result.removed} removidos` : ''}`,
        metadata: { action: "product_import" }
      });
      res.json(result);
    } catch (error) {
      console.error("Import products error:", error);
      res.status(500).json({ error: "Erro ao importar produtos" });
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

  // Get sales with preview (admin only for audit/history)
  app.get("/api/sales/history/previews", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const sales = await storage.getAllSales();
      const withPreviews = sales.filter(s => s.preview).map(s => ({
        id: s.id,
        userId: s.userId,
        createdAt: s.createdAt,
        total: s.total,
        preview: s.preview
      }));
      res.json(withPreviews);
    } catch (error) {
      console.error("Get sales previews error:", error);
      res.status(500).json({ error: "Erro ao buscar histórico de vendas" });
    }
  });

  app.post("/api/sales", requireAuth, async (req: Request, res: Response) => {
    try {
      const { preview, ...bodyData } = req.body;
      const data = insertSaleSchema.parse({
        ...bodyData,
        userId: req.session.userId
      });

      const newSale = await storage.createSale({
        ...data,
        preview
      });

      const previewData = newSale.preview as { items?: Array<{ productId: string; productName: string; quantity: number; priceAtSale: number; productUnit?: string }>; subtotal?: number; discountAmount?: number; total?: number; amountReceived?: number; change?: number } | null;
      const itemsForAudit = (previewData?.items ?? newSale.items.map((it: { productId: string; quantity: number; priceAtSale: number }) => ({
        productId: it.productId,
        productName: null,
        quantity: it.quantity,
        priceAtSale: it.priceAtSale,
        subtotal: Number(it.priceAtSale) * it.quantity,
      }))).map((it: any) => ({
        productId: it.productId,
        productName: it.productName ?? undefined,
        quantity: it.quantity,
        priceAtSale: it.priceAtSale,
        subtotal: it.subtotal ?? Number(it.priceAtSale) * it.quantity,
      }));
      const subtotal = previewData?.subtotal ?? itemsForAudit.reduce((s: number, i: any) => s + (i.subtotal ?? 0), 0);
      const discountAmount = previewData?.discountAmount ?? 0;
      const total = Number(newSale.total);
      const saleDetails = {
        items: itemsForAudit,
        subtotal,
        discountAmount,
        total,
        amountReceived: newSale.amountReceived != null ? Number(newSale.amountReceived) : undefined,
        change: newSale.change != null ? Number(newSale.change) : undefined,
        paymentMethod: newSale.paymentMethod,
        itemCount: newSale.items.length,
      };
      const ctx = getAuditContext(req);
      const riskFlags = computeRiskFlags({
        action: "CREATE_SALE",
        details: saleDetails,
      });
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CREATE_SALE",
        entityType: "sale",
        entityId: newSale.id,
        details: saleDetails,
        ...ctx,
        riskFlags,
      });

      // Create notification for the seller (their own action)
      await storage.createNotification({
        userId: req.session.userId!,
        type: "success",
        message: `Venda realizada com sucesso! Total: MT ${newSale.total}`,
        metadata: { saleId: newSale.id }
      });

      wsEvents.sale(newSale);
      wsEvents.invalidate(['/api/sales', 'notifications', '/api/notifications']);
      void triggerWebhook('sale.created', newSale);

      res.json(newSale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
      console.error("Create sale error:", error);
      res.status(500).json({ error: "Erro ao criar venda" });
    }
  });

  app.post("/api/sales/:id/return", requireAuth, async (req: Request, res: Response) => {
    try {
      const saleId = req.params.id;
      const sale = await storage.getSaleById(saleId);
      if (!sale) return res.status(404).json({ error: "Venda não encontrada" });
      if (sale.userId !== req.session.userId) {
        return res.status(403).json({ error: "Só pode registar devolução das suas próprias vendas" });
      }
      const saleDate = new Date(sale.createdAt).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      if (saleDate !== today) {
        return res.status(403).json({ error: "Só pode registar devolução de vendas de hoje" });
      }
      const returnsLast2Days = await storage.getSaleReturnsCountLast2Days(req.session.userId!);
      if (returnsLast2Days >= 5) {
        return res.status(403).json({
          error: "Limite atingido",
          message: "Máximo de 5 devoluções em 2 dias. Contacte o gerente.",
        });
      }
      const itemsReturned = sale.items.map((it: { productId: string; quantity: number; priceAtSale: number }) => ({
        productId: it.productId,
        quantity: it.quantity,
        priceAtSale: it.priceAtSale,
        subtotal: Number(it.priceAtSale) * it.quantity,
      }));
      for (const item of sale.items) {
        await storage.restoreStock(item.productId, item.quantity);
      }
      await storage.createSaleReturn({ saleId, userId: req.session.userId! });
      const returnDetails = {
        total: sale.total,
        itemCount: sale.items.length,
        itemsReturned,
        stockImpact: itemsReturned.map((it: any) => ({ productId: it.productId, quantityRestored: it.quantity })),
      };
      const ctx = getAuditContext(req);
      const riskFlags = computeRiskFlags({
        action: "SALE_RETURN",
        details: returnDetails,
        returnsCountLast2Days,
      });
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "SALE_RETURN",
        entityType: "sale",
        entityId: sale.id,
        details: returnDetails,
        ...ctx,
        riskFlags,
      });
      await storage.createNotification({
        userId: null,
        type: "info",
        message: `Devolução registada: venda ${sale.id.slice(-6)}`,
        metadata: { saleId },
      });
      wsEvents.invalidate(["/api/sales", "notifications", "/api/notifications"]);
      res.json({ success: true });
    } catch (error) {
      console.error("Sale return error:", error);
      res.status(500).json({ error: "Erro ao registar devolução" });
    }
  });

  app.get("/api/sales/returns/limit", requireAuth, async (req: Request, res: Response) => {
    try {
      const count = await storage.getSaleReturnsCountLast2Days(req.session.userId!);
      res.json({ count, remaining: Math.max(0, 5 - count) });
    } catch (error) {
      console.error("Get returns limit error:", error);
      res.status(500).json({ error: "Erro ao verificar limite" });
    }
  });

  // ==================== NETWORK (IP dinâmico) ====================
  app.get("/api/network/local-access", (req: Request, res: Response) => {
    try {
      const port = parseInt(String(process.env.PORT || req.get('host')?.split(':')[1] || 9001), 10);
      const protocol = (process.env.HTTPS === "1" || process.env.HTTPS === "true") ? "https" : (req.protocol || "http");
      const ips: string[] = [];
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          const isIPv4 = net.family === 'IPv4' || (net as { family?: number }).family === 4;
          if (isIPv4 && !net.internal) ips.push(net.address);
        }
      }
      const baseUrl = ips.length > 0 ? `${protocol}://${ips[0]}:${port}` : null;
      res.json({ baseUrl, ips, port });
    } catch (error) {
      console.error("Network local-access error:", error);
      res.status(500).json({ error: "Erro ao obter IP" });
    }
  });

  // ==================== SCANNER (REMOTE) ROUTES ====================
  app.post("/api/scanner/start", requireAuth, (req: Request, res: Response) => {
    try {
      const ua = (req.headers['user-agent'] as string) || '';
      const { token } = createScannerToken(req.session.userId!, req.session.name || req.session.username || '', ua);
      const port = parseInt(String(process.env.PORT || req.get('host')?.split(':')[1] || 9001), 10);
      const protocol = (process.env.HTTPS === "1" || process.env.HTTPS === "true") ? "https" : (req.protocol || "http");
      const origin = req.get('origin') || req.get('referer')?.replace(/\/[^/]*$/, '') || `${protocol}://${req.get('host')}`;
      let baseUrl = origin;
      const nets = os.networkInterfaces();
      outer: for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          const isIPv4 = net.family === 'IPv4' || (net as { family?: number }).family === 4;
          if (isIPv4 && !net.internal) {
            baseUrl = `${protocol}://${net.address}:${port}`;
            break outer;
          }
        }
      }
      const url = `${baseUrl}/scanner/${token}`;
      res.json({ token, url });
    } catch (error) {
      console.error("Scanner start error:", error);
      res.status(500).json({ error: "Erro ao gerar link do scanner" });
    }
  });

  app.get("/api/scanner/poll/:token", requireAuth, (req: Request, res: Response) => {
    try {
      const barcodes = consumeBarcodes(req.params.token, req.session.userId!);
      res.json({ barcodes });
    } catch (error) {
      console.error("Scanner poll error:", error);
      res.status(500).json({ error: "Erro ao obter códigos" });
    }
  });

  app.post("/api/scanner/send", async (req: Request, res: Response) => {
    try {
      const { token, barcode } = req.body;
      const ua = (req.headers['user-agent'] as string) || '';
      if (!token || typeof barcode !== 'string' || !barcode.trim()) {
        return res.status(400).json({ error: "token e barcode são obrigatórios" });
      }
      const ok = pushBarcode(token, barcode.trim(), ua);
      if (!ok) return res.status(404).json({ error: "Link expirado ou inválido" });
      const product = await storage.getProductByBarcode(barcode.trim());
      res.json({ ok: true, product: product ? { name: product.name } : undefined });
    } catch (error) {
      console.error("Scanner send error:", error);
      res.status(500).json({ error: "Erro ao enviar código" });
    }
  });

  app.post("/api/scanner/ping", (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const ua = (req.headers['user-agent'] as string) || '';
      if (!token) return res.status(400).json({ error: "token obrigatório" });
      const session = pingToken(token, ua);
      if (!session) return res.status(404).json({ error: "Link expirado ou inválido" });
      res.json({
        ok: true,
        expiresIn: Math.max(0, Math.floor((TOKEN_TTL_MS - (Date.now() - session.createdAt)) / 1000)),
        deviceType: session.deviceType,
      });
    } catch (error) {
      console.error("Scanner ping error:", error);
      res.status(500).json({ error: "Erro" });
    }
  });

  app.get("/api/scanner/sessions", requireAuth, (req: Request, res: Response) => {
    try {
      const sessions = listSessions(req.session.userId!);
      res.json(sessions);
    } catch (error) {
      console.error("Scanner sessions error:", error);
      res.status(500).json({ error: "Erro ao listar sessões" });
    }
  });

  app.post("/api/scanner/revoke/:token", requireAuth, (req: Request, res: Response) => {
    try {
      const ok = revokeToken(req.params.token, req.session.userId!);
      if (!ok) return res.status(404).json({ error: "Sessão não encontrada ou já expirada" });
      res.json({ ok: true });
    } catch (error) {
      console.error("Scanner revoke error:", error);
      res.status(500).json({ error: "Erro ao revogar" });
    }
  });

  app.post("/api/scanner/renew", requireAuth, (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "token obrigatório" });
      const result = renewToken(token, req.session.userId!, req.session.name || req.session.username || '');
      if (!result) return res.status(404).json({ error: "Sessão não encontrada ou já expirada" });
      const port = parseInt(String(process.env.PORT || req.get('host')?.split(':')[1] || 9001), 10);
      const protocol = (process.env.HTTPS === "1" || process.env.HTTPS === "true") ? "https" : (req.protocol || "http");
      const origin = req.get('origin') || req.get('referer')?.replace(/\/[^/]*$/, '') || `${protocol}://${req.get('host')}`;
      let baseUrl = origin;
      const nets = os.networkInterfaces();
      outer: for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          const isIPv4 = net.family === 'IPv4' || (net as { family?: number }).family === 4;
          if (isIPv4 && !net.internal) { baseUrl = `${protocol}://${net.address}:${port}`; break outer; }
        }
      }
      const url = `${baseUrl}/scanner/${result.token}`;
      res.json({ token: result.token, url });
    } catch (error) {
      console.error("Scanner renew error:", error);
      res.status(500).json({ error: "Erro ao renovar" });
    }
  });

  // ==================== WEBHOOK ROUTES ====================

  app.get("/api/webhooks", requireAuth, requireAdmin, (req: Request, res: Response) => {
    try {
      res.json(getAllWebhooks());
    } catch (error) {
      console.error("Get webhooks error:", error);
      res.status(500).json({ error: "Erro ao buscar webhooks" });
    }
  });

  app.post("/api/webhooks", requireAuth, requireAdmin, (req: Request, res: Response) => {
    try {
      const { url, events, secret, enabled } = req.body;
      if (!url || !events?.length) {
        return res.status(400).json({ error: "URL e eventos são obrigatórios" });
      }
      const validEvents: WebhookEvent[] = ['sale.created', 'notification.created', 'order.approved', 'order.cancelled', 'product.updated', 'stock.low'];
      const filtered = events.filter((e: string) => validEvents.includes(e as WebhookEvent));
      const webhook = addWebhook({ url, events: filtered, secret: secret || undefined, enabled: enabled !== false });
      res.status(201).json(webhook);
    } catch (error) {
      console.error("Add webhook error:", error);
      res.status(500).json({ error: "Erro ao criar webhook" });
    }
  });

  app.patch("/api/webhooks/:id", requireAuth, requireAdmin, (req: Request, res: Response) => {
    try {
      const { url, events, secret, enabled } = req.body;
      const updated = updateWebhook(req.params.id, { url, events, secret, enabled });
      if (!updated) return res.status(404).json({ error: "Webhook não encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("Update webhook error:", error);
      res.status(500).json({ error: "Erro ao atualizar webhook" });
    }
  });

  app.delete("/api/webhooks/:id", requireAuth, requireAdmin, (req: Request, res: Response) => {
    try {
      if (!deleteWebhook(req.params.id)) return res.status(404).json({ error: "Webhook não encontrado" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete webhook error:", error);
      res.status(500).json({ error: "Erro ao deletar webhook" });
    }
  });

  // ==================== RECEIPT ROUTES ====================

  app.get("/api/settings/receipt", requireAuth, (req: Request, res: Response) => {
    try {
      const settings = getReceiptSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get receipt settings error:", error);
      res.status(500).json({ error: "Erro ao buscar configurações de recibo" });
    }
  });

  app.put("/api/settings/receipt", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { paperSize, printOnConfirm, branding } = req.body as Partial<ReceiptSettings>;
      const current = getReceiptSettings();
      const settings: ReceiptSettings = {
        paperSize: paperSize ?? current.paperSize,
        printOnConfirm: printOnConfirm ?? current.printOnConfirm,
        branding: branding !== undefined ? { ...current.branding, ...branding } : current.branding,
      };
      if (paperSize && !['80x60', '80x70', '80x80', 'a6'].includes(paperSize)) {
        return res.status(400).json({ error: "Tamanho de papel inválido" });
      }
      saveReceiptSettings(settings);
      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "RECEIPT_SETTINGS_UPDATED",
        entityType: "settings",
        entityId: null,
        details: { previous: current, updated: settings },
        ...ctx,
        riskFlags: [],
      });
      res.json(settings);
    } catch (error) {
      console.error("Save receipt settings error:", error);
      res.status(500).json({ error: "Erro ao salvar configurações" });
    }
  });

  app.post("/api/receipts/save", requireAuth, async (req: Request, res: Response) => {
    try {
      const saleId = req.body?.saleId ?? req.body?.sale_id;
      if (!saleId || typeof saleId !== "string") {
        return res.status(400).json({ error: "saleId é obrigatório" });
      }

      const sale = await storage.getSaleById(saleId);
      if (!sale) return res.status(404).json({ error: "Venda não encontrada" });

      const user = await storage.getUser(sale.userId);
      const sellerName = user?.name ?? "Desconhecido";

      const preview = sale.preview as {
        items?: Array<{ productName?: string; quantity?: number; productUnit?: string; priceAtSale?: number }>;
        subtotal?: number;
        discountAmount?: number;
        total?: number;
        paymentMethod?: string;
        amountReceived?: number;
        change?: number;
      } | null;

      let receiptItems: Array<{ name: string; quantity: number; unit: string; price: number; total: number }>;
      const rawItems = preview?.items ?? [];
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        receiptItems = rawItems.map((i: any) => {
          const qty = Number(i?.quantity) || 0;
          const price = Number(i?.priceAtSale) ?? 0;
          return {
            name: String(i?.productName ?? "Produto").trim() || "Produto",
            quantity: qty,
            unit: String(i?.productUnit ?? "un").trim() || "un",
            price,
            total: qty * price,
          };
        });
      } else {
        const items = Array.isArray(sale.items) ? sale.items : [];
        receiptItems = await Promise.all(
          items.map(async (item: any) => {
            const p = item?.productId ? await storage.getProduct(item.productId) : null;
            const qty = Number(item?.quantity) ?? 0;
            const price = Number(item?.priceAtSale) ?? 0;
            return {
              name: p?.name ?? "Produto",
              quantity: qty,
              unit: p?.unit ?? "un",
              price,
              total: qty * price,
            };
          })
        );
      }

      const totalNum = Number(sale.total) || 0;
      const receiptData = {
        saleId: sale.id,
        createdAt: new Date(sale.createdAt),
        sellerName,
        items: receiptItems,
        subtotal: Number(preview?.subtotal) ?? totalNum,
        discountAmount: Number(preview?.discountAmount) ?? 0,
        total: totalNum,
        paymentMethod: preview?.paymentMethod ?? sale.paymentMethod ?? "cash",
        amountReceived: preview?.amountReceived != null ? Number(preview.amountReceived) : (sale.amountReceived ? Number(sale.amountReceived) : undefined),
        change: preview?.change != null ? Number(preview.change) : (sale.change ? Number(sale.change) : undefined),
      };

      const settings = getReceiptSettings();
      const savedPath = saveReceiptToDisk(receiptData, settings.paperSize, settings);
      res.json({ success: true, path: savedPath });
    } catch (error) {
      console.error("Save receipt error:", error);
      res.status(500).json({ error: "Erro ao guardar recibo" });
    }
  });

  app.get("/api/receipts/preview/:saleId", requireAuth, async (req: Request, res: Response) => {
    try {
      const sale = await storage.getSaleById(req.params.saleId);
      if (!sale) return res.status(404).send("Venda não encontrada");

      const user = await storage.getUser(sale.userId);
      const preview = sale.preview as any;
      const rawItems = Array.isArray(preview?.items) ? preview.items : [];
      let items: Array<{ name: string; quantity: number; unit: string; price: number; total: number }>;
      if (rawItems.length > 0) {
        items = rawItems.map((i: any) => {
          const qty = Number(i?.quantity) ?? 0;
          const price = Number(i?.priceAtSale) ?? 0;
          return {
            name: String(i?.productName ?? "Produto").trim() || "Produto",
            quantity: qty,
            unit: String(i?.productUnit ?? "un").trim() || "un",
            price,
            total: qty * price,
          };
        });
      } else {
        const saleItems = Array.isArray(sale.items) ? sale.items : [];
        items = await Promise.all(
          saleItems.map(async (item: any) => {
            const p = item?.productId ? await storage.getProduct(item.productId) : null;
            const qty = Number(item?.quantity) ?? 0;
            const price = Number(item?.priceAtSale) ?? 0;
            return {
              name: p?.name ?? "Produto",
              quantity: qty,
              unit: p?.unit ?? "un",
              price,
              total: qty * price,
            };
          })
        );
      }

      const totalNum = Number(sale.total) ?? 0;
      const receiptData = {
        saleId: sale.id,
        createdAt: new Date(sale.createdAt),
        sellerName: user?.name ?? "Desconhecido",
        items,
        subtotal: Number(preview?.subtotal) ?? totalNum,
        discountAmount: Number(preview?.discountAmount) ?? 0,
        total: totalNum,
        paymentMethod: preview?.paymentMethod ?? sale.paymentMethod ?? "cash",
        amountReceived: preview?.amountReceived != null ? Number(preview.amountReceived) : (sale.amountReceived ? Number(sale.amountReceived) : undefined),
        change: preview?.change != null ? Number(preview.change) : (sale.change ? Number(sale.change) : undefined),
      };

      const settings = getReceiptSettings();
      const html = generateReceiptHTML(receiptData, settings.paperSize, settings);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      console.error("Receipt preview error:", error);
      res.status(500).send("Erro ao gerar recibo");
    }
  });

  // Obter recibo por saleId (arquivo guardado) - verifica que a venda existe
  app.get("/api/receipts/file/:saleId", requireAuth, async (req: Request, res: Response) => {
    try {
      const sale = await storage.getSaleById(req.params.saleId);
      if (!sale) return res.status(404).send("Venda não encontrada");
      if (!receiptExists(sale.id, new Date(sale.createdAt))) {
        const ctxDenied = getAuditContext(req);
        await storage.createAuditLog({
          userId: req.session.userId!,
          action: "RECEIPT_ACCESS_DENIED",
          entityType: "receipt",
          entityId: sale.id,
          details: { reason: "file_not_found" },
          ...ctxDenied,
          riskFlags: [],
        });
        return res.status(404).send("Recibo não encontrado. O ficheiro pode ter sido removido.");
      }
      const ctxView = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "RECEIPT_VIEWED",
        entityType: "receipt",
        entityId: sale.id,
        details: {},
        ...ctxView,
        riskFlags: [],
      });
      const absPath = getReceiptAbsolutePath(sale.id, new Date(sale.createdAt));
      const asAttachment = req.query.download === '1';
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", asAttachment
        ? `attachment; filename="recibo-${sale.id.slice(0, 8)}.html"`
        : `inline; filename="recibo-${sale.id.slice(0, 8)}.html"`);
      res.sendFile(absPath);
    } catch (error) {
      console.error("Receipt file error:", error);
      res.status(500).send("Erro ao obter recibo");
    }
  });

  // Listar ficheiros de recibos (admin) - pastas ano/mês/semana
  app.get("/api/receipts/list", requireAuth, requireAdmin, (_req: Request, res: Response) => {
    try {
      const files = listReceiptFiles();
      res.json(files);
    } catch (error) {
      console.error("List receipts error:", error);
      res.status(500).json({ error: "Erro ao listar recibos" });
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

  app.delete("/api/notifications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ error: "Erro ao deletar notificação" });
    }
  });

  // ==================== AUDIT LOG ROUTES ====================
  
  app.get("/api/audit-logs/recent-imports", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const logs = await storage.getRecentProductImports(limit);
      res.json(logs);
    } catch (error) {
      console.error("Get recent imports error:", error);
      res.status(500).json({ error: "Erro ao buscar importações recentes" });
    }
  });

  app.get("/api/audit-logs/imports", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate e endDate são obrigatórios (YYYY-MM-DD)" });
      }
      const logs = await storage.getProductImportsByDateRange(startDate, endDate);
      res.json(logs);
    } catch (error) {
      console.error("Get imports by date error:", error);
      res.status(500).json({ error: "Erro ao buscar importações" });
    }
  });

  app.get("/api/audit-logs", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const logs = await storage.getAllAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ error: "Erro ao buscar logs de auditoria" });
    }
  });

  app.post("/api/audit-logs/filter", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const { userId, startDate, endDate, startHour, endHour } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate e endDate são obrigatórios" });
      }

      const logs = userId && userId !== 'all'
        ? await storage.getAuditLogsByUserAndDateRange(userId, startDate, endDate, startHour, endHour)
        : await storage.getAuditLogsByDateRange(startDate, endDate, startHour, endHour, null);

      // Convert to CSV if requested
      if (req.query.format === 'csv') {
        const headers = ['ID', 'Data/Hora', 'UserId', 'Ação', 'Tipo Entidade', 'ID Entidade', 'Detalhes (JSON)', 'IP', 'User-Agent', 'RiskFlags', 'PreviousSnapshot'];
        const rows = logs.map(log => [
          log.id,
          new Date(log.createdAt).toLocaleString('pt-BR'),
          log.userId ?? '-',
          log.action,
          log.entityType,
          log.entityId || '-',
          JSON.stringify(log.details || {}),
          (log as any).ipAddress ?? '-',
          (log as any).userAgent ?? '-',
          Array.isArray((log as any).riskFlags) ? (log as any).riskFlags.join(';') : '-',
          (log as any).previousSnapshot != null ? JSON.stringify((log as any).previousSnapshot) : '-',
        ]);
        
        const csv = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="auditoria_${startDate}_${endDate}.csv"`);
        res.send(csv);
      } else {
        res.json(logs);
      }
    } catch (error) {
      console.error("Filter audit logs error:", error);
      res.status(500).json({ error: "Erro ao filtrar logs de auditoria" });
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
      const { title, assignedTo, assignedToId } = req.body;
      const taskData = insertTaskSchema.parse({
        title: String(title ?? '').trim(),
        assignedTo: ['all', 'admin', 'manager', 'seller', 'user'].includes(assignedTo) ? assignedTo : 'all',
        ...(assignedTo === 'user' && assignedToId ? { assignedToId } : {}),
        createdBy: req.session.userId!,
      });
      if (!taskData.title) {
        return res.status(400).json({ error: 'O título da tarefa é obrigatório.' });
      }
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: fromZodError(error).toString() });
      }
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

      wsEvents.order(newOrder);
      wsEvents.invalidate(['/api/orders', 'notifications', '/api/notifications']);

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

      wsEvents.order(updated);
      wsEvents.invalidate(['/api/orders', '/api/products', 'notifications', '/api/notifications']);
      void triggerWebhook('order.approved', updated);

      await storage.createNotification({
        userId: null,
        type: "success",
        message: `✅ Pedido ${updated.orderCode} foi aprovado!`,
        metadata: { orderId: updated.id }
      });

      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "APPROVE_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode, total: updated.total },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "APPROVE_ORDER", details: { orderCode: updated.orderCode } }),
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

      wsEvents.order(updated);
      wsEvents.invalidate(['/api/orders', 'notifications', '/api/notifications']);
      void triggerWebhook('order.cancelled', updated);

      await storage.createNotification({
        userId: null,
        type: "error",
        message: `❌ Pedido ${updated.orderCode} foi cancelado`,
        metadata: { orderId: updated.id }
      });

      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "CANCEL_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "CANCEL_ORDER", details: { orderCode: updated.orderCode } }),
      });

      res.json(updated);
    } catch (error) {
      console.error("Cancel order error:", error);
      res.status(500).json({ error: "Erro ao cancelar pedido" });
    }
  });

  app.patch("/api/orders/:id/reopen", requireAuth, requireAdminOrManager, async (req: Request, res: Response) => {
    try {
      const isAdmin = req.session.role === 'admin';
      
      // Se não é admin, verificar limite de 5 reabertas/dia
      if (!isAdmin) {
        const today = new Date().toISOString().split('T')[0];
        const reopensToday = await storage.getReopensToday(req.session.userId!, today);
        
        if (reopensToday >= 5) {
          return res.status(403).json({ 
            error: "Limite de reabertas atingido",
            message: "Você atingiu o limite de 5 reabertas por dia. Apenas admins podem reabrir sem limites."
          });
        }
      }

      const updated = await storage.reopenOrder(req.params.id);
      if (!updated) return res.status(404).json({ error: "Pedido não encontrado" });

      wsEvents.order(updated);
      wsEvents.invalidate(['/api/orders', 'notifications', '/api/notifications']);

      // Registrar reabertura
      const today = new Date().toISOString().split('T')[0];
      await storage.trackReopen({
        orderId: req.params.id,
        userId: req.session.userId!,
        date: today
      });

      await storage.createNotification({
        userId: null,
        type: "info",
        message: `🔄 Pedido ${updated.orderCode} foi reaberto para aprovação`,
        metadata: { orderId: updated.id }
      });

      const ctx = getAuditContext(req);
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "REOPEN_ORDER",
        entityType: "order",
        entityId: updated.id,
        details: { orderCode: updated.orderCode },
        ...ctx,
        riskFlags: computeRiskFlags({ action: "REOPEN_ORDER", details: { orderCode: updated.orderCode } }),
      });

      res.json(updated);
    } catch (error) {
      console.error("Reopen order error:", error);
      res.status(500).json({ error: "Erro ao reabrir pedido" });
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

  const useHttps = process.env.HTTPS === "1" || process.env.HTTPS === "true";
  let server: Server;

  if (useHttps) {
    const altNames: Array<{ type: 2; value: string } | { type: 7; ip: string }> = [
      { type: 2, value: "localhost" },
      { type: 7, ip: "127.0.0.1" },
    ];
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        const isIPv4 = net.family === "IPv4" || (net as { family?: number }).family === 4;
        if (isIPv4 && !net.internal) altNames.push({ type: 7, ip: net.address });
      }
    }
    const pems = await selfsigned.generate(
      [{ name: "commonName", value: "localhost" }],
      {
        notAfterDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        extensions: [{ name: "subjectAltName", altNames }],
      }
    );
    server = createHttpsServer({ key: pems.private, cert: pems.cert }, app);
  } else {
    server = createHttpServer(app);
  }

  attachWebSocket(server);
  return server;
}
