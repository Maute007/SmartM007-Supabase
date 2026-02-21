import { 
  type User, type InsertUser,
  type Product, type InsertProduct,
  type Category, type InsertCategory,
  type Sale, type InsertSale,
  type Notification, type InsertNotification,
  type AuditLog, type InsertAuditLog,
  type DailyEdit, type InsertDailyEdit,
  type Task, type InsertTask,
  type Order, type InsertOrder,
  type OrderReopen, type InsertOrderReopen,
  type SaleReturn, type InsertSaleReturn,
  users, products, categories, sales, notifications, auditLogs, dailyEdits, tasks, orders, orderReopens, saleReturns
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  verifyPassword(username: string, password: string): Promise<User | null>;

  // Categories
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  updateStock(id: string, quantity: number): Promise<void>;
  restoreStock(id: string, quantity: number): Promise<void>;

  // Sales
  getAllSales(): Promise<Sale[]>;
  getSalesByUser(userId: string): Promise<Sale[]>;
  getSaleById(id: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  getSaleReturnsCountLast2Days(userId: string): Promise<number>;
  createSaleReturn(return_: InsertSaleReturn): Promise<SaleReturn>;

  // Notifications
  getNotificationsByUser(userId: string | null): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;

  // Audit Logs
  getAllAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByUserAndDateRange(userId: string, startDate: string, endDate: string, startHour?: number, endHour?: number): Promise<AuditLog[]>;

  // Daily Edit Tracking
  getDailyEdits(userId: string, date: string): Promise<DailyEdit | undefined>;
  incrementDailyEdits(userId: string, date: string): Promise<void>;
  canUserEdit(userId: string, role: string): Promise<boolean>;

  // Tasks
  getAllTasks(): Promise<Task[]>;
  getTasksByUser(userId: string, role: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Pick<Task, 'completed'>>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  // Orders (Unauthenticated customer orders)
  createOrder(order: InsertOrder, orderCode: string): Promise<Order>;
  getOrderByCode(code: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  updateOrderItems(orderCode: string, items: any[]): Promise<Order | undefined>;
  approveOrder(orderId: string, userId: string): Promise<Order | undefined>;
  cancelOrder(orderId: string): Promise<Order | undefined>;
  deleteOrder(orderId: string): Promise<void>;
  reopenOrder(orderId: string): Promise<Order | undefined>;
  getReopensToday(userId: string, date: string): Promise<number>;
  trackReopen(reopen: InsertOrderReopen): Promise<OrderReopen>;
}

export class DatabaseStorage implements IStorage {
  // USERS
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db.insert(users).values({
      ...insertUser,
      password: hashedPassword
    }).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    return user;
  }

  // CATEGORIES
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // PRODUCTS
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(products.name);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return product;
  }

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const trimmed = String(barcode || '').trim();
    if (!trimmed) return undefined;
    const [product] = await db.select().from(products).where(eq(products.barcode, trimmed)).limit(1);
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db.update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    await db.update(products)
      .set({ stock: sql`${products.stock} - ${quantity}` })
      .where(eq(products.id, id));
  }

  async restoreStock(id: string, quantity: number): Promise<void> {
    await db.update(products)
      .set({ stock: sql`${products.stock} + ${quantity}` })
      .where(eq(products.id, id));
  }

  async findProductByNameUnitCategory(name: string, unit: string, categoryId: string | null): Promise<Product | undefined> {
    const normName = name.trim().toLowerCase();
    const conds = [
      sql`LOWER(TRIM(${products.name})) = ${normName}`,
      eq(products.unit, unit as any),
    ];
    if (categoryId) {
      conds.push(eq(products.categoryId, categoryId));
    } else {
      conds.push(sql`${products.categoryId} IS NULL`);
    }
    const [product] = await db.select()
      .from(products)
      .where(and(...conds))
      .limit(1);
    return product;
  }

  async findProductByNameUnitPriceCategory(name: string, unit: string, price: string, categoryId: string | null): Promise<Product | undefined> {
    const normName = name.trim().toLowerCase();
    const priceNum = parseFloat(String(price));
    const conds = [
      sql`LOWER(TRIM(${products.name})) = ${normName}`,
      eq(products.unit, unit as any),
      sql`${products.price}::numeric = ${priceNum}::numeric`,
    ];
    if (categoryId) {
      conds.push(eq(products.categoryId, categoryId));
    } else {
      conds.push(sql`${products.categoryId} IS NULL`);
    }
    const [product] = await db.select()
      .from(products)
      .where(and(...conds))
      .limit(1);
    return product;
  }

  async bulkImportProducts(
    items: Array<{ name: string; sku: string; price: string; costPrice: string; stock: string; minStock: string; unit: string; categoryId: string | null; image?: string }>,
    mode: 'merge' | 'reset',
    userId: string,
    auditExtras?: { ipAddress?: string | null; userAgent?: string | null; riskFlags?: string[] }
  ): Promise<{ added: number; updated: number; removed: number; details: { added: any[]; updated: any[]; removed: any[] } }> {
    const details = { added: [] as any[], updated: [] as any[], removed: [] as any[] };
    let added = 0, updated = 0, removed = 0;

    const allExisting = await this.getAllProducts();
    const catKey = (id: string | null) => id ?? '_';
    const fileKeys = new Set(items.map(p => {
      const n = p.name.trim().toLowerCase();
      const pr = parseFloat(p.price);
      return `${n}|${p.unit}|${pr}|${catKey(p.categoryId)}`;
    }));

    if (mode === 'reset') {
      const toRemove = allExisting.filter(p => {
        const k = `${p.name.trim().toLowerCase()}|${p.unit}|${parseFloat(p.price)}|${catKey(p.categoryId)}`;
        return !fileKeys.has(k);
      });
      for (const p of toRemove) {
        await this.deleteProduct(p.id);
        removed++;
        details.removed.push({ name: p.name, quantity: p.stock, price: p.price, unit: p.unit });
      }
    }

    const usedSkus = new Set(allExisting.map(p => p.sku));
    const generateSku = (base: string) => {
      let s = base;
      let i = 0;
      while (usedSkus.has(s)) {
        s = `${base}-${++i}`;
      }
      usedSkus.add(s);
      return s;
    };

    const isBlank = (v: string) => v == null || String(v).trim() === '';

    for (const item of items) {
      let existing: Product | undefined;
      if (mode === 'merge') {
        existing = await this.findProductByNameUnitCategory(item.name, item.unit, item.categoryId);
      } else {
        existing = await this.findProductByNameUnitPriceCategory(item.name, item.unit, item.price, item.categoryId);
      }

      if (existing) {
        if (mode === 'merge') {
          const updates: Record<string, string | null> = {};
          const changeList: string[] = [];

          if (!isBlank(item.stock)) {
            const newStock = parseFloat(item.stock);
            if (!Number.isNaN(newStock)) {
              updates.stock = String(newStock);
              changeList.push('quantidade');
            }
          }
          if (!isBlank(item.price)) {
            const newPrice = parseFloat(item.price);
            if (!Number.isNaN(newPrice) && newPrice >= 0) {
              updates.price = String(newPrice);
              changeList.push('preço');
            }
          }
          if (!isBlank(item.costPrice)) {
            const v = parseFloat(item.costPrice);
            if (!Number.isNaN(v)) updates.costPrice = item.costPrice;
          }
          if (!isBlank(item.minStock)) {
            const v = parseFloat(item.minStock);
            if (!Number.isNaN(v)) updates.minStock = item.minStock;
          }
          if (item.categoryId !== undefined && item.categoryId !== null) updates.categoryId = item.categoryId;

          if (Object.keys(updates).length > 0) {
            await this.updateProduct(existing.id, updates);
            updated++;
            details.updated.push({
              name: item.name,
              unit: item.unit,
              changes: changeList,
              oldStock: changeList.includes('quantidade') ? existing.stock : undefined,
              newStock: updates.stock,
              oldPrice: changeList.includes('preço') ? existing.price : undefined,
              newPrice: updates.price,
            });
          }
        } else {
          await this.updateProduct(existing.id, {
            stock: item.stock || '0',
            minStock: item.minStock || '5',
            costPrice: item.costPrice || '0',
            categoryId: item.categoryId,
          });
          updated++;
          details.updated.push({
            name: item.name,
            quantity: item.stock,
            price: item.price,
            unit: item.unit,
          });
        }
      } else {
        const sku = item.sku?.trim() ? generateSku(item.sku) : generateSku(`IMP-${Date.now()}-${added}`);
        const newProduct = await this.createProduct({
          name: item.name,
          sku,
          barcode: sku,
          price: isBlank(item.price) ? '0' : item.price,
          costPrice: isBlank(item.costPrice) ? '0' : item.costPrice,
          stock: isBlank(item.stock) ? '0' : item.stock,
          minStock: isBlank(item.minStock) ? '5' : item.minStock,
          unit: item.unit as any,
          categoryId: item.categoryId,
          image: item.image || '',
        });
        added++;
        details.added.push({
          name: newProduct.name,
          quantity: newProduct.stock,
          price: newProduct.price,
          unit: newProduct.unit,
        });
      }
    }

    await this.createAuditLog({
      userId,
      action: 'PRODUCT_IMPORT',
      entityType: 'product',
      entityId: null,
      details: { mode, added, updated, removed, addedList: details.added, updatedList: details.updated, removedList: details.removed },
      ...(auditExtras && {
        ipAddress: auditExtras.ipAddress ?? undefined,
        userAgent: auditExtras.userAgent ?? undefined,
        riskFlags: auditExtras.riskFlags ?? [],
      }),
    });

    return { added, updated, removed, details };
  }

  // SALES
  async getAllSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getSalesByUser(userId: string): Promise<Sale[]> {
    return await db.select().from(sales).where(eq(sales.userId, userId)).orderBy(desc(sales.createdAt));
  }

  async getSaleById(id: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
    return sale;
  }

  async createSale(sale: InsertSale & { preview?: any }): Promise<Sale> {
    const { preview, ...saleData } = sale;
    const [newSale] = await db.insert(sales).values({
      ...saleData,
      preview: preview || null
    }).returning();
    
    // Update stock for each item
    for (const item of sale.items) {
      await this.updateStock(item.productId, item.quantity);
    }
    
    return newSale;
  }

  async getSaleReturnsCountLast2Days(userId: string): Promise<number> {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const rows = await db.select().from(saleReturns)
      .where(
        and(
          eq(saleReturns.userId, userId),
          sql`${saleReturns.createdAt} >= ${twoDaysAgo.toISOString()}`
        )
      );
    return rows.length;
  }

  async createSaleReturn(return_: InsertSaleReturn): Promise<SaleReturn> {
    const [r] = await db.insert(saleReturns).values(return_).returning();
    return r;
  }

  // NOTIFICATIONS
  async getNotificationsByUser(userId: string | null): Promise<Notification[]> {
    if (userId) {
      // Get user-specific + broadcast notifications
      return await db.select().from(notifications)
        .where(
          sql`${notifications.userId} = ${userId} OR ${notifications.userId} IS NULL`
        )
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    } else {
      // Broadcast only
      return await db.select().from(notifications)
        .where(sql`${notifications.userId} IS NULL`)
        .orderBy(desc(notifications.createdAt))
        .limit(50);
    }
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  // AUDIT LOGS
  async getAllAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  }

  async getRecentProductImports(limit = 10): Promise<AuditLog[]> {
    return await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'PRODUCT_IMPORT'))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getProductImportsByDateRange(startDate: string, endDate: string): Promise<AuditLog[]> {
    return await db.select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, 'PRODUCT_IMPORT'),
          sql`DATE(${auditLogs.createdAt}) >= ${startDate}`,
          sql`DATE(${auditLogs.createdAt}) <= ${endDate}`
        )
      )
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogsByDateRange(
    startDate: string,
    endDate: string,
    startHour?: number,
    endHour?: number,
    userId?: string | null
  ): Promise<AuditLog[]> {
    const conditions = [
      sql`DATE(${auditLogs.createdAt}) >= ${startDate}`,
      sql`DATE(${auditLogs.createdAt}) <= ${endDate}`,
    ];
    if (userId) conditions.push(eq(auditLogs.userId, userId));
    if (startHour !== undefined && endHour !== undefined) {
      conditions.push(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt}) >= ${startHour}`);
      conditions.push(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt}) <= ${endHour}`);
    }

    return await db.select().from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
  }

  async getAuditLogsByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    startHour?: number,
    endHour?: number
  ): Promise<AuditLog[]> {
    const conditions = [
      eq(auditLogs.userId, userId),
      sql`DATE(${auditLogs.createdAt}) >= ${startDate}`,
      sql`DATE(${auditLogs.createdAt}) <= ${endDate}`,
    ];
    if (startHour !== undefined && endHour !== undefined) {
      conditions.push(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt}) >= ${startHour}`);
      conditions.push(sql`EXTRACT(HOUR FROM ${auditLogs.createdAt}) <= ${endHour}`);
    }
    return await db.select().from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
  }

  // DAILY EDIT TRACKING
  async getDailyEdits(userId: string, date: string): Promise<DailyEdit | undefined> {
    const [edit] = await db.select().from(dailyEdits)
      .where(and(eq(dailyEdits.userId, userId), eq(dailyEdits.date, date)))
      .limit(1);
    return edit;
  }

  async incrementDailyEdits(userId: string, date: string): Promise<void> {
    const existing = await this.getDailyEdits(userId, date);
    
    if (existing) {
      await db.update(dailyEdits)
        .set({ editCount: sql`${dailyEdits.editCount} + 1` })
        .where(eq(dailyEdits.id, existing.id));
    } else {
      await db.insert(dailyEdits).values({ userId, date, editCount: 1 });
    }
  }

  async canUserEdit(userId: string, role: string): Promise<boolean> {
    if (role === 'admin') return true;
    if (role === 'manager') {
      // Managers have a limit of 20 edits per day
      const today = new Date().toISOString().split('T')[0];
      const dailyEdit = await this.getDailyEdits(userId, today);
      return !dailyEdit || dailyEdit.editCount < 20;
    }
    if (role === 'seller') {
      // Sellers have a limit of 5 edits per day
      const today = new Date().toISOString().split('T')[0];
      const dailyEdit = await this.getDailyEdits(userId, today);
      return !dailyEdit || dailyEdit.editCount < 5;
    }
    return false;
  }

  // TASKS
  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTasksByUser(userId: string, role: string): Promise<Task[]> {
    if (role === 'admin') {
      return await this.getAllTasks();
    }
    
    return await db.select().from(tasks)
      .where(
        sql`${tasks.assignedTo} = 'all' OR ${tasks.assignedTo} = ${role} OR ${tasks.assignedToId} = ${userId}`
      )
      .orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Pick<Task, 'completed' | 'completionComment'>>): Promise<Task | undefined> {
    const [updated] = await db.update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  // ORDERS
  async createOrder(order: InsertOrder, orderCode: string): Promise<Order> {
    const [newOrder] = await db.insert(orders).values({ ...order, orderCode }).returning();
    return newOrder;
  }

  async getOrderByCode(code: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderCode, code)).limit(1);
    return order;
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async updateOrderItems(orderCode: string, items: any[]): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ items, total: items.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0).toString() })
      .where(eq(orders.orderCode, orderCode))
      .returning();
    return updated;
  }

  async approveOrder(orderId: string, userId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'approved', approvedBy: userId, approvedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async cancelOrder(orderId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'cancelled' })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async deleteOrder(orderId: string): Promise<void> {
    await db.delete(orders).where(eq(orders.id, orderId));
  }

  async reopenOrder(orderId: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status: 'pending' })
      .where(eq(orders.id, orderId))
      .returning();
    return updated;
  }

  async getReopensToday(userId: string, date: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(orderReopens)
      .where(and(eq(orderReopens.userId, userId), eq(orderReopens.date, date)));
    return result[0]?.count || 0;
  }

  async trackReopen(reopen: InsertOrderReopen): Promise<OrderReopen> {
    const [newReopen] = await db.insert(orderReopens).values(reopen).returning();
    return newReopen;
  }
}

export const storage = new DatabaseStorage();
