import NetInfo from '@react-native-community/netinfo';
import apiClient, {API} from '../../config/api';
import type {BarcodeProduct, ContributeRequest, ContributeResponse} from '../../types';

// ---------------------------------------------------------------------------
// Offline queue
// ---------------------------------------------------------------------------

interface QueuedRequest {
  type: 'scan' | 'contribute';
  payload: Record<string, unknown>;
  createdAt: number;
}

/** In-memory queue for requests that failed due to network issues. */
let offlineQueue: QueuedRequest[] = [];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;
const QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class BarcodeApiService {
  // -------------------------------------------------------------------------
  // Scan endpoint
  // -------------------------------------------------------------------------

  /**
   * Send a barcode to the backend for lookup.
   * Retries up to MAX_RETRIES times on transient failures.
   * Queues the request for later if the device is offline.
   */
  async scanBarcode(barcode: string, userId?: string): Promise<BarcodeProduct> {
    const isOnline = await this.checkConnectivity();
    if (!isOnline) {
      this.enqueue({type: 'scan', payload: {barcode, user_id: userId}, createdAt: Date.now()});
      throw new BarcodeApiError('offline', 'No network connection. Scan queued for later.');
    }

    return this.withRetry(async () => {
      const response = await apiClient.post<BarcodeProduct>(API.barcode.scan, {
        barcode,
        user_id: userId,
      });
      return response.data;
    });
  }

  // -------------------------------------------------------------------------
  // Product lookup
  // -------------------------------------------------------------------------

  /** Fetch product details by barcode from the backend cache. */
  async getProduct(barcode: string): Promise<BarcodeProduct | null> {
    try {
      const response = await apiClient.get<BarcodeProduct>(API.barcode.product(barcode));
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Contribute endpoint
  // -------------------------------------------------------------------------

  /**
   * Submit user-contributed product data for a barcode not found in any source.
   * Queues for later if offline.
   */
  async contributeProduct(data: ContributeRequest): Promise<ContributeResponse | null> {
    const isOnline = await this.checkConnectivity();
    if (!isOnline) {
      this.enqueue({type: 'contribute', payload: data as unknown as Record<string, unknown>, createdAt: Date.now()});
      return null;
    }

    return this.withRetry(async () => {
      const response = await apiClient.post<ContributeResponse>(API.barcode.contribute, data);
      return response.data;
    });
  }

  // -------------------------------------------------------------------------
  // Offline queue management
  // -------------------------------------------------------------------------

  /** Flush all queued requests. Call when connectivity is restored. */
  async flushQueue(): Promise<number> {
    const isOnline = await this.checkConnectivity();
    if (!isOnline || offlineQueue.length === 0) return 0;

    const now = Date.now();
    // Discard stale entries
    const validQueue = offlineQueue.filter(r => now - r.createdAt < QUEUE_MAX_AGE_MS);
    offlineQueue = [];

    let flushed = 0;
    for (const request of validQueue) {
      try {
        if (request.type === 'scan') {
          await apiClient.post(API.barcode.scan, request.payload);
        } else if (request.type === 'contribute') {
          await apiClient.post(API.barcode.contribute, request.payload);
        }
        flushed++;
      } catch {
        // Re-queue if still failing
        offlineQueue.push(request);
      }
    }

    return flushed;
  }

  /** Get the number of pending queued requests. */
  getQueueSize(): number {
    return offlineQueue.length;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private enqueue(request: QueuedRequest): void {
    offlineQueue.push(request);
  }

  private async checkConnectivity(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true;
  }

  /**
   * Retry a request up to MAX_RETRIES times with linear backoff.
   * Only retries on network errors or 5xx server errors.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        const status = error?.response?.status;
        const isRetryable = !status || status >= 500;

        if (!isRetryable || attempt === MAX_RETRIES) break;

        await this.sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class BarcodeApiError extends Error {
  constructor(
    public readonly code: 'offline' | 'timeout' | 'server' | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'BarcodeApiError';
  }
}

export default new BarcodeApiService();
