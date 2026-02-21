/**
 * Heuristic risk flags for audit logs (anti-fraud / anomaly detection).
 */

export interface AnomalyInput {
  action: string;
  entityType?: string;
  details?: Record<string, unknown> | null;
  previousSnapshot?: Record<string, unknown> | null;
  /** Used for off_hours; defaults to now */
  createdAt?: Date;
  /** For SALE_RETURN: number of returns by this user in last 2 days */
  returnsCountLast2Days?: number;
  /** For bulk delete: number of entities deleted */
  bulkCount?: number;
}

const BUSINESS_HOUR_START = 6;
const BUSINESS_HOUR_END = 22;
const HIGH_DISCOUNT_PERCENT = 15;
const PRICE_DROP_PERCENT = 30;
const MANY_RETURNS_THRESHOLD = 3;
const BULK_DELETE_THRESHOLD = 5;

export function computeRiskFlags(input: AnomalyInput): string[] {
  const flags: string[] = [];
  const {
    action,
    details,
    previousSnapshot,
    createdAt = new Date(),
    returnsCountLast2Days = 0,
    bulkCount = 0,
  } = input;

  const hour = createdAt.getHours();

  // high_discount: discount > 15% of subtotal
  if (action === "CREATE_SALE" && details) {
    const subtotal = Number((details as any).subtotal ?? (details as any).total);
    const discountAmount = Number((details as any).discountAmount ?? 0);
    if (subtotal > 0 && discountAmount > 0) {
      const pct = (discountAmount / subtotal) * 100;
      if (pct > HIGH_DISCOUNT_PERCENT) flags.push("high_discount");
    }
  }

  // off_hours: sale or return outside 06h–22h
  if (
    (action === "CREATE_SALE" || action === "SALE_RETURN") &&
    (hour < BUSINESS_HOUR_START || hour > BUSINESS_HOUR_END)
  ) {
    flags.push("off_hours");
  }

  // many_returns: user with 3+ returns in 2 days (we pass count before incrementing, so >= 2 means after this return they'll have 3+)
  if (action === "SALE_RETURN" && returnsCountLast2Days >= MANY_RETURNS_THRESHOLD - 1) {
    flags.push("many_returns");
  }

  // bulk_delete: many products or users deleted at once
  if (
    (action === "DELETE_PRODUCT" || action === "DELETE_USER") &&
    bulkCount >= BULK_DELETE_THRESHOLD
  ) {
    flags.push("bulk_delete");
  }

  // price_drop: product price reduced by > 30%
  if (action === "UPDATE_PRODUCT" && details && previousSnapshot) {
    const prev = previousSnapshot as Record<string, unknown>;
    const changes = (details as any).changes ?? details;
    const oldPrice = Number(prev.price ?? (changes as any).price);
    const newPrice = changes && typeof changes === "object" && "price" in changes
      ? Number((changes as any).price)
      : null;
    if (
      newPrice != null &&
      oldPrice > 0 &&
      newPrice < oldPrice &&
      (oldPrice - newPrice) / oldPrice > PRICE_DROP_PERCENT / 100
    ) {
      flags.push("price_drop");
    }
  }

  return flags;
}
