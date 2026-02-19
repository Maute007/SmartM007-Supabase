import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'http';

export type WSEvent =
  | { type: 'notification'; data: unknown }
  | { type: 'sale'; data: unknown }
  | { type: 'product'; data: unknown }
  | { type: 'order'; data: unknown }
  | { type: 'invalidate'; queryKey: string | string[] };

let wss: WebSocketServer | null = null;

export function attachWebSocket(server: Server): void {
  wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('pong', () => { /* keepalive */ });
  });

  wss.on('error', (err) => {
    console.error('[WebSocket] Error:', err.message);
  });

  console.log('[WebSocket] Server attached at /ws');
}

function broadcast(event: WSEvent): void {
  if (!wss) return;
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

export const wsEvents = {
  notification: (data: unknown) => broadcast({ type: 'notification', data }),
  sale: (data: unknown) => broadcast({ type: 'sale', data }),
  product: (data: unknown) => broadcast({ type: 'product', data }),
  order: (data: unknown) => broadcast({ type: 'order', data }),
  invalidate: (queryKey: string | string[]) => broadcast({ type: 'invalidate', queryKey }),
};
