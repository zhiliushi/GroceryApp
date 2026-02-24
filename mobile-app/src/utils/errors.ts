// ---------------------------------------------------------------------------
// Unified error classification
// ---------------------------------------------------------------------------

export type AppErrorCode =
  | 'NETWORK_OFFLINE'
  | 'NETWORK_TIMEOUT'
  | 'API_BAD_REQUEST'
  | 'API_UNAUTHORIZED'
  | 'API_FORBIDDEN'
  | 'API_NOT_FOUND'
  | 'API_RATE_LIMITED'
  | 'API_SERVER_ERROR'
  | 'API_UNKNOWN'
  | 'DB_READ_ERROR'
  | 'DB_WRITE_ERROR'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export class AppError extends Error {
  code: AppErrorCode;
  statusCode?: number;
  retryable: boolean;
  originalError?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    opts?: {statusCode?: number; retryable?: boolean; originalError?: unknown},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = opts?.statusCode;
    this.retryable = opts?.retryable ?? false;
    this.originalError = opts?.originalError;
  }
}

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

/** Classify any thrown value into an AppError. */
export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  // Axios-style errors
  if (isAxiosError(error)) {
    if (!error.response) {
      // No response means network issue
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return new AppError('NETWORK_TIMEOUT', 'Request timed out. Please try again.', {
          retryable: true,
          originalError: error,
        });
      }
      return new AppError('NETWORK_OFFLINE', 'No internet connection. Please check your network.', {
        retryable: true,
        originalError: error,
      });
    }

    const status = error.response.status;
    const serverMessage =
      error.response.data?.detail ??
      error.response.data?.message ??
      undefined;

    switch (status) {
      case 400:
        return new AppError('API_BAD_REQUEST', serverMessage ?? 'Invalid request.', {
          statusCode: 400,
          originalError: error,
        });
      case 401:
        return new AppError('API_UNAUTHORIZED', 'Your session has expired. Please sign in again.', {
          statusCode: 401,
          originalError: error,
        });
      case 403:
        return new AppError('API_FORBIDDEN', serverMessage ?? 'This feature requires a premium subscription.', {
          statusCode: 403,
          originalError: error,
        });
      case 404:
        return new AppError('API_NOT_FOUND', serverMessage ?? 'The requested resource was not found.', {
          statusCode: 404,
          originalError: error,
        });
      case 429:
        return new AppError('API_RATE_LIMITED', 'Too many requests. Please wait a moment.', {
          statusCode: 429,
          retryable: true,
          originalError: error,
        });
      default:
        if (status >= 500) {
          return new AppError('API_SERVER_ERROR', 'Server error. Please try again later.', {
            statusCode: status,
            retryable: true,
            originalError: error,
          });
        }
        return new AppError('API_UNKNOWN', serverMessage ?? 'An unexpected error occurred.', {
          statusCode: status,
          originalError: error,
        });
    }
  }

  // Firebase auth errors
  if (isFirebaseError(error)) {
    const code = error.code ?? '';
    if (code.includes('network')) {
      return new AppError('NETWORK_OFFLINE', 'Network error. Check your connection.', {
        retryable: true,
        originalError: error,
      });
    }
    if (code.includes('permission') || code.includes('unauthorized')) {
      return new AppError('PERMISSION_DENIED', 'Permission denied.', {
        originalError: error,
      });
    }
    return new AppError('UNKNOWN', error.message ?? 'An error occurred.', {
      originalError: error,
    });
  }

  // Generic Error
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('offline') || msg.includes('internet')) {
      return new AppError('NETWORK_OFFLINE', 'No internet connection.', {
        retryable: true,
        originalError: error,
      });
    }
    return new AppError('UNKNOWN', error.message, {originalError: error});
  }

  return new AppError('UNKNOWN', 'An unexpected error occurred.', {
    originalError: error,
  });
}

/** User-friendly message for an error code. */
export function getErrorMessage(code: AppErrorCode): string {
  switch (code) {
    case 'NETWORK_OFFLINE':
      return 'No internet connection. Please check your network.';
    case 'NETWORK_TIMEOUT':
      return 'Request timed out. Please try again.';
    case 'API_UNAUTHORIZED':
      return 'Your session has expired. Please sign in again.';
    case 'API_FORBIDDEN':
      return 'This feature requires a premium subscription.';
    case 'API_NOT_FOUND':
      return 'The requested resource was not found.';
    case 'API_RATE_LIMITED':
      return 'Too many requests. Please wait a moment.';
    case 'API_SERVER_ERROR':
      return 'Server error. Please try again later.';
    case 'DB_READ_ERROR':
      return 'Could not load data. Please try again.';
    case 'DB_WRITE_ERROR':
      return 'Could not save data. Please try again.';
    case 'PERMISSION_DENIED':
      return 'Permission denied.';
    case 'VALIDATION_ERROR':
      return 'Please check your input and try again.';
    default:
      return 'An unexpected error occurred.';
  }
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isAxiosError(err: unknown): err is {
  response?: {status: number; data?: {detail?: string; message?: string}};
  code?: string;
  message?: string;
} {
  return (
    typeof err === 'object' &&
    err !== null &&
    'isAxiosError' in err &&
    (err as any).isAxiosError === true
  );
}

function isFirebaseError(err: unknown): err is {code?: string; message?: string} {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as any).code === 'string'
  );
}
