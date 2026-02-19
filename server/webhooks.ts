import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IncomingHttpHeaders } from 'node:http';

const WEBHOOKS_PATH = path.join(process.cwd(), 'data', 'webhooks.json');

export type WebhookEvent = 
  | 'sale.created'
  | 'notification.created'
  | 'order.approved'
  | 'order.cancelled'
  | 'product.updated'
  | 'stock.low';

export interface WebhookConfig {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string; // Para assinatura HMAC opcional
  enabled: boolean;
}

let webhooks: WebhookConfig[] = [];

function loadWebhooks(): WebhookConfig[] {
  try {
    const dir = path.dirname(WEBHOOKS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(WEBHOOKS_PATH)) {
      const data = fs.readFileSync(WEBHOOKS_PATH, 'utf-8');
      webhooks = JSON.parse(data);
    }
  } catch {
    webhooks = [];
  }
  return webhooks;
}

function saveWebhooks(): void {
  const dir = path.dirname(WEBHOOKS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WEBHOOKS_PATH, JSON.stringify(webhooks, null, 2), 'utf-8');
}

export function getAllWebhooks(): WebhookConfig[] {
  return loadWebhooks();
}

export function addWebhook(config: Omit<WebhookConfig, 'id'>): WebhookConfig {
  loadWebhooks();
  const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const webhook = { ...config, id };
  webhooks.push(webhook);
  saveWebhooks();
  return webhook;
}

export function updateWebhook(id: string, updates: Partial<WebhookConfig>): WebhookConfig | null {
  loadWebhooks();
  const idx = webhooks.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  webhooks[idx] = { ...webhooks[idx], ...updates };
  saveWebhooks();
  return webhooks[idx];
}

export function deleteWebhook(id: string): boolean {
  loadWebhooks();
  const len = webhooks.length;
  webhooks = webhooks.filter((w) => w.id !== id);
  if (webhooks.length < len) {
    saveWebhooks();
    return true;
  }
  return false;
}

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: unknown;
}

async function dispatchOne(webhook: WebhookConfig, payload: WebhookPayload): Promise<void> {
  if (!webhook.enabled || !webhook.events.includes(payload.event)) return;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      'User-Agent': 'Maute360-Webhook/1.0',
    };
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[Webhook] ${webhook.url} returned ${res.status}`);
    }
  } catch (err) {
    console.error(`[Webhook] Failed to call ${webhook.url}:`, err);
  }
}

export async function triggerWebhook(event: WebhookEvent, data: unknown): Promise<void> {
  loadWebhooks();
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  await Promise.allSettled(
    webhooks.map((w) => dispatchOne(w, payload))
  );
}
