import type { Request } from "express";

export interface AuditContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Extract IP and User-Agent from request for audit logs.
 * Uses x-forwarded-for when behind a proxy (first hop = client).
 */
export function getAuditContext(req: Request): AuditContext {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]?.trim()
        : null) ?? req.ip ?? req.socket?.remoteAddress ?? null;
  const userAgent =
    (req.headers["user-agent"] as string | undefined) ?? null;
  return { ipAddress: ip ?? null, userAgent };
}
