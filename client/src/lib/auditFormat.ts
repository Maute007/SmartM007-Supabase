/**
 * Formata logs de auditoria para linguagem humana e profissional.
 */

export interface AuditLogDisplay {
  actionLabel: string;
  entityLabel: string;
  summary: string;
  detailsText?: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_PRODUCT: 'Produto adicionado',
  UPDATE_PRODUCT: 'Produto atualizado',
  DELETE_PRODUCT: 'Produto removido',
  INCREASE_STOCK: 'Estoque aumentado',
  CREATE_SALE: 'Venda realizada',
  CREATE_USER: 'Usuário criado',
  UPDATE_USER: 'Usuário atualizado',
  DELETE_USER: 'Usuário removido',
  CREATE_CATEGORY: 'Categoria criada',
  DELETE_CATEGORY: 'Categoria removida',
  APPROVE_ORDER: 'Pedido aprovado',
  CANCEL_ORDER: 'Pedido cancelado',
  REOPEN_ORDER: 'Pedido reaberto',
  SALE_RETURN: 'Devolução registada',
};

const ENTITY_LABELS: Record<string, string> = {
  product: 'Produto',
  sale: 'Venda',
  user: 'Usuário',
  category: 'Categoria',
  order: 'Pedido',
};

function formatPaymentMethod(method?: string): string {
  const map: Record<string, string> = {
    cash: 'Dinheiro',
    card: 'Cartão',
    pix: 'PIX',
    mpesa: 'M-Pesa',
    emola: 'e-Mola',
    pos: 'POS',
    bank: 'Transferência',
    transfer: 'Transferência',
  };
  return (method && map[method]) || method || '-';
}

export function formatAuditLog(
  action: string,
  entityType: string,
  details?: Record<string, unknown> | null
): AuditLogDisplay {
  const actionLabel = ACTION_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const entityLabel = ENTITY_LABELS[entityType] ?? entityType;

  let summary = '';
  let detailsText: string | undefined;

  if (details) {
    const d = details as Record<string, unknown>;

    // Produto (create/update/delete)
    if (d.name && typeof d.name === 'string') {
      summary = d.name;
      if (d.sku) summary += ` (${d.sku})`;
    }

    // Estoque aumentado
    else if (d.productName && action === 'INCREASE_STOCK') {
      summary = String(d.productName);
      if (d.quantityAdded != null) summary += ` · +${d.quantityAdded}`;
      if (d.newStock != null) summary += ` → ${d.newStock} em estoque`;
    }

    // Venda ou Devolução
    else if (d.total != null || d.itemCount != null) {
      const total = d.total != null ? `MT ${Number(d.total).toFixed(2)}` : '';
      const items = d.itemCount != null ? `${d.itemCount} itens` : '';
      const method = formatPaymentMethod(d.paymentMethod as string);
      const parts = [total, items, method].filter(Boolean);
      summary = parts.join(' · ');
    }

    // Usuário
    else if (d.username || d.role) {
      const u = d.username ? `@${d.username}` : '';
      const r = d.role ? (d.role as string) : '';
      summary = [u, r].filter(Boolean).join(' · ');
    }

    // Categoria
    else if (d.name && entityType === 'category') {
      summary = String(d.name);
    }

    // Pedido (order)
    else if (d.orderCode) {
      summary = `Código ${d.orderCode}`;
      if (d.total != null) summary += ` · MT ${Number(d.total).toFixed(2)}`;
    }

    // UPDATE com changes
    else if (d.changes && typeof d.changes === 'object') {
      const ch = d.changes as Record<string, unknown>;
      const keys = Object.keys(ch);
      if (keys.length > 0) {
        detailsText = keys
          .map(k => {
            const v = ch[k];
            if (k === 'name') return `Nome: ${v}`;
            if (k === 'price') return `Preço: MT ${Number(v).toFixed(2)}`;
            if (k === 'stock') return `Estoque: ${v}`;
            return `${k}: ${v}`;
          })
          .join(', ');
      }
    }
  }

  return {
    actionLabel,
    entityLabel,
    summary: summary || entityLabel,
    detailsText,
  };
}
