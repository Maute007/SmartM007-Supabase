import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { scannerApi } from '@/lib/api';
import { Check, Smartphone, Zap, Monitor, AlertTriangle } from 'lucide-react';
import { BarcodeCameraScan } from '@/components/BarcodeCameraScan';

export default function Scanner() {
  const [, params] = useRoute('/scanner/:token');
  const token = params?.token;
  const [status, setStatus] = useState<'loading' | 'ready' | 'scanning' | 'sent' | 'error' | 'revoked'>('loading');
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [lastProductName, setLastProductName] = useState<string | null>(null);
  const [lastNotFound, setLastNotFound] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | 'unknown'>('unknown');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);

  const pingSession = async (): Promise<void> => {
    if (!token) return Promise.resolve();
    const r = await scannerApi.ping(token);
    setDeviceType(r.deviceType as 'mobile' | 'desktop' | 'unknown');
    setExpiresIn(r.expiresIn);
    setChannelOpen(true);
  };

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    pingSession()
      .then(() => setStatus('ready'))
      .catch(() => { setStatus('revoked'); setChannelOpen(false); });

    const interval = setInterval(() => {
      pingSession().catch(() => { setStatus('revoked'); setChannelOpen(false); });
    }, 15_000);
    return () => clearInterval(interval);
  }, [token]);

  const handleBarcode = async (barcode: string) => {
    if (!token) return;
    try {
      const { product } = await scannerApi.send(token, barcode);
      setLastBarcode(barcode);
      setLastProductName(product?.name ?? null);
      setLastNotFound(!product);
      setStatus('sent');
      setTimeout(() => { setStatus('scanning'); setLastProductName(null); setLastNotFound(false); }, 1500);
      pingSession().catch(() => setStatus('revoked'));
    } catch {
      setStatus('revoked');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center text-red-400">
          <p>Link inválido ou expirado.</p>
        </div>
      </div>
    );
  }

  if (status === 'revoked') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Sessão revogada</h1>
          <p className="text-slate-400 text-sm">
            Este link foi invalidado pelo PDV. Abra o PDV no computador e gere um novo link se desejar continuar.
          </p>
        </div>
      </div>
    );
  }

  const isDesktop = deviceType === 'desktop';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/20 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-in fade-in duration-500">
        {isDesktop && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200 text-sm">
            <div className="flex gap-3">
              <Monitor className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Este link é para usar no celular</p>
                <p className="text-amber-200/80 mt-1">
                  Para escanear com a câmera, abra no celular. No PC você pode gerenciar e revogar sessões pelo PDV.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 mb-4">
            <Smartphone className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Scanner remoto</h1>
          <p className="text-slate-400 text-sm">Capture a foto do código e confira antes de enviar</p>
          {channelOpen && (
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-400/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">Canal aberto — sincronizado com o PDV</span>
            </div>
          )}
          {expiresIn != null && expiresIn > 0 && (
            <p className="text-slate-500 text-xs">Sessão renovada automaticamente • ~{Math.floor(expiresIn / 60)} min restantes</p>
          )}
        </div>

        {status === 'ready' ? (
          <button
            onClick={() => setStatus('scanning')}
            className="w-full py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Zap className="h-5 w-5" />
            Iniciar câmera
          </button>
        ) : status === 'scanning' ? (
          <div className="rounded-2xl overflow-hidden bg-black/40 border border-slate-600/50 p-4">
            <BarcodeCameraScan
              id="scanner-remote-capture"
              onScan={handleBarcode}
              onClose={() => setStatus('ready')}
              closeOnConfirm={false}
            />
          </div>
        ) : null}

        {status === 'sent' && lastBarcode && (
          lastNotFound ? (
            <div className="flex flex-col items-center gap-1 py-3 px-4 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="font-medium">Item não encontrado</span>
              </div>
              <p className="text-amber-400/80 text-xs">Código {lastBarcode} não existe no cadastro. Verifique no PDV.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-3 px-4 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 shrink-0" />
                <span className="font-medium">{lastProductName ? `${lastProductName} adicionado ao carrinho!` : `Enviado: ${lastBarcode}`}</span>
              </div>
              <p className="text-emerald-400/80 text-xs">O item foi enviado ao PDV. Escaneie o próximo.</p>
            </div>
          )
        )}

        <p className="text-center text-slate-500 text-xs">
          Confirme no celular e o item vai automaticamente ao carrinho do PDV — como no supermercado, mas com tecnologia inovadora.
        </p>
      </div>
    </div>
  );
}
