import {create} from 'zustand';

export interface ScannedItemView {
  id: string;
  barcode: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  scannedAt: number;
  expiresAt: number;
  isExpired: boolean;
}

interface ScanState {
  scannedItems: ScannedItemView[];
  currentScan: ScannedItemView | null;
  loading: boolean;

  setScannedItems: (items: ScannedItemView[]) => void;
  setCurrentScan: (scan: ScannedItemView | null) => void;
  addScan: (scan: ScannedItemView) => void;
  removeScan: (id: string) => void;
  clearAll: () => void;
  setLoading: (loading: boolean) => void;
}

export const useScanStore = create<ScanState>(set => ({
  scannedItems: [],
  currentScan: null,
  loading: false,

  setScannedItems: (scannedItems) => set({scannedItems}),
  setCurrentScan: (currentScan) => set({currentScan}),
  addScan: (scan) => set(state => ({
    scannedItems: [scan, ...state.scannedItems],
  })),
  removeScan: (id) => set(state => ({
    scannedItems: state.scannedItems.filter(s => s.id !== id),
  })),
  clearAll: () => set({scannedItems: [], currentScan: null}),
  setLoading: (loading) => set({loading}),
}));
