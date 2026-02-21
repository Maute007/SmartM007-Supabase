import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Check, RotateCcw, ImageIcon } from 'lucide-react';
import { extractBarcodeFromCanvas } from '@/lib/barcodeScan';

interface BarcodeCameraScanProps {
  id?: string;
  onScan: (barcode: string) => void;
  onClose: () => void;
  /** Se true, fecha ao confirmar. Se false, mantém aberto para novo scan (ex: Scanner remoto) */
  closeOnConfirm?: boolean;
}

export function BarcodeCameraScan({ id = 'barcode-camera-scan', onScan, onClose, closeOnConfirm = true }: BarcodeCameraScanProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'capturing' | 'result' | 'error'>('loading');
  const [extractedCode, setExtractedCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().then(() => setStatus('ready')).catch(() => setStatus('error'));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err.message || 'Câmera não disponível. Use HTTPS no celular.');
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  const captureAndExtract = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    setStatus('capturing');

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('ready');
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    try {
      const code = await extractBarcodeFromCanvas(canvas);
      if (code) {
        setExtractedCode(code);
        setStatus('result');
        setErrorMsg('');
      } else {
        const msg =
          'Código não encontrado. Sugestões: aproxime o código, melhore a iluminação, mantenha a imagem estável. Tente novamente ou digite manualmente.';
        setErrorMsg(msg);
        setStatus('ready');
        setShowManualInput(true);
      }
    } catch (e) {
      const errStr = e instanceof Error ? e.message : String(e);
      const isDetectError =
        errStr.includes('MultiFormat Readers') ||
        errStr.includes('detect the code') ||
        errStr.includes('No barcode');
      const msg = isDetectError
        ? 'Código não detectado. Sugestões: aproxime o código, melhore a iluminação, mantenha a imagem estável. Tente novamente ou digite manualmente.'
        : errStr || 'Não foi possível ler o código.';
      setErrorMsg(msg);
      setStatus('ready');
      setShowManualInput(true);
    }
  };

  const handleConfirm = () => {
    const code = extractedCode.trim();
    if (code) {
      onScan(code);
      if (closeOnConfirm) {
        stopCamera();
        onClose();
      } else {
        setExtractedCode('');
        setStatus('ready');
      }
    }
  };

  const handleRetry = () => {
    setExtractedCode('');
    setErrorMsg('');
    setShowManualInput(false);
    setManualCode('');
    setStatus('ready');
  };

  const handleManualConfirm = () => {
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      if (closeOnConfirm) {
        stopCamera();
        onClose();
      } else {
        setManualCode('');
        setErrorMsg('');
        setShowManualInput(false);
        setStatus('ready');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: status === 'result' ? 'none' : 'block' }}
        />
        <canvas ref={canvasRef} className="hidden" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-white text-sm">A abrir câmera...</p>
          </div>
        )}
        {status === 'capturing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-white text-sm flex items-center gap-2">
              <ImageIcon className="h-5 w-5 animate-pulse" />
              A processar (escala cinza)...
            </p>
          </div>
        )}
        {status === 'result' && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/30">
            <Check className="h-16 w-16 text-emerald-400" />
          </div>
        )}
      </div>

      {status === 'result' ? (
        <div className="space-y-3">
          <Label>Verifique o código extraído:</Label>
          <Input
            value={extractedCode}
            onChange={(e) => setExtractedCode(e.target.value)}
            placeholder="Código de barras"
            className="font-mono text-lg"
            autoFocus
          />
          <div className="flex gap-2">
            <Button onClick={handleConfirm} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Confirmar
            </Button>
            <Button variant="outline" onClick={handleRetry}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nova foto
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button onClick={captureAndExtract} disabled={status !== 'ready'} className="w-full" size="lg">
            <Camera className="h-5 w-5 mr-2" />
            Capturar e ler
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Aponte para o código, toque para capturar. A foto é convertida em escala de cinza para melhor leitura.
          </p>
        </div>
      )}

      {errorMsg && (
        <p className="text-sm text-amber-600 dark:text-amber-500">{errorMsg}</p>
      )}

      {showManualInput && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <Label className="text-amber-700 dark:text-amber-400">Digitar manualmente</Label>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Código de barras"
              className="font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleManualConfirm()}
            />
            <Button onClick={handleManualConfirm} disabled={!manualCode.trim()}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={handleClose}>
        Fechar
      </Button>
    </div>
  );
}
