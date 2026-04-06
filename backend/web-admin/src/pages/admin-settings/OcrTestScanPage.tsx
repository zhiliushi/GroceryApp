import { useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOcrTestScan } from '@/api/mutations/useOcrMutations';
import { useAddToInventory } from '@/api/mutations/useBarcodeMutations';
import { useLocations } from '@/api/queries/useLocations';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type { OcrTestBox } from '@/types/api';

// --- Field mapping config ---
const MAPPABLE_FIELDS = [
  { key: 'skip', label: '(Skip)', color: '#9CA3AF' },
  { key: 'name', label: 'Product Name', color: '#3B82F6' },
  { key: 'brand', label: 'Brand', color: '#8B5CF6' },
  { key: 'price', label: 'Price', color: '#10B981' },
  { key: 'quantity', label: 'Quantity', color: '#F59E0B' },
  { key: 'barcode', label: 'Barcode', color: '#EC4899' },
  { key: 'expiry_date', label: 'Expiry Date', color: '#EF4444' },
  { key: 'weight', label: 'Weight', color: '#06B6D4' },
  { key: 'weight_unit', label: 'Weight Unit', color: '#6366F1' },
] as const;

type FieldKey = (typeof MAPPABLE_FIELDS)[number]['key'];

function getFieldColor(key: string): string {
  return MAPPABLE_FIELDS.find((f) => f.key === key)?.color || '#9CA3AF';
}

// --- Extended box with user edits ---
interface EditableBox extends OcrTestBox {
  mapping: FieldKey;
  editedText: string;
  isManual?: boolean;
}

// --- Field value parsers ---
function parsePrice(text: string): number {
  const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseQuantity(text: string): number {
  const match = text.match(/\d+/);
  return match ? Math.max(1, parseInt(match[0])) : 1;
}

function parseBarcode(text: string): string {
  return text.replace(/\s/g, '');
}

function parseExpiry(text: string): string {
  const t = text.replace(/^(EXP|BEST BEFORE|USE BY|BB)\s*:?\s*/i, '').trim();
  // Try DD/MM/YYYY
  const dmy = t.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // Try MMM YYYY
  const months: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
  const my = t.match(/([A-Z]{3})\s*(\d{4})/i);
  if (my && months[my[1].toUpperCase()]) {
    return `${my[2]}-${months[my[1].toUpperCase()]}-01`;
  }
  return t;
}

function parseWeight(text: string): { weight: number | null; unit: string | null } {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb)/i);
  if (match) return { weight: parseFloat(match[1]), unit: match[2].toLowerCase() };
  return { weight: null, unit: null };
}

// --- SVG Box Overlay ---
function BoxOverlay({
  boxes,
  selectedId,
  onSelect,
  isDrawing,
  drawRect,
}: {
  boxes: EditableBox[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isDrawing: boolean;
  drawRect: { x: number; y: number; w: number; h: number } | null;
}) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {boxes.map((box) => {
        const color = getFieldColor(box.mapping);
        const isSelected = box.id === selectedId;
        const isLow = box.confidence < 40;
        return (
          <g key={box.id} className="pointer-events-auto cursor-pointer" onClick={() => onSelect(box.id)}>
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              fill={`${color}15`}
              stroke={color}
              strokeWidth={isSelected ? 0.5 : 0.25}
              strokeDasharray={isLow ? '0.5 0.3' : undefined}
              rx={0.15}
            />
            {isSelected && (
              <rect
                x={box.x - 0.15}
                y={box.y - 0.15}
                width={box.w + 0.3}
                height={box.h + 0.3}
                fill="none"
                stroke="#7C3AED"
                strokeWidth={0.3}
                rx={0.2}
              />
            )}
          </g>
        );
      })}
      {/* Drawing rectangle */}
      {isDrawing && drawRect && (
        <rect
          x={drawRect.x}
          y={drawRect.y}
          width={drawRect.w}
          height={drawRect.h}
          fill="rgba(124, 58, 237, 0.1)"
          stroke="#7C3AED"
          strokeWidth={0.3}
          strokeDasharray="0.5 0.3"
        />
      )}
    </svg>
  );
}

