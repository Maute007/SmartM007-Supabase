/** Utilitários para leitura de código de barras com processamento de imagem */

/** Converte para escala de cinza - melhora leitura como leitores profissionais */
export function toGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Aumenta contraste para melhor visibilidade do código */
export function enhanceContrast(ctx: CanvasRenderingContext2D, width: number, height: number, factor = 1.15) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const mid = 128;
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      const idx = i + j;
      data[idx] = Math.min(255, Math.max(0, mid + (data[idx] - mid) * factor));
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Inverte preto/branco - para códigos invertidos */
export function invertColors(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Threshold binário - preto e branco puro */
export function applyBinaryThreshold(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  thresh = 128
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const v = gray > thresh ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Cria cópia do canvas redimensionada */
function scaleCanvas(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const w = Math.round(source.width * factor);
  const h = Math.round(source.height * factor);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0, w, h);
  return out;
}

/** Aplica variação a um canvas e retorna File para scan */
async function canvasToFile(canvas: HTMLCanvasElement): Promise<File | null> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
  if (!blob) return null;
  return new File([blob], 'capture.jpg', { type: 'image/jpeg' });
}

/** Tenta extrair código de um File usando Html5Qrcode */
async function tryScanFile(file: File): Promise<string | null> {
  const { Html5Qrcode } = await import('html5-qrcode');
  const scanElId = 'barcode-scan-helper';
  if (!document.getElementById(scanElId)) {
    const div = document.createElement('div');
    div.id = scanElId;
    div.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(div);
  }
  const scanner = new Html5Qrcode(scanElId, {
    useBarCodeDetectorIfSupported: true,
  });
  try {
    const result = await scanner.scanFile(file, false);
    const code = (typeof result === 'string' ? result : (result as { decodedText?: string })?.decodedText || '').trim();
    return code || null;
  } catch {
    return null;
  } finally {
    scanner.clear();
  }
}

/** Processa canvas com múltiplas variações e extrai código de barras */
export async function extractBarcodeFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const originalData = ctx.getImageData(0, 0, w, h);

  const restoreOriginal = () => {
    ctx.putImageData(originalData, 0, 0);
  };

  const variations: Array<{ name: string; apply: () => void }> = [
    { name: 'original', apply: () => restoreOriginal() },
    {
      name: 'grayscale+contrast',
      apply: () => {
        restoreOriginal();
        toGrayscale(ctx, w, h);
        enhanceContrast(ctx, w, h);
      },
    },
    {
      name: 'inverted',
      apply: () => {
        restoreOriginal();
        toGrayscale(ctx, w, h);
        enhanceContrast(ctx, w, h);
        invertColors(ctx, w, h);
      },
    },
    {
      name: 'threshold',
      apply: () => {
        restoreOriginal();
        toGrayscale(ctx, w, h);
        applyBinaryThreshold(ctx, w, h, 128);
      },
    },
  ];

  for (const v of variations) {
    v.apply();
    const file = await canvasToFile(canvas);
    if (!file) continue;
    const code = await tryScanFile(file);
    if (code) return code;
  }

  const scaled = scaleCanvas(canvas, 2);
  ctx.putImageData(originalData, 0, 0);
  const scaledCtx = scaled.getContext('2d');
  if (scaledCtx) {
    toGrayscale(scaledCtx, scaled.width, scaled.height);
    enhanceContrast(scaledCtx, scaled.width, scaled.height);
  }
  const scaledFile = await canvasToFile(scaled);
  if (scaledFile) {
    const code = await tryScanFile(scaledFile);
    if (code) return code;
  }

  restoreOriginal();
  return null;
}
