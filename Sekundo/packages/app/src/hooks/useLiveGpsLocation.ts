/**
 * Hook: useLiveGpsLocation
 *
 * Sovereign real-time GPS telemetry hook for Sekundo maps (`territory-map`, `publisher`, `territory-checklist`).
 * - Manages `navigator.geolocation.watchPosition` with strict Resource Balance (`clearWatch` on disable or unmount).
 * - Decouples live coordinate updates (`userLocation`) from camera movement (`panToUserRequest`) so continuous
 *   GPS updates never hijack the operator's zoom or pan ("anti-rubber-banding" invariant).
 * - Exposes `openGoogleMapsUrl` helper for cross-platform external navigation (`maps/dir/?api=1`).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import {
  buildGoogleMapsDirectionsUrl,
  type GoogleMapsTargetInput,
} from '@sekundo/core';

export interface LiveGpsPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  timestamp: number;
}

export function openExternalGoogleMaps(input: GoogleMapsTargetInput): string {
  const url = buildGoogleMapsDirectionsUrl(input);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => undefined);
  }
  return url;
}

export function useLiveGpsLocation(initialEnabled = false) {
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(initialEnabled);
  const [userLocation, setUserLocation] = useState<LiveGpsPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [panToUserRequest, setPanToUserRequest] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const didPanOnActivationRef = useRef<boolean>(false);

  const stopWatch = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation &&
      typeof navigator.geolocation.clearWatch === 'function'
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!gpsEnabled) {
      stopWatch();
      didPanOnActivationRef.current = false;
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocalização não suportada neste navegador/dispositivo.');
      return;
    }

    setGpsError(null);

    const onSuccess = (pos: GeolocationPosition) => {
      const nextPos: LiveGpsPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 15,
        heading: pos.coords.heading,
        timestamp: pos.timestamp || Date.now(),
      };
      setUserLocation(nextPos);
      setGpsError(null);

      if (!didPanOnActivationRef.current) {
        didPanOnActivationRef.current = true;
        setPanToUserRequest((n) => n + 1);
      }
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === 1) {
        setGpsError('Permissão de GPS negada no navegador.');
      } else if (err.code === 2) {
        setGpsError('Sinal de GPS indisponível no momento.');
      } else {
        setGpsError('Tempo limite ao obter sinal GPS.');
      }
    };

    // Request immediate fix + continuous watch
    try {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });

      const id = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      });
      watchIdRef.current = id;
    } catch {
      setGpsError('Não foi possível iniciar o receptor GPS.');
    }

    return () => {
      stopWatch();
    };
  }, [gpsEnabled, stopWatch]);

  const toggleGps = useCallback(() => {
    setGpsEnabled((prev) => {
      const next = !prev;
      if (!next) {
        setGpsError(null);
      } else {
        didPanOnActivationRef.current = false;
      }
      return next;
    });
  }, []);

  const centerOnUser = useCallback(() => {
    if (!gpsEnabled) {
      didPanOnActivationRef.current = false;
      setGpsEnabled(true);
    } else if (userLocation) {
      setPanToUserRequest((n) => n + 1);
    }
  }, [gpsEnabled, userLocation]);

  return {
    gpsEnabled,
    setGpsEnabled,
    toggleGps,
    userLocation,
    setUserLocation,
    gpsError,
    panToUserRequest,
    centerOnUser,
  };
}