// --- Box Card ---
function BoxCard({
  box,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
}: {
  box: EditableBox;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<EditableBox>) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
        isSelected
          ? 'border-ga-accent bg-ga-accent/5'
          : 'border-ga-border hover:border-ga-accent/30'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: getFieldColor(box.mapping) }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <input
            value={box.editedText}
            onChange={(e) => onUpdate({ editedText: e.target.value })}
            className="w-full bg-transparent text-sm text-ga-text-primary font-medium outline-none border-b border-transparent focus:border-ga-accent"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!box.isManual && (
            <span className={`text-[10px] ${box.confidence >= 70 ? 'text-green-600' : box.confidence >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
              {Math.round(box.confidence)}%
            </span>
          )}
          {box.isManual && <span className="text-[10px] text-ga-accent">manual</span>}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-red-400 hover:text-red-600 text-xs p-0.5"
            title="Remove box"
          >
            ✕
          </button>
        </div>
      </div>
      <select
        value={box.mapping}
        onChange={(e) => onUpdate({ mapping: e.target.value as FieldKey })}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-xs text-ga-text-primary"
      >
        {MAPPABLE_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}

// --- Main Page ---
export default function OcrTestScanPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<EditableBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [scanInfo, setScanInfo] = useState<{ duration_ms: number; lang: string; boxCount: number } | null>(null);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [location, setLocation] = useState('pantry');
  const [quantity, setQuantity] = useState(1);

  const photoRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const nextBoxId = useRef(0);

  const scanMutation = useOcrTestScan();
  const addMutation = useAddToInventory();
  const { locations } = useLocations();
  const uid = useAuthStore((s) => s.user?.uid);

  // --- Image handling ---
  const handleFile = useCallback((file: File) => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setBoxes([]);
    setRawText('');
    setScanInfo(null);
    setSelectedId(null);
  }, [imageUrl]);

  const handleReset = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(null);
    setImageUrl(null);
    setBoxes([]);
    setRawText('');
    setScanInfo(null);
    setSelectedId(null);
    setIsDrawMode(false);
  }, [imageUrl]);

  // --- Handle document/PDF upload (render first page to image) ---
  const handleDocFile = useCallback(async (file: File) => {
    if (file.type === 'application/pdf') {
      try {
        // Dynamically load pdfjs
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 }); // 2x for clarity
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          handleFile(new File([blob], file.name.replace('.pdf', '.png'), { type: 'image/png' }));
        } else {
          toast.error('Failed to render PDF page');
        }
      } catch {
        toast.error('Failed to process PDF. Try converting to an image first.');
      }
    } else {
      // Regular image
      handleFile(file);
    }
  }, [handleFile]);

  // --- Rotate image ---
  const rotateImage = useCallback((degrees: number) => {
    if (!imageFile) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const swap = degrees === 90 || degrees === 270;
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob((blob) => {
        if (blob) {
          const rotated = new File([blob], imageFile.name, { type: imageFile.type });
          handleFile(rotated);
        }
      }, imageFile.type);
    };
    img.src = URL.createObjectURL(imageFile);
  }, [imageFile, handleFile]);

  // --- Run Tesseract ---
  const handleScan = useCallback(async () => {
    if (!imageFile) return;
    try {
      const result = await scanMutation.mutateAsync(imageFile);
      if (result.success) {
        const editableBoxes: EditableBox[] = result.boxes.map((b) => ({
          ...b,
          mapping: 'skip' as FieldKey,
          editedText: b.text,
        }));
        setBoxes(editableBoxes);
        setRawText(result.raw_text);
        setScanInfo({ duration_ms: result.duration_ms, lang: result.lang, boxCount: result.boxes.length });
        nextBoxId.current = result.boxes.length;
      } else {
        toast.error(result.error || 'OCR failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      toast.error(msg);
    }
  }, [imageFile, scanMutation]);

  // --- Box operations ---
  const updateBox = useCallback((id: string, updates: Partial<EditableBox>) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const deleteBox = useCallback((id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  // --- Draw box (mouse) ---
  const getPercent = useCallback((e: React.MouseEvent) => {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isDrawMode) return;
    const pt = getPercent(e);
    if (pt) {
      setDrawStart(pt);
      setDrawRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  }, [isDrawMode, getPercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawStart) return;
    const pt = getPercent(e);
    if (pt) {
      setDrawRect({
        x: Math.min(drawStart.x, pt.x),
        y: Math.min(drawStart.y, pt.y),
        w: Math.abs(pt.x - drawStart.x),
        h: Math.abs(pt.y - drawStart.y),
      });
    }
  }, [drawStart, getPercent]);

  const handleMouseUp = useCallback(() => {
    if (!drawRect || drawRect.w < 1 || drawRect.h < 0.5) {
      setDrawStart(null);
      setDrawRect(null);
      return;
    }
    const id = `m_${nextBoxId.current++}`;
    const newBox: EditableBox = {
      id,
      text: '',
      confidence: 100,
      x: Math.round(drawRect.x * 100) / 100,
      y: Math.round(drawRect.y * 100) / 100,
      w: Math.round(drawRect.w * 100) / 100,
      h: Math.round(drawRect.h * 100) / 100,
      word_count: 0,
      mapping: 'skip',
      editedText: '',
      isManual: true,
    };
    setBoxes((prev) => [...prev, newBox]);
    setSelectedId(id);
    setDrawStart(null);
    setDrawRect(null);
    setIsDrawMode(false);
  }, [drawRect]);

  // --- Derive mapped item preview ---
  const preview = useMemo(() => {
    const mapped = boxes.filter((b) => b.mapping !== 'skip');
    const get = (key: string) => mapped.filter((b) => b.mapping === key).map((b) => b.editedText).join(' ').trim();

    const name = get('name');
    const brand = get('brand');
    const priceText = get('price');
    const qtyText = get('quantity');
    const barcodeText = get('barcode');
    const expiryText = get('expiry_date');
    const weightText = get('weight');
    const weightUnitText = get('weight_unit');

    const price = priceText ? parsePrice(priceText) : null;
    const qty = qtyText ? parseQuantity(qtyText) : null;
    const barcode = barcodeText ? parseBarcode(barcodeText) : null;
    const expiry = expiryText ? parseExpiry(expiryText) : null;
    const { weight, unit: wUnit } = weightText ? parseWeight(weightText) : { weight: null, unit: null };
    const weightUnit = weightUnitText || wUnit;

    return { name, brand, price, qty, barcode, expiry, weight, weightUnit, hasMapped: mapped.length > 0 };
  }, [boxes]);

  // --- Save to inventory ---
  const handleSave = useCallback(async () => {
    if (!preview.name || !uid) return;
    try {
      await addMutation.mutateAsync({
        barcode: preview.barcode || `scan_${Date.now()}`,
        userId: uid,
        name: [preview.name, preview.brand].filter(Boolean).join(' — '),
        location,
      });
      // Clear mappings but keep boxes for next item
      setBoxes((prev) => prev.map((b) => ({ ...b, mapping: 'skip' as FieldKey })));
      setQuantity(1);
    } catch {
      // toast shown by mutation
    }
  }, [preview, uid, addMutation, location]);

  // --- Low quality warning ---
  const avgConfidence = useMemo(() => {
    const ocrBoxes = boxes.filter((b) => !b.isManual);
    if (ocrBoxes.length === 0) return 100;
    return ocrBoxes.reduce((sum, b) => sum + b.confidence, 0) / ocrBoxes.length;
  }, [boxes]);

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/admin-settings" className="text-xs text-ga-accent hover:underline mb-1 inline-block">
            ← Back to Admin Settings
          </Link>
          <h1 className="text-xl font-bold text-ga-text-primary">🔬 OCR Test Scanner</h1>
          <p className="text-xs text-ga-text-secondary mt-0.5">Upload an image to test Tesseract OCR with visual bounding boxes</p>
        </div>
      </div>

      {/* Step 1: Capture */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
        <h2 className="text-sm font-semibold text-ga-text-primary mb-3">Step 1: Capture Image</h2>
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => photoRef.current?.click()}
            className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors">
            📷 Take Photo
          </button>
          <button onClick={() => uploadRef.current?.click()}
            className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors">
            📁 Upload Image
          </button>
          <button onClick={() => docRef.current?.click()}
            className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors">
            📄 Scan Document
          </button>
          {imageFile && (
            <>
              <button onClick={() => rotateImage(90)} className="text-xs text-ga-text-secondary hover:text-ga-accent px-2 py-1">↻ 90°</button>
              <button onClick={() => rotateImage(180)} className="text-xs text-ga-text-secondary hover:text-ga-accent px-2 py-1">↻ 180°</button>
              <button onClick={handleScan} disabled={scanMutation.isPending}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 ml-auto transition-colors">
                {scanMutation.isPending ? '⏳ Processing...' : '🔍 Run Tesseract'}
              </button>
            </>
          )}
        </div>
        <input ref={photoRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <input ref={docRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocFile(f); e.target.value = ''; }} />

        {/* Image preview (before scan) */}
        {imageUrl && boxes.length === 0 && !scanMutation.isPending && (
          <div className="mt-2 max-h-[50vh] overflow-hidden rounded-lg">
            <img src={imageUrl} alt="Preview" className="w-full object-contain" />
          </div>
        )}

        {/* Scan info */}
        {scanInfo && (
          <div className="flex gap-4 mt-2 text-xs text-ga-text-secondary">
            <span>{scanInfo.boxCount} boxes detected</span>
            <span>{scanInfo.duration_ms}ms</span>
            <span>Lang: {scanInfo.lang}</span>
          </div>
        )}
      </div>

      {/* Step 2: Review Boxes */}
      {boxes.length > 0 && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ga-text-primary">Step 2: Review OCR Boxes</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsDrawMode(!isDrawMode)}
                className={`text-xs rounded px-3 py-1.5 transition-colors ${
                  isDrawMode ? 'bg-ga-accent text-white' : 'border border-ga-border text-ga-text-secondary hover:text-ga-text-primary'
                }`}
              >
                {isDrawMode ? '✏️ Drawing... (click+drag)' : '+ Draw Box'}
              </button>
              <button onClick={handleReset}
                className="text-xs text-ga-text-secondary hover:text-ga-text-primary border border-ga-border rounded px-3 py-1.5">
                🔄 Scan Another
              </button>
            </div>
          </div>

          {/* Low quality warning */}
          {avgConfidence < 50 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3 text-xs text-yellow-800">
              ⚠ Image quality is low — results may be inaccurate. Consider retaking the photo.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Image with box overlay */}
            <div
              ref={imageContainerRef}
              className={`relative rounded-lg overflow-hidden bg-black ${isDrawMode ? 'cursor-crosshair' : ''}`}
              style={{ maxHeight: '60vh' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {imageUrl && <img src={imageUrl} alt="Scanned" className="w-full object-contain" />}
              <BoxOverlay
                boxes={boxes}
                selectedId={selectedId}
                onSelect={setSelectedId}
                isDrawing={!!drawStart}
                drawRect={drawRect}
              />
            </div>

            {/* Box list */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {boxes.length === 0 && (
                <div className="text-center py-8 text-ga-text-secondary text-sm">
                  No text detected. Try better lighting or draw boxes manually.
                </div>
              )}
              {boxes.map((box) => (
                <BoxCard
                  key={box.id}
                  box={box}
                  isSelected={box.id === selectedId}
                  onSelect={() => setSelectedId(box.id === selectedId ? null : box.id)}
                  onDelete={() => deleteBox(box.id)}
                  onUpdate={(updates) => updateBox(box.id, updates)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Save */}
      {preview.hasMapped && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-ga-text-primary mb-3">Step 3: Preview & Save</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {preview.name && (
              <div>
                <span className="text-xs text-ga-text-secondary">Name</span>
                <p className="text-ga-text-primary font-medium">{preview.name}</p>
              </div>
            )}
            {preview.brand && (
              <div>
                <span className="text-xs text-ga-text-secondary">Brand</span>
                <p className="text-ga-text-primary">{preview.brand}</p>
              </div>
            )}
            {preview.price !== null && (
              <div>
                <span className="text-xs text-ga-text-secondary">Price</span>
                <p className="text-ga-text-primary">RM {preview.price.toFixed(2)}</p>
              </div>
            )}
            {preview.barcode && (
              <div>
                <span className="text-xs text-ga-text-secondary">Barcode</span>
                <p className="text-ga-text-primary font-mono text-xs">{preview.barcode}
                  {(preview.barcode.length < 8 || preview.barcode.length > 13) && (
                    <span className="text-yellow-600 ml-2">⚠ unusual length</span>
                  )}
                </p>
              </div>
            )}
            {preview.expiry && (
              <div>
                <span className="text-xs text-ga-text-secondary">Expiry</span>
                <p className="text-ga-text-primary">{preview.expiry}</p>
              </div>
            )}
            {preview.weight !== null && (
              <div>
                <span className="text-xs text-ga-text-secondary">Weight</span>
                <p className="text-ga-text-primary">{preview.weight} {preview.weightUnit || ''}</p>
              </div>
            )}
            <div>
              <label className="text-xs text-ga-text-secondary block mb-1">Quantity</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-sm text-ga-text-primary" />
            </div>
            <div>
              <label className="text-xs text-ga-text-secondary block mb-1">Location</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-sm text-ga-text-primary">
                {locations.map((l) => <option key={l.key} value={l.key}>{l.icon} {l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={!preview.name || addMutation.isPending}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {addMutation.isPending ? 'Saving...' : '💾 Save to Inventory'}
            </button>
            <button onClick={handleReset}
              className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors">
              🔄 Scan Another
            </button>
          </div>
          {!preview.name && (
            <p className="text-xs text-yellow-600 mt-2">Map at least a product name to save.</p>
          )}
        </div>
      )}

      {/* Raw OCR Text */}
      {rawText && (
        <details className="bg-ga-bg-card border border-ga-border rounded-lg">
          <summary className="px-4 py-3 text-sm font-medium text-ga-text-secondary cursor-pointer hover:text-ga-text-primary">
            Raw OCR Text
          </summary>
          <pre className="px-4 pb-4 text-xs whitespace-pre-wrap text-ga-text-primary font-mono max-h-64 overflow-y-auto">
            {rawText}
          </pre>
        </details>
      )}
    </div>
  );
}
