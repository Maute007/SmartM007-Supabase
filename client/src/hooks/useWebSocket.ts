import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type WSEvent =
  | { type: 'notification'; data: unknown }
  | { type: 'sale'; data: unknown }
  | { type: 'product'; data: unknown }
  | { type: 'order'; data: unknown }
  | { type: 'invalidate'; queryKey: string | string[] };

export function useWebSocket(enabled = true) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws`;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as WSEvent;
            if (msg.type === 'invalidate') {
              const keys = Array.isArray(msg.queryKey) ? msg.queryKey : [msg.queryKey];
              keys.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: [key], refetchType: 'active' });
              });
            } else {
              const map: Record<string, string[]> = {
                notification: ['notifications'],
                sale: ['/api/sales', 'notifications'],
                product: ['/api/products', 'notifications'],
                order: ['/api/orders', 'notifications'],
              };
              const keys = map[msg.type] ?? [];
              keys.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: [key], refetchType: 'active' });
              });
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
          reconnectAttempts.current += 1;
          reconnectRef.current = setTimeout(connect, delay);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, queryClient]);
}
