import * as fs from 'node:fs';
import * as path from 'node:path';
import { format, getWeek, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type ReceiptPaperSize = '80x60' | '80x70' | '80x80' | 'a6';

export interface ReceiptSettings {
  paperSize: ReceiptPaperSize;
  printOnConfirm: boolean;
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
  userName: string;
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

export function generateReceiptHTML(data: ReceiptData, paperSize: ReceiptPaperSize): string {
  const { width, height } = getPaperSizeMm(paperSize);

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

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Recibo #${data.saleId}</title>
  <style>
    @page { size: ${width}mm ${height}mm; margin: 2mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #111;
      width: ${width}mm;
      min-height: ${height}mm;
      padding: 3mm 4mm;
    }
    .receipt { max-width: 100%; }
    .logo-wrap { text-align: center; margin-bottom: 6px; }
    .logo-wrap img { max-width: 100%; height: auto; max-height: 24mm; object-fit: contain; }
    .ticket-id {
      text-align: center;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 1px;
      padding: 4px 0;
      margin: 6px 0;
      border-top: 2px dashed #000;
      border-bottom: 2px dashed #000;
    }
    .meta { text-align: center; font-size: 10px; color: #333; margin-bottom: 8px; }
    .separator { border-top: 1px dashed #333; margin: 6px 0; }
    .items { width: 100%; border-collapse: collapse; }
    .item-row td { padding: 2px 0; font-size: 11px; vertical-align: top; }
    .item-name { font-weight: 600; }
    .item-detail td { font-size: 10px; color: #444; padding-left: 2px; }
    .item-total td { font-size: 10px; text-align: right; padding-bottom: 4px; border-bottom: 1px dotted #999; }
    .totals { margin-top: 8px; font-size: 11px; }
    .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals .grand { font-size: 13px; font-weight: bold; margin-top: 4px; padding: 4px 0; border-top: 2px solid #000; }
    .payment-info { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #333; font-size: 10px; }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 9px;
      color: #555;
      padding-top: 6px;
      border-top: 2px dashed #000;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="logo-wrap">
      <img src="/logo-maute360.png" alt="Maute360" onerror="this.style.display='none'">
    </div>
    <div class="ticket-id"># ${data.saleId}</div>
    <div class="meta">
      ${format(new Date(data.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}<br>
      Atendente: ${escapeHtml(data.userName)}
    </div>
    <div class="separator"></div>
    <table class="items"><tbody>${itemsHtml}</tbody></table>
    <div class="separator"></div>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
      ${data.discountAmount > 0 ? `<div class="row" style="color:#0a5"><span>Desconto</span><span>-${formatCurrency(data.discountAmount)}</span></div>` : ''}
      <div class="row grand"><span>TOTAL</span><span>${formatCurrency(data.total)}</span></div>
    </div>
    <div class="payment-info">
      <div class="row"><span>Forma de Pagamento</span><span>${escapeHtml(paymentLabel)}</span></div>
      ${data.amountReceived != null ? `<div class="row"><span>Recebido</span><span>${formatCurrency(data.amountReceived)}</span></div>` : ''}
      ${data.change != null ? `<div class="row"><span>Troco</span><span>${formatCurrency(data.change)}</span></div>` : ''}
    </div>
    <div class="footer">
      <strong>ID: ${data.saleId}</strong><br>
      Obrigado pela preferência!<br>
      Maute360 — Sistema de Gestão
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

export function saveReceiptToDisk(data: ReceiptData, paperSize: ReceiptPaperSize): string {
  ensureReceiptsDir();
  const html = generateReceiptHTML(data, paperSize);
  const d = new Date(data.createdAt);
  const year = getYear(d).toString();
  const month = format(d, 'MM');
  const week = getWeek(d, { firstWeekContainsDate: 4 });
  const dir = path.join(RECEIPTS_BASE, year, month, `semana-${week.toString().padStart(2, '0')}`);
  const filename = `recibo-${format(d, 'yyyy-MM-dd-HH-mm-ss')}.html`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}
