import {useEffect, useRef, useCallback} from 'react';
import NetInfo from '@react-native-community/netinfo';
import SyncService from '../services/sync/SyncService';
import type {SyncResult} from '../services/sync/SyncService';
import {useAuthStore} from '../store/authStore';
import {useSyncStore} from '../store/syncStore';
import {useDatabase} from './useDatabase';

/** Foreground sync interval: 6 hours (ms). */
const FOREGROUND_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface UseSyncReturn {
  /** Current sync status ('idle' | 'syncing' | 'success' | 'error'). */
  status: string;
  /** Whether the device is online. */
  isOnline: boolean;
  /** Unix timestamp of last successful sync, or null. */
  lastSyncAt: number | null;
  /** Last sync result with details. */
  lastResult: SyncResult | null;
  /** Error message from the last sync, or null. */
  errorMessage: string | null;
  /** Manually trigger a sync. */
  syncNow: () => Promise<void>;
}

/**
 * Manages foreground periodic sync, background fetch registration,
 * network monitoring, and exposes manual trigger + status.
 *
 * Analytics sync runs for ALL authenticated users.
 * Inventory + shopping list sync runs only for PAID users.
 */
export function useSync(): UseSyncReturn {
  const {user, tier} = useAuthStore();
  const {database} = useDatabase();
  const {
    status,
    isOnline,
    lastSyncAt,
    lastResult,
    errorMessage,
    setOnline,
    updateFromResult,
  } = useSyncStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Initialize SyncService
  // ---------------------------------------------------------------------------

  useEffect(() => {
    SyncService.init(database);
  }, [database]);

  // ---------------------------------------------------------------------------
  // Listen to SyncService events → update store
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = SyncService.addListener((result: SyncResult) => {
      updateFromResult(result);
    });
    return unsubscribe;
  }, [updateFromResult]);

  // ---------------------------------------------------------------------------
  // Monitor network status
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, [setOnline]);

  // ---------------------------------------------------------------------------
  // Manual sync trigger
  // ---------------------------------------------------------------------------

  const syncNow = useCallback(async () => {
    if (!user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      await SyncService.sync(user.uid, tier === 'paid');
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, tier]);

  // ---------------------------------------------------------------------------
  // Periodic foreground sync (every 6 hours)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;

    // Sync on mount
    syncNow();

    intervalRef.current = setInterval(syncNow, FOREGROUND_SYNC_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, syncNow]);

  // ---------------------------------------------------------------------------
  // Register background fetch (once, for paid users)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (user) {
      SyncService.configureBackgroundFetch(user.uid);
    }
  }, [user]);

  return {status, isOnline, lastSyncAt, lastResult, errorMessage, syncNow};
}
