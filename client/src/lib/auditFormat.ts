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
  PRODUCT_IMPORT: 'Importação de produtos',
  LOGIN_SUCCESS: 'Login (sucesso)',
  LOGIN_FAILED: 'Login (falha)',
  LOGOUT: 'Logout',
  RECEIPT_SETTINGS_UPDATED: 'Configurações de recibo atualizadas',
  RECEIPT_VIEWED: 'Recibo visualizado',
  RECEIPT_ACCESS_DENIED: 'Acesso ao recibo negado',
};

const ENTITY_LABELS: Record<string, string> = {
  product: 'Produto',
  sale: 'Venda',
  user: 'Usuário',
  category: 'Categoria',
  order: 'Pedido',
  auth: 'Autenticação',
  settings: 'Configurações',
  receipt: 'Recibo',
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

    // Auth (login/logout)
    else if (action === 'LOGIN_SUCCESS' || action === 'LOGIN_FAILED' || action === 'LOGOUT') {
      if (d.username) summary = `@${d.username}`;
      if (action === 'LOGIN_FAILED' && d.username) summary = `Tentativa com @${d.username}`;
    }

    // Configurações de recibo
    else if (action === 'RECEIPT_SETTINGS_UPDATED') {
      summary = 'Configurações de recibo e/ou identidade da loja alteradas';
    }

    // Recibo visualizado / acesso negado
    else if (action === 'RECEIPT_VIEWED') {
      summary = 'Recibo consultado';
    }
    else if (action === 'RECEIPT_ACCESS_DENIED') {
      summary = d.reason === 'file_not_found' ? 'Ficheiro de recibo não encontrado' : 'Acesso negado';
    }

    // Importação de produtos
    else if (action === 'PRODUCT_IMPORT') {
      const mode = d.mode === 'reset' ? 'Substituir tudo' : 'Adicionar/atualizar';
      const parts: string[] = [mode];
      if (d.added != null && Number(d.added) > 0) parts.push(`${d.added} adicionados`);
      if (d.updated != null && Number(d.updated) > 0) parts.push(`${d.updated} atualizados`);
      if (d.removed != null && Number(d.removed) > 0) parts.push(`${d.removed} removidos`);
      summary = parts.join(' · ');
      const addedList = (d.addedList as Array<{ name: string; quantity?: string | number; price: string; unit: string }>) || [];
      const updatedList = (d.updatedList as Array<{ name: string; unit: string; changes?: string[]; oldStock?: string; newStock?: string; oldPrice?: string; newPrice?: string }>) || [];
      const removedList = (d.removedList as Array<{ name: string; quantity: string | number; price: string; unit: string }>) || [];
      const lines: string[] = [];
      if (addedList.length > 0) {
        lines.push('Adicionados:');
        lines.push(...addedList.map(a => `  + ${a.name} (${a.quantity ?? 0} ${a.unit}, MT ${Number(a.price ?? 0).toFixed(2)})`));
      }
      if (updatedList.length > 0) {
        lines.push('Atualizados:');
        lines.push(...updatedList.map((u: any) => {
          if (u.changes && Array.isArray(u.changes)) {
            const ch = u.changes.join(' e ');
            let detail = `  • ${u.name}: ${ch}`;
            if (u.changes.includes('quantidade') && u.oldStock != null && u.newStock != null) {
              detail += ` (${u.oldStock} → ${u.newStock} ${u.unit})`;
            }
            if (u.changes.includes('preço') && u.oldPrice != null && u.newPrice != null) {
              detail += u.changes.includes('quantidade') ? `; preço MT ${Number(u.oldPrice).toFixed(2)} → MT ${Number(u.newPrice).toFixed(2)}` : ` (MT ${Number(u.oldPrice).toFixed(2)} → MT ${Number(u.newPrice).toFixed(2)})`;
            } else if (u.changes.includes('preço') && u.newPrice != null) {
              detail += ` (MT ${Number(u.newPrice).toFixed(2)})`;
            }
            return detail;
          }
          return `  • ${u.name} (${u.quantity ?? '-'} ${u.unit}, MT ${Number(u.price ?? 0).toFixed(2)})`;
        }));
      }
      if (removedList.length > 0) {
        lines.push('Removidos:');
        lines.push(...removedList.map(r => `  - ${r.name} (${r.quantity} ${r.unit}, MT ${Number(r.price).toFixed(2)})`));
      }
      if (lines.length > 0) detailsText = lines.join('\n');
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
