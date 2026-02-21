import { useCallback } from 'react';
import { receiptsApi } from '@/lib/api';

export function useReceiptPrint() {
  const printReceipt = useCallback(async (saleId: string) => {
    const res = await fetch(`/api/receipts/preview/${saleId}?t=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text.includes('Venda não encontrada') ? 'Venda não encontrada' : 'Erro ao gerar recibo');
    }
    const html = await res.text();

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) throw new Error('Não foi possível criar janela de impressão');

    doc.open();
    doc.write(html);
    doc.close();

    // Usar setTimeout em vez de onload (onload pode não disparar com doc.write em alguns browsers)
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          reject(e);
          return;
        }
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 1000);
        resolve();
      };
      // Dar tempo ao parser para renderizar antes de imprimir
      setTimeout(done, 150);
    });
  }, []);

  const saveReceipt = useCallback(async (saleId: string) => {
    await receiptsApi.save(saleId);
  }, []);

  const printAndSaveReceipt = useCallback(async (saleId: string) => {
    const errors: string[] = [];
    // Guardar e imprimir em paralelo para maior robustez
    const [saveResult, printResult] = await Promise.allSettled([
      saveReceipt(saleId),
      printReceipt(saleId)
    ]);
    if (saveResult.status === 'rejected') errors.push('guardar');
    if (printResult.status === 'rejected') errors.push('imprimir');
    if (errors.length > 0) {
      throw new Error(`Erro ao ${errors.join(' e ')} recibo`);
    }
  }, [printReceipt, saveReceipt]);

  return { printReceipt, saveReceipt, printAndSaveReceipt };
}
