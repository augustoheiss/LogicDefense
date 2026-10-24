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
  isManual?: boolean;
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
  const [userLocation, setUserLocationState] = useState<LiveGpsPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [panToUserRequest, setPanToUserRequest] = useState<number>(0);

  const userLocationRef = useRef<LiveGpsPosition | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const didPanOnActivationRef = useRef<boolean>(false);

  const setUserLocation = useCallback((next: LiveGpsPosition | null) => {
    userLocationRef.current = next;
    setUserLocationState(next);
  }, []);

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
      setGpsError('Toque em "📍 Definir Minha Posição no Mapa" e toque no mapa para marcar seu ponto de partida.');
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
        isManual: false,
      };
      setUserLocation(nextPos);
      setGpsError(null);

      if (!didPanOnActivationRef.current) {
        didPanOnActivationRef.current = true;
        setPanToUserRequest((n) => n + 1);
      }
    };

    const onError = (err: GeolocationPositionError) => {
      if (userLocationRef.current?.isManual) {
        // Keep manual origin active without overriding with error if user explicitly set position
        return;
      }
      if (err.code === 1) {
        setGpsError('Permissão de GPS negada. Permita o GPS no navegador ou clique em "📍 Definir Minha Posição no Mapa".');
      } else if (err.code === 2) {
        setGpsError('Sinal de GPS indisponível. Você pode clicar em "📍 Definir Minha Posição no Mapa".');
      } else {
        setGpsError('Tempo limite ao obter sinal GPS. Tente novamente ou indique sua posição no mapa.');
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
  }, [gpsEnabled, stopWatch, setUserLocation]);

  const enableGpsAndGetPosition = useCallback(
    (timeoutMs = 5000): Promise<LiveGpsPosition | null> => {
      if (userLocationRef.current) {
        return Promise.resolve(userLocationRef.current);
      }
      setGpsEnabled(true);
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setGpsError('Geolocalização não suportada neste dispositivo. Indique sua posição tocando no mapa.');
        return Promise.resolve(null);
      }

      return new Promise<LiveGpsPosition | null>((resolve) => {
        let settled = false;
        const finish = (pos: LiveGpsPosition | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(pos);
        };

        const timer = setTimeout(() => {
          finish(userLocationRef.current);
        }, Math.max(1000, timeoutMs));

        try {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const nextPos: LiveGpsPosition = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 15,
                heading: pos.coords.heading,
                timestamp: pos.timestamp || Date.now(),
                isManual: false,
              };
              setUserLocation(nextPos);
              setGpsError(null);
              finish(nextPos);
            },
            (err) => {
              if (err.code === 1) {
                setGpsError('Permissão de GPS negada. Permita o GPS ou clique em "📍 Definir Minha Posição no Mapa".');
              } else {
                setGpsError('Não foi possível obter o GPS automaticamente. Clique em "📍 Definir Minha Posição no Mapa".');
              }
              finish(userLocationRef.current);
            },
            {
              enableHighAccuracy: true,
              timeout: Math.max(1000, timeoutMs - 200),
              maximumAge: 10000,
            }
          );
        } catch {
          finish(userLocationRef.current);
        }
      });
    },
    [setUserLocation]
  );

  const setManualOrigin = useCallback(
    (lat: number, lng: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const manualPos: LiveGpsPosition = {
        lat,
        lng,
        accuracy: 10,
        heading: null,
        timestamp: Date.now(),
        isManual: true,
      };
      setUserLocation(manualPos);
      setGpsError(null);
      return manualPos;
    },
    [setUserLocation]
  );

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
    if (userLocationRef.current) {
      setPanToUserRequest((n) => n + 1);
    } else if (!gpsEnabled) {
      didPanOnActivationRef.current = false;
      setGpsEnabled(true);
    }
  }, [gpsEnabled]);

  return {
    gpsEnabled,
    setGpsEnabled,
    toggleGps,
    enableGpsAndGetPosition,
    setManualOrigin,
    userLocation,
    setUserLocation,
    gpsError,
    panToUserRequest,
    centerOnUser,
  };
}
