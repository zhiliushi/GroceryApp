import {create} from 'zustand';
import type {SyncStatus, SyncResult} from '../services/sync/SyncService';

interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  lastResult: SyncResult | null;
  isOnline: boolean;
  errorMessage: string | null;

  setStatus: (status: SyncStatus) => void;
  setLastSyncAt: (timestamp: number) => void;
  setLastResult: (result: SyncResult) => void;
  setOnline: (online: boolean) => void;
  setError: (message: string | null) => void;
  updateFromResult: (result: SyncResult) => void;
}

export const useSyncStore = create<SyncState>(set => ({
  status: 'idle',
  lastSyncAt: null,
  lastResult: null,
  isOnline: true,
  errorMessage: null,

  setStatus: status => set({status}),
  setLastSyncAt: lastSyncAt => set({lastSyncAt}),
  setLastResult: lastResult => set({lastResult}),
  setOnline: isOnline => set({isOnline}),
  setError: errorMessage => set({errorMessage}),

  updateFromResult: result =>
    set({
      status: result.status,
      lastResult: result,
      lastSyncAt: result.status === 'success' ? result.timestamp : undefined,
      errorMessage:
        result.errors.length > 0 ? result.errors.join('; ') : null,
    }),
}));
