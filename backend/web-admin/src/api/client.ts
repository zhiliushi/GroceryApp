import axios from 'axios';
import { getActiveHouseholdId } from '@/stores/activeHouseholdStore';

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift() || null;
  return null;
}

export const apiClient = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getCookie('__session');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // MH-3a: send the active-household scope so the backend can route reads
  // to the correct household when a user is a member of multiple. No-op
  // today (single household per user); becomes meaningful with MH-3b. See
  // `docs/PLAN_ONBOARDING_V2.md` MH-3.
  const activeHousehold = getActiveHouseholdId();
  if (activeHousehold) {
    config.headers['X-Household'] = activeHousehold;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
