import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { format, getWeek, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type ReceiptPaperSize = '80x60' | '80x70' | '80x80' | 'a6';

export interface ReceiptStoreBranding {
  storeName?: string;
  storeTagline?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  /** Data URL completa (data:image/png;base64,...) para preservar tipo MIME */
  logoBase64?: string;
  footerText?: string;
}

export interface ReceiptSettings {
  paperSize: ReceiptPaperSize;
  printOnConfirm: boolean;
  branding?: ReceiptStoreBranding;
}

const PAPER_SIZES: Record<ReceiptPaperSize, { width: number; height: number }> = {
  '80x60': { width: 80, height: 60 },
  '80x70': { width: 80, height: 70 },
  '80x80': { width: 80, height: 80 },
  'a6': { width: 105, height: 148 },
};

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'receipt-settings.json');
const RECEIPTS_BASE = path.join(process.cwd(), 'receipts');

const DEFAULT_SETTINGS: ReceiptSettings = {
  paperSize: '80x80',
  printOnConfirm: false,
};

export function getReceiptSettings(): ReceiptSettings {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveReceiptSettings(settings: ReceiptSettings): void {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

export function getPaperSizeMm(size: ReceiptPaperSize): { width: number; height: number } {
  return PAPER_SIZES[size] ?? PAPER_SIZES['80x80'];
}

export interface ReceiptData {
  saleId: string;
  createdAt: Date;
  sellerName: string;
  items: Array<{ name: string; quantity: number; unit: string; price: number; total: number }>;
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  amountReceived?: number;
  change?: number;
}

function formatCurrency(value: number): string {
  return `MT ${value.toFixed(2)}`;
}

export function generateReceiptHTML(data: ReceiptData, paperSize: ReceiptPaperSize, settings?: ReceiptSettings): string {
  const { width, height } = getPaperSizeMm(paperSize);
  const b = settings?.branding ?? {};

  const storeName = b.storeName?.trim() || 'Minha Loja';
  const storeTagline = b.storeTagline?.trim() || '';
  const storeAddress = b.storeAddress?.trim() || '';
  const storePhone = b.storePhone?.trim() || '';
  const storeEmail = b.storeEmail?.trim() || '';
  const footerText = b.footerText?.trim() || 'Obrigado pela preferência!';
  const logoSrc = b.logoBase64
    ? (b.logoBase64.startsWith('data:') ? b.logoBase64 : `data:image/png;base64,${b.logoBase64}`)
    : '/logo-maute360.png';

  const itemsHtml = data.items
    .map(
      (i) => `
    <tr class="item-row">
      <td class="item-name">${escapeHtml(i.name)}</td>
    </tr>
    <tr class="item-detail">
      <td>${i.quantity.toFixed(i.unit === 'kg' ? 3 : 0)} ${i.unit} × ${formatCurrency(i.price)}</td>
    </tr>
    <tr class="item-total">
      <td>${formatCurrency(i.total)}</td>
    </tr>`
    )
    .join('');

  const paymentLabels: Record<string, string> = {
    cash: 'Dinheiro',
    card: 'Cartão',
    pix: 'PIX',
    mpesa: 'M-Pesa',
    emola: 'e-Mola',
    pos: 'POS',
    bank: 'Transferência'
  };
  const paymentLabel = paymentLabels[data.paymentMethod.toLowerCase()] ?? data.paymentMethod;
  const dateStr = format(new Date(data.createdAt), "dd/MM/yyyy", { locale: ptBR });
  const timeStr = format(new Date(data.createdAt), "HH:mm:ss", { locale: ptBR });

  const compactClass = data.items.length <= 4 ? ' receipt-compact' : '';
  const integrityPayload = JSON.stringify({ s: data.saleId, t: data.total, d: format(new Date(data.createdAt), "yyyy-MM-dd'T'HH:mm:ss") });
  const integrityHash = crypto.createHash('sha256').update(integrityPayload).digest('hex').slice(0, 16);
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Recibo #${data.saleId.slice(0, 8)}</title>
  <!-- SIG:${integrityHash} -->
  <style>
    @page { size: A4; margin: 8mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .receipt-block { break-inside: avoid; page-break-inside: avoid; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 8px;
      line-height: 1.25;
      color: #1a1a1a;
      padding: 2mm;
      background: #fff;
    }
    .receipt-block {
      width: ${width}mm;
      min-height: auto;
      margin: 0 auto 4mm;
      padding: 2mm 3mm;
      border: 1px solid #ddd;
      border-radius: 2px;
    }
    .receipt { max-width: 100%; }
    .receipt-compact .header { padding-bottom: 3px; margin-bottom: 3px; }
    .receipt-compact .logo-wrap img { max-height: 14mm; }
    .receipt-compact .store-name { font-size: 9px; }
    .receipt-compact .store-tagline, .receipt-compact .store-contact { font-size: 7px; }
    .receipt-compact .ticket-id { font-size: 9px; padding: 3px 0; margin: 3px 0; }
    .receipt-compact .meta { font-size: 7px; }
    .receipt-compact .meta .label { font-size: 6px; }
    .receipt-compact .item-name, .receipt-compact .item-row td { font-size: 8px; }
    .receipt-compact .item-detail td, .receipt-compact .item-total td { font-size: 7px; }
    .receipt-compact .totals, .receipt-compact .payment-info { font-size: 8px; }
    .receipt-compact .totals .grand { font-size: 9px; padding: 3px 0; }
    .receipt-compact .footer { font-size: 6px; margin-top: 4px; padding-top: 4px; }
    .header {
      text-align: center;
      padding-bottom: 4px;
      border-bottom: 1px dashed #333;
      margin-bottom: 4px;
    }
    .logo-wrap { margin-bottom: 2px; }
    .logo-wrap img { max-width: 45mm; height: auto; max-height: 16mm; object-fit: contain; display: block; margin: 0 auto; }
    .store-name { font-size: 10px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; line-height: 1.1; }
    .store-tagline { font-size: 7px; color: #555; margin-top: 1px; }
    .store-contact { font-size: 6px; color: #666; margin-top: 2px; line-height: 1.2; }
    .ticket-id {
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 3px 0;
      margin: 4px 0;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 2px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      font-size: 7px;
      color: #444;
      margin-bottom: 4px;
      gap: 2px;
    }
    .meta span { flex: 1; }
    .meta .label { color: #888; font-size: 6px; }
    .separator { border-top: 1px dashed #999; margin: 4px 0; }
    .items { width: 100%; border-collapse: collapse; }
    .item-row td { padding: 1px 0; font-size: 8px; vertical-align: top; }
    .item-name { font-weight: 600; }
    .item-detail td { font-size: 7px; color: #555; padding-left: 1px; }
    .item-total td { font-size: 7px; text-align: right; padding-bottom: 3px; border-bottom: 1px dotted #ccc; }
    .totals { margin-top: 4px; font-size: 8px; }
    .totals .row { display: flex; justify-content: space-between; padding: 1px 0; }
    .totals .grand { font-size: 9px; font-weight: 700; margin-top: 2px; padding: 4px 0; border-top: 2px solid #1a1a1a; letter-spacing: 0.3px; }
    .payment-info { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #999; font-size: 7px; }
    .payment-info .row { display: flex; justify-content: space-between; padding: 1px 0; }
    .footer {
      margin-top: 4px;
      text-align: center;
      font-size: 6px;
      color: #666;
      padding-top: 4px;
      border-top: 2px dashed #333;
      line-height: 1.3;
    }
    .footer-id { font-weight: 600; color: #333; margin-bottom: 1px; }
  </style>
</head>
<body>
  <div class="receipt-block${compactClass}">
  <div class="receipt">
    <div class="header">
      <div class="logo-wrap">
        <img src="${logoSrc}" alt="${escapeHtml(storeName)}" onerror="this.style.display='none'">
      </div>
      <div class="store-name">${escapeHtml(storeName)}</div>
      ${storeTagline ? `<div class="store-tagline">${escapeHtml(storeTagline)}</div>` : ''}
      ${(storeAddress || storePhone || storeEmail) ? `
      <div class="store-contact">
        ${storeAddress ? escapeHtml(storeAddress) + '<br>' : ''}
        ${storePhone ? escapeHtml(storePhone) + (storeEmail ? ' · ' : '') : ''}
        ${storeEmail ? escapeHtml(storeEmail) : ''}
      </div>` : ''}
    </div>
    <div class="ticket-id"># ${escapeHtml(data.saleId.slice(0, 8).toUpperCase())}</div>
    <div class="meta">
      <span><span class="label">Data</span><br>${dateStr}</span>
      <span><span class="label">Hora</span><br>${timeStr}</span>
      <span><span class="label">Vendedor</span><br>${escapeHtml(data.sellerName)}</span>
    </div>
    <div class="separator"></div>
    <table class="items"><tbody>${itemsHtml}</tbody></table>
    <div class="separator"></div>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
      ${data.discountAmount > 0 ? `<div class="row" style="color:#059669"><span>Desconto</span><span>-${formatCurrency(data.discountAmount)}</span></div>` : ''}
      <div class="row grand"><span>TOTAL</span><span>${formatCurrency(data.total)}</span></div>
    </div>
    <div class="payment-info">
      <div class="row"><span>Pagamento</span><span>${escapeHtml(paymentLabel)}</span></div>
      ${data.amountReceived != null ? `<div class="row"><span>Recebido</span><span>${formatCurrency(data.amountReceived)}</span></div>` : ''}
      ${data.change != null ? `<div class="row"><span>Troco</span><span>${formatCurrency(data.change)}</span></div>` : ''}
    </div>
    <div class="footer">
      <div class="footer-id">ID: ${escapeHtml(data.saleId.slice(0, 8))}</div>
      ${footerText.split('\n').map(l => escapeHtml(l)).join('<br>')}
    </div>
  </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ensureReceiptsDir(): void {
  if (!fs.existsSync(RECEIPTS_BASE)) {
    fs.mkdirSync(RECEIPTS_BASE, { recursive: true });
  }
}

/** Caminho relativo (a partir de receipts/) para um recibo, dado saleId e createdAt */
export function getReceiptRelativePath(saleId: string, createdAt: Date): string {
  const d = new Date(createdAt);
  const year = getYear(d).toString();
  const month = format(d, 'MM');
  const week = getWeek(d, { firstWeekContainsDate: 4 });
  return path.join(year, month, `semana-${week.toString().padStart(2, '0')}`, `recibo-${saleId}.html`);
}

export function getReceiptAbsolutePath(saleId: string, createdAt: Date): string {
  return path.join(RECEIPTS_BASE, getReceiptRelativePath(saleId, createdAt));
}

export function receiptExists(saleId: string, createdAt: Date): boolean {
  return fs.existsSync(getReceiptAbsolutePath(saleId, createdAt));
}

export function saveReceiptToDisk(data: ReceiptData, paperSize: ReceiptPaperSize, settings?: ReceiptSettings): string {
  ensureReceiptsDir();
  const html = generateReceiptHTML(data, paperSize, settings ?? getReceiptSettings());
  const dir = path.join(RECEIPTS_BASE, path.dirname(getReceiptRelativePath(data.saleId, data.createdAt)));

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(RECEIPTS_BASE, getReceiptRelativePath(data.saleId, data.createdAt));
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

/** Lista recibos por pasta (ano/mês/semana) - para UI de ficheiros */
export function listReceiptFiles(): Array<{ path: string; saleId: string; createdAt: string }> {
  const results: Array<{ path: string; saleId: string; createdAt: string }> = [];
  if (!fs.existsSync(RECEIPTS_BASE)) return results;
  function walk(dir: string, basePath: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.join(basePath, e.name);
      if (e.isDirectory()) walk(full, rel);
      else if (e.name.endsWith('.html') && e.name.startsWith('recibo-')) {
        const saleId = e.name.replace('recibo-', '').replace('.html', '');
        if (saleId.length !== 36 || !saleId.includes('-')) continue;
        try {
          const stat = fs.statSync(full);
          results.push({ path: rel.replace(/\\/g, '/'), saleId, createdAt: stat.mtime.toISOString() });
        } catch {
          results.push({ path: rel.replace(/\\/g, '/'), saleId, createdAt: '' });
        }
      }
    }
  }
  walk(RECEIPTS_BASE, '');
  return results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
