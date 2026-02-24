import {useState, useEffect, useCallback} from 'react';
import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import apiClient, {API} from '../config/api';
import {useSettingsStore} from '../store/settingsStore';

interface GeolocationResult {
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  address: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook for getting current GPS location and reverse-geocoding it
 * via the backend (Google Places + Geocoding API).
 *
 * Only activates if `autoLocationEnabled` is true in settings.
 * Returns nulls gracefully on failure or when disabled.
 */
export function useGeolocation(): GeolocationResult {
  const {autoLocationEnabled} = useSettingsStore();

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async () => {
    if (!autoLocationEnabled) {
      setLatitude(null);
      setLongitude(null);
      setPlaceName(null);
      setAddress(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Request permission on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'GroceryApp needs location access to record where you shop.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Location permission denied');
          setLoading(false);
          return;
        }
      }

      // Get GPS coordinates
      const position = await new Promise<{lat: number; lng: number}>(
        (resolve, reject) => {
          Geolocation.getCurrentPosition(
            pos => resolve({lat: pos.coords.latitude, lng: pos.coords.longitude}),
            err => reject(new Error(err.message)),
            {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000},
          );
        },
      );

      setLatitude(position.lat);
      setLongitude(position.lng);

      // Reverse geocode via backend
      try {
        const response = await apiClient.post(API.geocode.reverse, {
          lat: position.lat,
          lng: position.lng,
        });
        setPlaceName(response.data.place_name ?? null);
        setAddress(response.data.address ?? null);
      } catch {
        // Reverse geocoding failed (offline or API error) — GPS coords still available
        setPlaceName(null);
        setAddress(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
    } finally {
      setLoading(false);
    }
  }, [autoLocationEnabled]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return {
    latitude,
    longitude,
    placeName,
    address,
    loading,
    error,
    refresh: fetchLocation,
  };
}
