import axios, {AxiosInstance, InternalAxiosRequestConfig} from 'axios';
import {firebaseAuth} from './firebase';
import {API_BASE_URL, API_TIMEOUT} from './constants';
import {classifyError, AppError} from '../utils/errors';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Firebase auth token to every request
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const user = firebaseAuth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(classifyError(error)),
);

// Classify all error responses into AppError
apiClient.interceptors.response.use(
  response => response,
  error => {
    return Promise.reject(classifyError(error));
  },
);

// API endpoint helpers
export const API = {
  barcode: {
    scan: '/api/barcode/scan',
    product: (barcode: string) => `/api/barcode/product/${barcode}`,
    contribute: '/api/barcode/contribute',
  },
  analytics: {
    sync: '/api/analytics/sync',
    stats: (userId: string) => `/api/analytics/stats/${userId}`,
  },
  geocode: {
    reverse: '/api/barcode/geocode/reverse',
  },
} as const;

export default apiClient;
