import {AppError, classifyError, getErrorMessage} from '../errors';

describe('errors', () => {
  // -----------------------------------------------------------------------
  // AppError
  // -----------------------------------------------------------------------

  describe('AppError', () => {
    it('creates an error with code and message', () => {
      const err = new AppError('NETWORK_OFFLINE', 'No connection');
      expect(err.code).toBe('NETWORK_OFFLINE');
      expect(err.message).toBe('No connection');
      expect(err.name).toBe('AppError');
      expect(err.retryable).toBe(false);
    });

    it('supports optional fields', () => {
      const original = new Error('original');
      const err = new AppError('API_SERVER_ERROR', 'Server down', {
        statusCode: 500,
        retryable: true,
        originalError: original,
      });
      expect(err.statusCode).toBe(500);
      expect(err.retryable).toBe(true);
      expect(err.originalError).toBe(original);
    });

    it('extends Error', () => {
      const err = new AppError('UNKNOWN', 'test');
      expect(err instanceof Error).toBe(true);
      expect(err instanceof AppError).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // classifyError
  // -----------------------------------------------------------------------

  describe('classifyError', () => {
    it('returns same AppError if already classified', () => {
      const original = new AppError('API_NOT_FOUND', 'Not found');
      const result = classifyError(original);
      expect(result).toBe(original);
    });

    it('classifies Axios timeout errors', () => {
      const axiosErr = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('NETWORK_TIMEOUT');
      expect(result.retryable).toBe(true);
    });

    it('classifies Axios network errors (no response)', () => {
      const axiosErr = {
        isAxiosError: true,
        message: 'Network Error',
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('NETWORK_OFFLINE');
      expect(result.retryable).toBe(true);
    });

    it('classifies 400 as API_BAD_REQUEST', () => {
      const axiosErr = {
        isAxiosError: true,
        response: {status: 400, data: {detail: 'Bad input'}},
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('API_BAD_REQUEST');
      expect(result.message).toBe('Bad input');
    });

    it('classifies 401 as API_UNAUTHORIZED', () => {
      const axiosErr = {
        isAxiosError: true,
        response: {status: 401, data: {}},
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('API_UNAUTHORIZED');
    });

    it('classifies 403 as API_FORBIDDEN', () => {
      const axiosErr = {
        isAxiosError: true,
        response: {status: 403, data: {}},
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('API_FORBIDDEN');
    });

    it('classifies 404 as API_NOT_FOUND', () => {
      const axiosErr = {
        isAxiosError: true,
        response: {status: 404, data: {}},
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('API_NOT_FOUND');
    });

    it('classifies 429 as API_RATE_LIMITED', () => {
      const axiosErr = {
        isAxiosError: true,
        response: {status: 429, data: {}},
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('API_RATE_LIMITED');
      expect(result.retryable).toBe(true);
    });

    it('classifies 500+ as API_SERVER_ERROR', () => {
      const axiosErr = {
        isAxiosError: true,
        response: {status: 503, data: {}},
      };
      const result = classifyError(axiosErr);
      expect(result.code).toBe('API_SERVER_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('classifies Firebase network errors', () => {
      const fbErr = {code: 'auth/network-request-failed', message: 'Network error'};
      const result = classifyError(fbErr);
      expect(result.code).toBe('NETWORK_OFFLINE');
    });

    it('classifies Firebase permission errors', () => {
      const fbErr = {code: 'permission-denied', message: 'No access'};
      const result = classifyError(fbErr);
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('classifies generic network Error', () => {
      const result = classifyError(new Error('Network request failed'));
      expect(result.code).toBe('NETWORK_OFFLINE');
    });

    it('classifies unknown Error', () => {
      const result = classifyError(new Error('Something broke'));
      expect(result.code).toBe('UNKNOWN');
      expect(result.message).toBe('Something broke');
    });

    it('classifies non-Error values', () => {
      const result = classifyError('string error');
      expect(result.code).toBe('UNKNOWN');
    });

    it('classifies null', () => {
      const result = classifyError(null);
      expect(result.code).toBe('UNKNOWN');
    });
  });

  // -----------------------------------------------------------------------
  // getErrorMessage
  // -----------------------------------------------------------------------

  describe('getErrorMessage', () => {
    it('returns user-friendly message for each code', () => {
      expect(getErrorMessage('NETWORK_OFFLINE')).toContain('internet');
      expect(getErrorMessage('NETWORK_TIMEOUT')).toContain('timed out');
      expect(getErrorMessage('API_UNAUTHORIZED')).toContain('session');
      expect(getErrorMessage('API_FORBIDDEN')).toContain('premium');
      expect(getErrorMessage('API_SERVER_ERROR')).toContain('Server error');
      expect(getErrorMessage('API_RATE_LIMITED')).toContain('many requests');
      expect(getErrorMessage('UNKNOWN')).toContain('unexpected');
    });
  });
});
