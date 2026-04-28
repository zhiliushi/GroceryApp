/**
 * Cascading barcode scanner engine hook.
 *
 * Priority:
 *   1. Native BarcodeDetector API (Chrome/Edge/Safari)
 *   2. html5-qrcode library (Firefox + fallback)
 *   3. Manual text entry (no camera)
 *
 * Provides a unified interface regardless of which engine is active.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type EngineType = 'native' | 'html5-qrcode' | 'manual';
export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'paused' | 'error';

interface UseScannerEngineReturn {
  engine: EngineType;
  status: ScannerStatus;
  error: string | null;
  /** ID for the <div> where the camera feed is rendered */
  viewfinderRef: string;
  startScanning: (onDetected: (barcode: string) => void) => Promise<void>;
  stopScanning: () => Promise<void>;
  switchEngine: () => void;
  /** Torch (flashlight LED) controls — only available on native engine + supported devices */
  hasTorch: boolean;
  torchOn: boolean;
  toggleTorch: () => Promise<void>;
}

const VIEWFINDER_ID = 'barcode-viewfinder';

export function useScannerEngine(): UseScannerEngineReturn {
  const [engine, setEngine] = useState<EngineType>(() =>
    typeof window !== 'undefined' && 'BarcodeDetector' in window ? 'native' : 'html5-qrcode',
  );
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const scannerRef = useRef<unknown>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const callbackRef = useRef<((barcode: string) => void) | null>(null);
  const lastBarcodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);
  // Generation counter — incremented on every cleanup/start. After each async
  // boundary, we check if the generation still matches. If not, the operation
  // is stale (cleanup or a new startScanning call happened) and we abort.
  // This handles: React 18 Strict Mode double-mount, rapid open/close,
  // and overlapping startScanning calls.
  const genRef = useRef(0);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      _cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _cleanup = useCallback(async () => {
    // Bump generation — any in-flight async ops from startScanning will see
    // a mismatch and abort, preventing orphaned streams.
    genRef.current++;

    // Stop animation frame
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    // Stop html5-qrcode
    if (scannerRef.current && typeof (scannerRef.current as { stop?: () => Promise<void> }).stop === 'function') {
      try {
        await (scannerRef.current as { stop: () => Promise<void> }).stop();
      } catch { /* already stopped */ }
    }
    scannerRef.current = null;
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Reset torch
    videoTrackRef.current = null;
    setHasTorch(false);
    setTorchOn(false);
  }, []);

  const startScanning = useCallback(async (onDetected: (barcode: string) => void) => {
    // Stop any previous session first
    await _cleanup();

    callbackRef.current = onDetected;
    // Claim a new generation for this scan session
    const gen = ++genRef.current;
    setError(null);
    setStatus('starting');

    try {
      if (engine === 'native') {
        await _startNative(onDetected, gen);
      } else if (engine === 'html5-qrcode') {
        await _startHtml5Qrcode(onDetected, gen);
      } else {
        setStatus('idle');
      }
    } catch (err) {
      // Only show error if this generation is still current
      if (gen === genRef.current) {
        const msg = _classifyCameraError(err);
        setError(msg);
        setStatus('error');
      }
    }
  }, [engine, _cleanup]);

  const stopScanning = useCallback(async () => {
    await _cleanup();
    setStatus('idle');
  }, [_cleanup]);

  const switchEngine = useCallback(() => {
    _cleanup();
    setEngine((prev) => {
      if (prev === 'native') return 'html5-qrcode';
      if (prev === 'html5-qrcode') return 'manual';
      return 'html5-qrcode';
    });
    setStatus('idle');
    setError(null);
  }, [_cleanup]);

  // --- Native BarcodeDetector ---
  async function _startNative(onDetected: (barcode: string) => void, gen: number) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    // If generation changed (cleanup/restart happened during getUserMedia), kill this stream
    if (gen !== genRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    // Detect torch capability
    const vTrack = stream.getVideoTracks()[0];
    videoTrackRef.current = vTrack;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caps = (vTrack as any).getCapabilities?.();
      setHasTorch(!!caps?.torch);
    } catch { setHasTorch(false); }

    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    await video.play();

    // Check again after video.play()
    if (gen !== genRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      streamRef.current = null;
      return;
    }

    // Mount video into the viewfinder div
    const container = document.getElementById(VIEWFINDER_ID);
    if (container) {
      container.innerHTML = '';
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.borderRadius = '8px';
      container.appendChild(video);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
    });

    setStatus('scanning');

    const scan = async () => {
      if (gen !== genRef.current || !streamRef.current?.active) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const value = barcodes[0].rawValue;
          if (_shouldEmit(value)) {
            onDetected(value);
          }
        }
      } catch { /* frame not ready */ }
      if (gen === genRef.current) {
        animFrameRef.current = requestAnimationFrame(scan);
      }
    };
    animFrameRef.current = requestAnimationFrame(scan);
  }

  // --- html5-qrcode ---
  async function _startHtml5Qrcode(onDetected: (barcode: string) => void, gen: number) {
    const { Html5Qrcode } = await import('html5-qrcode');
    if (gen !== genRef.current) return;

    const scanner = new Html5Qrcode(VIEWFINDER_ID);
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        // Responsive qrbox: ~75% of the smaller viewport dimension, capped to
        // sane bounds. Fixes off-screen scan target on narrow phones where a
        // 280px-wide hard-coded qrbox sat below the visible frame.
        qrbox: (vw: number, vh: number) => {
          const min = Math.min(vw, vh);
          const side = Math.max(160, Math.min(320, Math.floor(min * 0.75)));
          return { width: side, height: Math.floor(side * 0.6) };
        },
        // Match the modal container's aspect-[4/3] wrapper. Mismatched
        // aspectRatio (was 16:9) causes html5-qrcode to crop the feed and
        // shift the scan target outside the visible box.
        aspectRatio: 4 / 3,
      },
      (decodedText) => {
        if (_shouldEmit(decodedText)) {
          onDetected(decodedText);
        }
      },
      () => { /* ignore errors during scanning */ },
    );

    // If generation changed while scanner.start() was running (it calls getUserMedia
    // internally), stop the scanner immediately — otherwise the stream is orphaned.
    if (gen !== genRef.current) {
      try { await scanner.stop(); } catch { /* */ }
      scannerRef.current = null;
      return;
    }

    setStatus('scanning');
  }

  // --- Debounce: ignore same barcode within 3 seconds ---
  function _shouldEmit(barcode: string): boolean {
    const now = Date.now();
    if (barcode === lastBarcodeRef.current && now - lastTimeRef.current < 3000) {
      return false;
    }
    lastBarcodeRef.current = barcode;
    lastTimeRef.current = now;
    return true;
  }

  const toggleTorch = useCallback(async () => {
    if (!videoTrackRef.current) return;
    const newState = !torchOn;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await videoTrackRef.current.applyConstraints({ advanced: [{ torch: newState } as any] });
      setTorchOn(newState);
    } catch { /* torch not supported or track stopped */ }
  }, [torchOn]);

  return {
    engine,
    status,
    error,
    viewfinderRef: VIEWFINDER_ID,
    startScanning,
    stopScanning,
    switchEngine,
    hasTorch,
    torchOn,
    toggleTorch,
  };
}

function _classifyCameraError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  if (name === 'NotAllowedError' || msg.includes('Permission denied')) {
    return 'Camera access was blocked. Check your browser permissions (click the lock icon in the address bar).';
  }
  if (name === 'NotReadableError') {
    return 'Camera is in use by another application. Close it and try again.';
  }
  if (name === 'SecurityError' || msg.includes('secure context')) {
    return 'Camera requires HTTPS. Use manual entry or access via HTTPS.';
  }
  if (name === 'NotFoundError' || msg.includes('Requested device not found')) {
    return 'No camera detected on this device.';
  }
  if (msg.includes('html5-qrcode')) {
    return 'Scanner library failed to load. Try manual entry.';
  }
  return `Camera error: ${msg}`;
}